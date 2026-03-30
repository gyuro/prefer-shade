'use client';

import { useState, useEffect } from 'react';
import { decode } from '@googlemaps/polyline-codec';
import { clsx } from 'clsx';
import { SearchPanel } from './SearchPanel';
import { RouteCard } from './RouteCard';
import { ShadeTimeline } from './ShadeTimeline';
import { Spinner } from '@/components/ui/Spinner';
import { useShadeTimeline } from '@/hooks/useShadeTimeline';
import type { LatLng, RouteOptions, RouteSearchState, ScoredRoute } from '@/types/route';

interface Props {
  searchState: RouteSearchState;
  hasGpsLocation: boolean;
  onSearch: (origin: string | null, destination: string | null, time: Date, options: RouteOptions) => void;
  onSelectRoute: (which: 'fastest' | 'shaded') => void;
  onReset: () => void;
  searchOrigin: LatLng | null;
  searchDest: LatLng | null;
  selectedRoute: ScoredRoute | null;
}

function samplePolylineWaypoints(encodedPolyline: string, count: number): LatLng[] {
  const coords = decode(encodedPolyline, 5);
  if (coords.length < 3 || count < 1) return [];
  const interior = coords.slice(1, -1);
  if (interior.length === 0) return [];
  const step = interior.length / (count + 1);
  const result: LatLng[] = [];
  for (let i = 1; i <= count; i++) {
    const idx = Math.min(Math.round(i * step), interior.length - 1);
    const [lat, lng] = interior[idx];
    result.push({ lat, lng });
  }
  return result;
}

function buildGoogleMapsUrl(origin: LatLng, dest: LatLng, encodedPolyline?: string): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${dest.lat},${dest.lng}`,
    travelmode: 'walking',
  });
  if (encodedPolyline) {
    const wps = samplePolylineWaypoints(encodedPolyline, 4);
    if (wps.length > 0) {
      params.set('waypoints', wps.map((w) => `${w.lat},${w.lng}`).join('|'));
    }
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

const STATUS_LABELS: Record<string, string> = {
  routing: 'Finding routes...',
  scoring: 'Calculating shade coverage...',
};

export function Sidebar({ searchState, hasGpsLocation, onSearch, onSelectRoute, onReset, searchOrigin, searchDest, selectedRoute }: Props) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  // Track whether we're on a small screen (< md = 768px)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const isLoading = searchState.status === 'routing' || searchState.status === 'scoring';
  const hasResult = searchState.status === 'done';

  // Auto-expand on mobile when results arrive
  useEffect(() => {
    if (hasResult) setMobileExpanded(true);
  }, [hasResult]);

  // Collapse on mobile when route is cleared
  useEffect(() => {
    if (!hasResult && !isLoading) setMobileExpanded(false);
  }, [hasResult, isLoading]);

  const timelinePolyline =
    searchState.shadedRoute?.encodedPolyline ?? searchState.fastestRoute?.encodedPolyline ?? null;
  const { timeline, loading: timelineLoading } = useShadeTimeline(timelinePolyline);

  const fastestScore = searchState.fastestRoute?.shadeScore;
  const shadedScore = searchState.shadedRoute?.shadeScore;

  // On mobile when collapsed, hide date/time and options to save space
  const compactSearch = isMobile && !mobileExpanded;

  return (
    <>
      {/* Tap-away backdrop on mobile */}
      {isMobile && mobileExpanded && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setMobileExpanded(false)}
        />
      )}

      <div className={clsx(
        'bg-white flex flex-col z-20',
        // ── Mobile: bottom sheet ──────────────────────────────────────────────
        'fixed bottom-0 left-0 right-0 rounded-t-2xl',
        'shadow-[0_-2px_20px_rgba(0,0,0,0.13)]',
        'transition-[height] duration-300 ease-out',
        mobileExpanded ? 'h-[85vh]' : 'h-64',
        // ── Desktop (md+): left sidebar — overrides mobile styles ─────────────
        'md:absolute md:left-4 md:top-4 md:bottom-4 md:right-auto md:w-80',
        'md:h-auto md:rounded-2xl md:shadow-xl md:transition-none',
      )}>

        {/* ── Mobile drag handle ──────────────────────────────────────────── */}
        <button
          className="md:hidden flex-shrink-0 w-full flex flex-col items-center pt-2.5 pb-1 touch-none"
          onClick={() => setMobileExpanded((v) => !v)}
          aria-label={mobileExpanded ? 'Collapse panel' : 'Expand panel'}
        >
          <span className="w-9 h-1 rounded-full bg-gray-300" />
          <span className="mt-1 text-[10px] text-gray-400 font-medium">
            {mobileExpanded ? '▼ collapse' : '▲ expand'}
          </span>
        </button>

        {/* ── Header — hidden on mobile when collapsed ───────────────────── */}
        <div className={clsx(
          'bg-gradient-to-br from-green-600 to-green-700 p-5 flex-shrink-0',
          !mobileExpanded && 'hidden md:block',
        )}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🌿</span>
            <h1 className="text-lg font-bold text-white">Prefer Shade</h1>
          </div>
          <p className="text-green-100 text-xs">Walk in the shade, not the sun</p>
        </div>

        {/* ── Scrollable content ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0">
          <SearchPanel
            isLoading={isLoading}
            hasGpsLocation={hasGpsLocation}
            onSearch={onSearch}
            onReset={onReset}
            hasResult={hasResult}
            compact={compactSearch}
          />

          {/* Results — hidden on mobile when collapsed */}
          {(!isMobile || mobileExpanded) && (
            <>
              {isLoading && (
                <div className="flex items-center gap-3 text-sm text-gray-500 py-2">
                  <Spinner className="w-4 h-4 text-green-500" />
                  <span>{STATUS_LABELS[searchState.status] ?? 'Working...'}</span>
                </div>
              )}

              {searchState.status === 'error' && searchState.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {searchState.error}
                </div>
              )}

              {hasResult && searchState.shadedRoute && searchState.fastestRoute && (
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Route Options
                  </span>
                  <RouteCard
                    route={searchState.shadedRoute}
                    isSelected={searchState.selectedRoute === 'shaded'}
                    onSelect={() => onSelectRoute('shaded')}
                    comparedShadeScore={fastestScore}
                  />
                  {searchState.fastestRoute.encodedPolyline !== searchState.shadedRoute.encodedPolyline && (
                    <RouteCard
                      route={searchState.fastestRoute}
                      isSelected={searchState.selectedRoute === 'fastest'}
                      onSelect={() => onSelectRoute('fastest')}
                      comparedShadeScore={shadedScore}
                    />
                  )}
                </div>
              )}

              {hasResult && searchOrigin && searchDest && (
                <a
                  href={buildGoogleMapsUrl(searchOrigin, searchDest, selectedRoute?.encodedPolyline)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Navigate in Google Maps
                </a>
              )}

              <ShadeTimeline
                timeline={timeline}
                loading={timelineLoading}
                hasRoute={hasResult}
              />

              {hasResult && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700">
                  <span className="font-semibold">Shadow data</span> computed from OSM buildings +
                  real-time sun position.
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer — desktop only ──────────────────────────────────────── */}
        <div className="hidden md:block px-4 py-3 border-t border-gray-100 text-xs text-gray-400 text-center flex-shrink-0">
          Prefer Shade · Shadow-driven navigation
        </div>
      </div>
    </>
  );
}
