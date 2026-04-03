'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { reverseGeocodeLatLng } from '@/lib/utils/geocode';
import { ROUTE_PRESETS, type RouteOptions, type RoutePreset, type LatLng } from '@/types/route';

/** Sentinel stored in field state when GPS mode is active for that field */
const GPS = '__GPS__';

function toDateTimeLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatTimeShort(d: Date): string {
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const isTomorrow = d.toDateString() === new Date(today.getTime() + 86400000).toDateString();
  const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today ${t}`;
  if (isTomorrow) return `Tomorrow ${t}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` ${t}`;
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
  onSearch: (origin: string | null, destination: string | null, stops: string[], time: Date, options: RouteOptions) => void;
  onReset: () => void;
  hasResult: boolean;
  /**
   * 'sidebar' (default) — full panel with date/time and routing options
   * 'topbar'            — compact two-field bar for mobile top strip
   */
  variant?: 'sidebar' | 'topbar';
  /** Coordinate picked by long-pressing the map — fills whichever field was last focused */
  mapPickCoord?: LatLng | null;
}

interface FieldProps {
  label?: string;
  icon: string;
  value: string;
  onChange: (v: string) => void;
  onGps: () => void;
  onClearGps: () => void;
  onFieldFocus?: () => void;
  placeholder: string;
  hasGps: boolean;
  disabled: boolean;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

function LocationField({
  label, icon, value, onChange, onGps, onClearGps, onFieldFocus,
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
            onFocus={() => { onFieldFocus?.(); if (suggestions.length > 0) setOpen(true); }}
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

export function SearchPanel({ isLoading, hasGpsLocation, onSearch, onReset, hasResult, variant = 'sidebar', mapPickCoord }: Props) {
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('');
  // isNow=true means always use new Date() at submit time, so time never goes stale
  const [isNow, setIsNow] = useState(true);
  const [dateTimeStr, setDateTimeStr] = useState(() => toDateTimeLocal(new Date()));
  const [preset, setPreset] = useState<RoutePreset>('balanced');
  const [maxDetour, setMaxDetour] = useState(ROUTE_PRESETS.balanced.maxDetourPct);
  const [showOptions, setShowOptions] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [stops, setStops] = useState<string[]>([]);
  const destRef = useRef<HTMLInputElement | null>(null);
  const lastFocusedField = useRef<'origin' | 'destination'>('destination');

  const addStop = () => setStops((s) => [...s, '']);
  const removeStop = (i: number) => setStops((s) => s.filter((_, idx) => idx !== i));
  const updateStop = (i: number, v: string) => setStops((s) => s.map((x, idx) => idx === i ? v : x));

  // When the map sends a picked coordinate, reverse-geocode it into the best field.
  // Priority: fill the empty field first (dest preferred), then fall back to
  // whichever field the user last explicitly focused.
  useEffect(() => {
    if (!mapPickCoord) return;
    const destEmpty = !dest.trim();
    const originEmpty = !origin.trim() && origin !== GPS;
    let field: 'origin' | 'destination';
    if (destEmpty) field = 'destination';
    else if (originEmpty) field = 'origin';
    else field = lastFocusedField.current;
    const setter = field === 'origin' ? setOrigin : setDest;
    setter('Locating…');
    reverseGeocodeLatLng(mapPickCoord.lat, mapPickCoord.lng).then(setter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapPickCoord]);

  const handlePreset = (p: RoutePreset) => {
    setPreset(p);
    setMaxDetour(ROUTE_PRESETS[p].maxDetourPct);
  };

  // Auto-collapse the topbar when a result arrives; don't focus (avoids mobile keyboard)
  useEffect(() => {
    if (variant === 'topbar' && hasResult) {
      setCollapsed(true);
    }
  }, [hasResult, variant]);

  // Auto-focus dest only when there's no result yet (e.g. fresh load or after clear)
  useEffect(() => {
    if (!isLoading && !hasResult) {
      requestAnimationFrame(() => destRef.current?.focus());
    }
  }, [isLoading, hasResult]);

  const handleSwap = () => {
    // If origin was empty (implicit GPS via hasGpsLocation), convert to the
    // GPS sentinel before swapping so dest stays valid for canSearch.
    const effectiveOrigin = origin === '' && hasGpsLocation ? GPS : origin;
    setOrigin(dest);
    setDest(effectiveOrigin);
  };

  const setNow = () => {
    setIsNow(true);
    setDateTimeStr(toDateTimeLocal(new Date()));
    setShowTimePicker(false);
  };

  const handleDateTimeChange = (v: string) => {
    setDateTimeStr(v);
    setIsNow(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasOrigin = origin === GPS || !!origin.trim();
    const hasDest = dest === GPS || !!dest.trim();
    if (!hasDest) return;
    if (!hasOrigin && !hasGpsLocation) return;

    // Always use fresh Date() when "Now" mode is active
    const time = isNow ? new Date() : new Date(dateTimeStr);
    const options: RouteOptions = {
      maxDetourPct: maxDetour,
      minShadeGain: ROUTE_PRESETS[preset].minShadeGain,
    };
    onSearch(
      origin === GPS ? null : (origin.trim() || null),
      dest === GPS ? null : dest.trim(),
      stops.map((s) => s.trim()),
      isNaN(time.getTime()) ? new Date() : time,
      options
    );
  };

  const handleClear = () => {
    onReset();
    setOrigin('');
    setDest('');
    setStops([]);
    setIsNow(true);
    setDateTimeStr(toDateTimeLocal(new Date()));
    setShowTimePicker(false);
    setCollapsed(false);
  };

  const canSearch =
    (dest === GPS || !!dest.trim()) &&
    (origin === GPS || !!origin.trim() || hasGpsLocation) &&
    stops.every((s) => !!s.trim());

  // ── Topbar variant (mobile fixed top bar) ───────────────────────────────
  if (variant === 'topbar') {
    // Collapsed: show a compact summary row — tap to re-open search
    if (collapsed) {
      return (
        <div className="px-3 py-2">
          <button
            type="button"
            onClick={() => {
              setCollapsed(false);
              requestAnimationFrame(() => destRef.current?.focus());
            }}
            className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <span className="flex-1 text-left truncate">
              {dest || origin || 'Search again…'}
            </span>
            <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="px-3 py-2 flex flex-col gap-1.5">
        {/* Origin row + swap button */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <LocationField
              icon="📍"
              value={origin}
              onChange={setOrigin}
              onGps={() => setOrigin(GPS)}
              onClearGps={() => setOrigin('')}
              onFieldFocus={() => { lastFocusedField.current = 'origin'; }}
              placeholder={hasGpsLocation ? 'Current location' : 'Starting point'}
              hasGps={hasGpsLocation}
              disabled={isLoading}
            />
          </div>
          <button
            type="button"
            onClick={handleSwap}
            disabled={isLoading || stops.length > 0}
            title="Swap origin and destination"
            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* Intermediate stop rows */}
        {stops.map((stop, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <LocationField
                icon="○"
                value={stop}
                onChange={(v) => updateStop(i, v)}
                onGps={() => updateStop(i, GPS)}
                onClearGps={() => updateStop(i, '')}
                placeholder={`Stop ${i + 1}`}
                hasGps={hasGpsLocation}
                disabled={isLoading}
              />
            </div>
            <button
              type="button"
              onClick={() => removeStop(i)}
              disabled={isLoading}
              title="Remove stop"
              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 rounded-full transition-colors disabled:opacity-30"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        {/* Destination row + time toggle + options toggle + submit */}
        <div className="flex gap-1.5">
          <div className="flex-1 min-w-0">
            <LocationField
              icon="🔴"
              value={dest}
              onChange={setDest}
              onGps={() => setDest(GPS)}
              onClearGps={() => setDest('')}
              onFieldFocus={() => { lastFocusedField.current = 'destination'; }}
              placeholder="Where to?"
              hasGps={hasGpsLocation}
              disabled={isLoading}
              autoFocus
              inputRef={destRef}
            />
          </div>

          {/* Time toggle — blue when a future time is set */}
          <button
            type="button"
            onClick={() => { setShowTimePicker((v) => !v); setShowOptions(false); }}
            disabled={isLoading}
            title={isNow ? 'Depart now' : formatTimeShort(new Date(dateTimeStr))}
            className={`flex-shrink-0 w-9 rounded-lg border transition-colors flex items-center justify-center text-base ${
              isNow
                ? 'border-gray-200 text-gray-400 bg-white hover:text-gray-600'
                : 'border-blue-400 text-blue-600 bg-blue-50'
            }`}
          >
            🕐
          </button>

          {/* Options toggle */}
          <button
            type="button"
            onClick={() => { setShowOptions((v) => !v); setShowTimePicker(false); }}
            disabled={isLoading}
            title="Route options"
            className={`flex-shrink-0 w-9 rounded-lg border transition-colors flex items-center justify-center ${
              showOptions
                ? 'border-green-400 text-green-700 bg-green-50'
                : 'border-gray-200 text-gray-400 bg-white hover:text-gray-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>

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

        {/* Expanded time picker row */}
        {showTimePicker && (
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={dateTimeStr}
              onChange={(e) => handleDateTimeChange(e.target.value)}
              disabled={isLoading}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
            />
            <button
              type="button"
              onClick={setNow}
              disabled={isLoading}
              className={`text-xs px-2.5 py-1.5 border rounded-lg whitespace-nowrap transition-colors ${
                isNow
                  ? 'border-green-400 bg-green-50 text-green-700 font-semibold'
                  : 'border-gray-200 text-gray-400 hover:text-green-600 bg-white'
              }`}
            >
              Now
            </button>
          </div>
        )}

        {/* Inline time chip when a future time is set but picker is closed */}
        {!isNow && !showTimePicker && !showOptions && (
          <button
            type="button"
            onClick={() => setShowTimePicker(true)}
            className="text-xs text-blue-600 self-start hover:underline"
          >
            📅 {formatTimeShort(new Date(dateTimeStr))}
          </button>
        )}

        {/* Options panel */}
        {showOptions && (
          <div className="flex flex-col gap-2.5 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500">Shade Priority</label>
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(ROUTE_PRESETS) as RoutePreset[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePreset(p)}
                    disabled={isLoading}
                    className={`flex flex-col items-center py-1.5 px-1 rounded-lg border text-xs transition-colors ${
                      preset === p
                        ? 'border-green-500 bg-green-50 text-green-700 font-semibold'
                        : 'border-gray-200 bg-white text-gray-500'
                    }`}
                  >
                    <span>{p === 'speed' ? '⚡' : p === 'balanced' ? '⚖️' : '🌿'}</span>
                    <span className="mt-0.5">{PRESET_META[p].label}</span>
                  </button>
                ))}
              </div>
            </div>
            {preset !== 'speed' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 whitespace-nowrap">Max detour</span>
                <input
                  type="range" min={5} max={50} step={5}
                  value={maxDetour}
                  onChange={(e) => setMaxDetour(Number(e.target.value))}
                  disabled={isLoading}
                  className="flex-1 accent-green-500"
                />
                <span className="text-xs text-gray-600 w-8 text-right">+{maxDetour}%</span>
              </div>
            )}
          </div>
        )}

        {!hasGpsLocation && origin !== GPS && !origin.trim() && (
          <p className="text-xs text-amber-600">GPS unavailable — enter a starting address</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={addStop}
            disabled={isLoading}
            className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-40 flex items-center gap-0.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add stop
          </button>
          {hasResult && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ✕ Clear route
            </button>
          )}
        </div>
      </form>
    );
  }

  // ── Sidebar variant (desktop full panel) ────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {/* Location fields */}
      <div className="flex flex-col">
        <LocationField
          icon="📍"
          value={origin}
          onChange={setOrigin}
          onGps={() => setOrigin(GPS)}
          onClearGps={() => setOrigin('')}
          onFieldFocus={() => { lastFocusedField.current = 'origin'; }}
          placeholder={hasGpsLocation ? 'Current location' : 'Starting point'}
          hasGps={hasGpsLocation}
          disabled={isLoading}
        />

        {/* Connector line + swap button (swap hidden when stops present) */}
        <div className="flex items-center py-0.5 pl-2.5">
          <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
          {stops.length === 0 && (
            <button
              type="button"
              onClick={handleSwap}
              disabled={isLoading || (!origin && !dest)}
              title="Swap origin and destination"
              className="ml-auto p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          )}
        </div>

        {/* Intermediate stops */}
        {stops.map((stop, i) => (
          <div key={i}>
            <div className="flex items-center gap-1">
              <div className="flex-1 min-w-0">
                <LocationField
                  icon="○"
                  value={stop}
                  onChange={(v) => updateStop(i, v)}
                  onGps={() => updateStop(i, GPS)}
                  onClearGps={() => updateStop(i, '')}
                  placeholder={`Stop ${i + 1}`}
                  hasGps={hasGpsLocation}
                  disabled={isLoading}
                />
              </div>
              <button
                type="button"
                onClick={() => removeStop(i)}
                disabled={isLoading}
                title="Remove stop"
                className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 rounded-full transition-colors disabled:opacity-30"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="py-0.5 pl-2.5">
              <div className="w-px h-4 bg-gray-200" />
            </div>
          </div>
        ))}

        <LocationField
          icon="🔴"
          value={dest}
          onChange={setDest}
          onGps={() => setDest(GPS)}
          onClearGps={() => setDest('')}
          onFieldFocus={() => { lastFocusedField.current = 'destination'; }}
          placeholder="Where do you want to go?"
          hasGps={hasGpsLocation}
          disabled={isLoading}
          autoFocus
          inputRef={destRef}
        />

        {/* Add stop button */}
        <button
          type="button"
          onClick={addStop}
          disabled={isLoading}
          className="mt-1.5 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-40 self-start"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add stop
        </button>
      </div>

      {!hasGpsLocation && origin !== GPS && !origin.trim() && (
        <p className="text-xs text-amber-600">GPS unavailable — enter a starting address</p>
      )}

      {/* Date & Time — always visible, not hidden in Options */}
      <div className="flex items-center gap-2">
        <input
          type="datetime-local"
          value={dateTimeStr}
          onChange={(e) => handleDateTimeChange(e.target.value)}
          disabled={isLoading}
          className={`flex-1 text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-100 transition-colors ${
            isNow ? 'bg-gray-50 text-gray-400 border-gray-200' : 'bg-white text-gray-700 border-blue-300'
          }`}
        />
        <button
          type="button"
          onClick={setNow}
          disabled={isLoading}
          className={`text-xs px-2.5 py-1.5 border rounded-lg whitespace-nowrap transition-colors ${
            isNow
              ? 'border-green-400 bg-green-50 text-green-700 font-semibold'
              : 'border-gray-200 text-gray-400 hover:text-green-600 bg-white'
          }`}
        >
          Now
        </button>
      </div>

      {/* Submit */}
      <Button type="submit" disabled={isLoading || !canSearch} size="lg" className="w-full mt-1">
        {isLoading ? <Spinner className="w-4 h-4 text-white" /> : 'Find Shade Route'}
      </Button>

      {hasResult && (
        <button type="button" onClick={handleClear} className="text-xs text-gray-400 hover:text-gray-600 text-center">
          ✕ Clear route
        </button>
      )}

      {/* Collapsible options (shade priority + detour slider) */}
      <button
        type="button"
        onClick={() => setShowOptions((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1 self-start"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Options
        <svg className={`w-3 h-3 transition-transform ${showOptions ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showOptions && (
        <div className="flex flex-col gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500">Shade Priority</label>
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
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500 whitespace-nowrap">Max detour</span>
                <input
                  type="range" min={5} max={50} step={5}
                  value={maxDetour}
                  onChange={(e) => setMaxDetour(Number(e.target.value))}
                  disabled={isLoading}
                  className="flex-1 accent-green-500"
                />
                <span className="text-xs text-gray-600 w-8 text-right">+{maxDetour}%</span>
              </div>
            )}
          </div>

        </div>
      )}
    </form>
  );
}
