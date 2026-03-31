'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ROUTE_PRESETS, type RouteOptions, type RoutePreset } from '@/types/route';

/** Sentinel stored in field state when GPS mode is active for that field */
const GPS = '__GPS__';

function toDateTimeLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface Suggestion {
  label: string;
  lat: number;
  lng: number;
}

async function fetchSuggestions(query: string): Promise<Suggestion[]> {
  if (query.trim().length < 3) return [];
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features ?? []).map((f: any) => {
      const p = f.properties;
      const parts = [p.name, p.street && p.housenumber ? `${p.street} ${p.housenumber}` : p.street, p.city, p.country]
        .filter(Boolean);
      return {
        label: parts.join(', '),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      };
    });
  } catch {
    return [];
  }
}

interface Props {
  isLoading: boolean;
  hasGpsLocation: boolean;
  onSearch: (origin: string | null, destination: string | null, time: Date, options: RouteOptions) => void;
  onReset: () => void;
  hasResult: boolean;
  /**
   * 'sidebar' (default) — full panel with date/time and routing options
   * 'topbar'            — compact two-field bar for mobile top strip
   */
  variant?: 'sidebar' | 'topbar';
}

interface FieldProps {
  label?: string;
  icon: string;
  value: string;
  onChange: (v: string) => void;
  onGps: () => void;
  onClearGps: () => void;
  placeholder: string;
  hasGps: boolean;
  disabled: boolean;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

function LocationField({
  label, icon, value, onChange, onGps, onClearGps,
  placeholder, hasGps, disabled, autoFocus, inputRef,
}: FieldProps) {
  const isGpsMode = value === GPS;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const internalRef = useRef<HTMLInputElement | null>(null);
  const resolvedRef = (inputRef ?? internalRef) as React.RefObject<HTMLInputElement | null>;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextFetchRef = useRef(false);

  useEffect(() => {
    if (isGpsMode || !value.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (suppressNextFetchRef.current) {
      suppressNextFetchRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await fetchSuggestions(value);
      setSuggestions(results);
      setOpen(results.length > 0);
      setActiveIdx(-1);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, isGpsMode]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const pick = useCallback((s: Suggestion) => {
    suppressNextFetchRef.current = true;
    onChange(s.label);
    setSuggestions([]);
    setOpen(false);
    setActiveIdx(-1);
    requestAnimationFrame(() => resolvedRef.current?.focus());
  }, [onChange, resolvedRef]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(suggestions[activeIdx >= 0 ? activeIdx : 0]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-1 relative">
      {label && (
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      )}
      <div className={`flex items-center border rounded-lg overflow-hidden transition-colors ${
        isGpsMode ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'
      }`}>
        <span className="pl-2.5 text-sm flex-shrink-0">{icon}</span>

        {isGpsMode ? (
          <div className="flex-1 flex items-center justify-between px-2 py-2">
            <span className="text-sm text-green-700 font-medium">My current location</span>
            <button
              type="button"
              onClick={onClearGps}
              disabled={disabled}
              className="text-green-500 hover:text-green-700 ml-1 text-xs font-bold"
              title="Clear"
            >
              ✕
            </button>
          </div>
        ) : (
          <input
            ref={resolvedRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={autoFocus}
            className="flex-1 text-sm px-2 py-2 bg-transparent focus:outline-none disabled:opacity-60"
          />
        )}

        {hasGps && !isGpsMode && (
          <button
            type="button"
            onClick={onGps}
            disabled={disabled}
            title="Use my current location"
            className="px-2.5 py-2 text-gray-400 hover:text-green-600 transition-colors border-l border-gray-100 flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="3" strokeWidth="2"/>
              <path strokeLinecap="round" strokeWidth="2" d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
            </svg>
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                className={`w-full text-left px-3 py-2 text-sm truncate transition-colors ${
                  i === activeIdx ? 'bg-green-50 text-green-800' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {s.label}
              </button>
            </li>
          ))}
          <li className="px-3 py-1.5 text-xs text-gray-300 border-t border-gray-100 text-right">
            © OpenStreetMap contributors
          </li>
        </ul>
      )}
    </div>
  );
}

const PRESET_META: Record<RoutePreset, { label: string; sub: string }> = {
  speed:    { label: 'Speed',     sub: 'Direct route' },
  balanced: { label: 'Balanced',  sub: 'Up to +20%' },
  shade:    { label: 'Max Shade', sub: 'Up to +35%' },
};

export function SearchPanel({ isLoading, hasGpsLocation, onSearch, onReset, hasResult, variant = 'sidebar' }: Props) {
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  const [dateTimeStr, setDateTimeStr] = useState(() => toDateTimeLocal(new Date()));
  const [preset, setPreset] = useState<RoutePreset>('balanced');
  const [maxDetour, setMaxDetour] = useState(ROUTE_PRESETS.balanced.maxDetourPct);
  const destRef = useRef<HTMLInputElement | null>(null);

  const handlePreset = (p: RoutePreset) => {
    setPreset(p);
    setMaxDetour(ROUTE_PRESETS[p].maxDetourPct);
  };

  useEffect(() => {
    if (!isLoading) {
      requestAnimationFrame(() => destRef.current?.focus());
    }
  }, [isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasOrigin = origin === GPS || !!origin.trim();
    const hasDest = dest === GPS || !!dest.trim();
    if (!hasDest) return;
    if (!hasOrigin && !hasGpsLocation) return;

    const time = new Date(dateTimeStr);
    const options: RouteOptions = {
      maxDetourPct: maxDetour,
      minShadeGain: ROUTE_PRESETS[preset].minShadeGain,
    };
    onSearch(
      origin === GPS ? null : (origin.trim() || null),
      dest === GPS ? null : dest.trim(),
      isNaN(time.getTime()) ? new Date() : time,
      options
    );
  };

  const handleClear = () => {
    onReset();
    setOrigin('');
    setDest('');
    setDateTimeStr(toDateTimeLocal(new Date()));
  };

  const canSearch =
    (dest === GPS || !!dest.trim()) &&
    (origin === GPS || !!origin.trim() || hasGpsLocation);

  // ── Topbar variant (mobile fixed top bar) ───────────────────────────────
  if (variant === 'topbar') {
    return (
      <form onSubmit={handleSubmit} className="px-3 py-2.5 flex flex-col gap-1.5">
        <LocationField
          icon="📍"
          value={origin}
          onChange={setOrigin}
          onGps={() => setOrigin(GPS)}
          onClearGps={() => setOrigin('')}
          placeholder={hasGpsLocation ? 'Current location' : 'Starting point'}
          hasGps={hasGpsLocation}
          disabled={isLoading}
        />

        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <LocationField
              icon="🔴"
              value={dest}
              onChange={setDest}
              onGps={() => setDest(GPS)}
              onClearGps={() => setDest('')}
              placeholder="Where to?"
              hasGps={hasGpsLocation}
              disabled={isLoading}
              autoFocus
              inputRef={destRef}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !canSearch}
            className="flex-shrink-0 w-11 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-lg transition-colors flex items-center justify-center"
            aria-label="Find route"
          >
            {isLoading ? (
              <Spinner className="w-4 h-4 text-white" />
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            )}
          </button>
        </div>

        {!hasGpsLocation && origin !== GPS && !origin.trim() && (
          <p className="text-xs text-amber-600">GPS unavailable — enter a starting address</p>
        )}

        {hasResult && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-gray-400 hover:text-gray-600 self-start"
          >
            ✕ Clear route
          </button>
        )}
      </form>
    );
  }

  // ── Sidebar variant (desktop full panel) ────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <LocationField
        label="From"
        icon="📍"
        value={origin}
        onChange={setOrigin}
        onGps={() => setOrigin(GPS)}
        onClearGps={() => setOrigin('')}
        placeholder={hasGpsLocation ? 'Current location' : 'Enter starting point'}
        hasGps={hasGpsLocation}
        disabled={isLoading}
      />

      {!hasGpsLocation && origin !== GPS && !origin.trim() && (
        <p className="text-xs text-amber-600 -mt-1">GPS unavailable — enter a starting address</p>
      )}

      <div className="ml-3 w-px h-3 bg-gray-200" />

      <LocationField
        label="To"
        icon="🔴"
        value={dest}
        onChange={setDest}
        onGps={() => setDest(GPS)}
        onClearGps={() => setDest('')}
        placeholder="Where do you want to go?"
        hasGps={hasGpsLocation}
        disabled={isLoading}
        autoFocus
        inputRef={destRef}
      />

      <div className="flex flex-col gap-1 mt-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Date &amp; Time
        </label>
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            value={dateTimeStr}
            onChange={(e) => setDateTimeStr(e.target.value)}
            disabled={isLoading}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-50"
          />
          <button
            type="button"
            onClick={() => setDateTimeStr(toDateTimeLocal(new Date()))}
            disabled={isLoading}
            title="Reset to current time"
            className="text-xs text-gray-400 hover:text-green-600 px-2 py-2 border border-gray-200 rounded-lg whitespace-nowrap"
          >
            Now
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Shade Priority
        </label>
        <div className="grid grid-cols-3 gap-1">
          {(Object.keys(ROUTE_PRESETS) as RoutePreset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePreset(p)}
              disabled={isLoading}
              className={`flex flex-col items-center py-2 px-1 rounded-lg border text-xs transition-colors ${
                preset === p
                  ? 'border-green-500 bg-green-50 text-green-700 font-semibold'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              <span>{p === 'speed' ? '⚡' : p === 'balanced' ? '⚖️' : '🌿'}</span>
              <span className="mt-0.5">{PRESET_META[p].label}</span>
              <span className="text-gray-400 font-normal">{PRESET_META[p].sub}</span>
            </button>
          ))}
        </div>
        {preset !== 'speed' && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">Max detour</label>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={maxDetour}
              onChange={(e) => setMaxDetour(Number(e.target.value))}
              disabled={isLoading}
              className="flex-1 accent-green-500"
            />
            <span className="text-xs text-gray-600 w-8 text-right">+{maxDetour}%</span>
          </div>
        )}
      </div>

      <Button type="submit" disabled={isLoading || !canSearch} size="lg" className="mt-1">
        {isLoading ? <Spinner className="w-4 h-4 text-white" /> : 'Find Preferred Shade Route'}
      </Button>

      {hasResult && (
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-gray-400 hover:text-gray-600 text-left"
        >
          ✕ Clear route
        </button>
      )}
    </form>
  );
}
