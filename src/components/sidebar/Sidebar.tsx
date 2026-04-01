'use client';

import { useState, useEffect } from 'react';
import { decode } from '@googlemaps/polyline-codec';
import { clsx } from 'clsx';
import { SearchPanel } from './SearchPanel';
import { RouteCard } from './RouteCard';
import { ShadeTimeline } from './ShadeTimeline';
import { WeatherBadge } from './WeatherBadge';
import { Spinner } from '@/components/ui/Spinner';
import { useShadeTimeline } from '@/hooks/useShadeTimeline';
import type { LatLng, RouteOptions, RouteSearchState, ScoredRoute } from '@/types/route';
import type { WeatherData } from '@/lib/weather/fetchWeather';

interface Props {
  searchState: RouteSearchState;
  hasGpsLocation: boolean;
  onSearch: (origin: string | null, destination: string | null, time: Date, options: RouteOptions) => void;
  onSelectRoute: (which: 'fastest' | 'shaded') => void;
  onReset: () => void;
  searchOrigin: LatLng | null;
  searchDest: LatLng | null;
  selectedRoute: ScoredRoute | null;
  mapPickCoord?: LatLng | null;
  weather?: WeatherData | null;
  weatherLoading?: boolean;
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

function buildGoogleMapsUrl(origin: LatLng, dest: LatLng, routingWaypoints?: LatLng[], encodedPolyline?: string): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${dest.lat},${dest.lng}`,
    travelmode: 'walking',
  });

  // Prefer the actual OSRM routing waypoints — these are the exact decision
  // points used to steer the route onto shadier streets, so Google Maps will
  // follow the same path.  Fall back to polyline sampling only when the shaded
  // route has no custom waypoints (i.e. the fastest and shaded routes are the
  // same, or shade optimisation was skipped).
  const wps: LatLng[] =
    routingWaypoints && routingWaypoints.length > 0
      ? routingWaypoints
      : encodedPolyline
        ? samplePolylineWaypoints(encodedPolyline, 4)
        : [];

  if (wps.length > 0) {
    params.set('waypoints', wps.map((w) => `${w.lat},${w.lng}`).join('|'));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function statusLabel(status: string, hasPrelimRoute: boolean, shadowPercent: number | null): string {
  if (status === 'routing') return 'Finding route…';
  if (status === 'scoring') {
    if (!hasPrelimRoute) return 'Calculating shade…';
    if (shadowPercent !== null) return `Loading shadow map… ${shadowPercent}%`;
    return 'Loading shadow map…';
  }
  return 'Working…';
}

function NavigateButton({ origin, dest, route }: { origin: LatLng; dest: LatLng; route: ScoredRoute }) {
  return (
    <a
      href={buildGoogleMapsUrl(origin, dest, route.waypoints, route.encodedPolyline)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
      Navigate in Google Maps
    </a>
  );
}

export function Sidebar({ searchState, hasGpsLocation, onSearch, onSelectRoute, onReset, searchOrigin, searchDest, selectedRoute, mapPickCoord, weather, weatherLoading }: Props) {
  // false = peeked (summary only), true = fully open
  const [sheetOpen, setSheetOpen] = useState(false);

  const isLoading = searchState.status === 'routing' || searchState.status === 'scoring';
  const hasResult = searchState.status === 'done';
  const hasContent = isLoading || hasResult || searchState.status === 'error';

  // Collapse sheet when route is cleared
  useEffect(() => {
    if (!hasContent) setSheetOpen(false);
  }, [hasContent]);

  const timelinePolyline =
    searchState.shadedRoute?.encodedPolyline ?? searchState.fastestRoute?.encodedPolyline ?? null;
  const { timeline, loading: timelineLoading } = useShadeTimeline(timelinePolyline);

  const fastestScore = searchState.fastestRoute?.shadeScore;
  const shadedScore = searchState.shadedRoute?.shadeScore;
  const shadedRoute = searchState.shadedRoute;
  const fastestRoute = searchState.fastestRoute;

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════
          MOBILE LAYOUT  (hidden on md+)
          ════════════════════════════════════════════════════════════════ */}

      {/* Fixed search bar — always visible at top */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
          <span className="text-lg">🌿</span>
          <span className="text-sm font-semibold text-green-700">Prefer Shade</span>
        </div>
        <SearchPanel
          isLoading={isLoading}
          hasGpsLocation={hasGpsLocation}
          onSearch={onSearch}
          onReset={onReset}
          hasResult={hasResult}
          variant="topbar"
          mapPickCoord={mapPickCoord}
        />
        {(weather || weatherLoading) && (
          <div className="px-3 pb-2">
            <WeatherBadge weather={weather ?? null} loading={weatherLoading} />
          </div>
        )}
      </div>

      {/* Backdrop — dims map when sheet is fully open */}
      {sheetOpen && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/20"
          onClick={() => setSheetOpen(false)}
        />
      )}

      {/* Results bottom sheet */}
      {hasContent && (
        <div
          className={clsx(
            'md:hidden fixed bottom-0 left-0 right-0 z-30',
            'bg-white rounded-t-2xl',
            'shadow-[0_-4px_24px_rgba(0,0,0,0.12)]',
            'flex flex-col overflow-hidden',
            'transition-[height] duration-300 ease-out',
            sheetOpen ? 'h-[85vh]' : 'h-28',
          )}
        >
          {/* Drag handle — tap toggles peek ↔ full */}
          <button
            className="flex-shrink-0 w-full flex justify-center pt-2.5 pb-1 touch-none"
            onClick={() => setSheetOpen((v) => !v)}
            aria-label={sheetOpen ? 'Collapse panel' : 'Expand panel'}
          >
            <span className="w-10 h-1 rounded-full bg-gray-300" />
          </button>

          {/* Peek summary row — always visible */}
          <div className="flex-shrink-0 px-4 pb-3 flex items-center min-h-[56px]">
            {isLoading ? (
              <div className="flex items-center gap-2.5 text-sm text-gray-500">
                <Spinner className="w-4 h-4 text-green-500" />
                <span>{statusLabel(searchState.status, !!searchState.fastestRoute, searchState.shadowPercent ?? null)}</span>
              </div>
            ) : searchState.status === 'error' ? (
              <p className="text-sm text-red-600 flex-1">{searchState.error}</p>
            ) : hasResult && shadedRoute ? (
              <div className="flex items-center w-full gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-lg font-bold text-green-700">{shadedRoute.shadeScore}%</span>
                  <span className="text-sm text-gray-400 ml-1">shade</span>
                  <span className="mx-2 text-gray-300">·</span>
                  <span className="text-sm font-medium text-gray-700">
                    {Math.round(shadedRoute.durationSeconds / 60)} min
                  </span>
                  <span className="mx-2 text-gray-300">·</span>
                  <span className="text-sm text-gray-400">
                    {(shadedRoute.distanceMeters / 1000).toFixed(1)} km
                  </span>
                </div>
                <button
                  onClick={() => setSheetOpen((v) => !v)}
                  className={clsx(
                    'flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors',
                    sheetOpen
                      ? 'text-gray-400 hover:text-gray-600'
                      : 'text-green-700 bg-green-50 hover:bg-green-100',
                  )}
                >
                  {sheetOpen ? '' : 'Details'}
                  <svg
                    className={clsx('w-4 h-4 transition-transform duration-300', sheetOpen && 'rotate-180')}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
              </div>
            ) : null}
          </div>

          {/* Full detail content — scrollable, only reachable when open */}
          <div className="flex-1 overflow-y-auto px-4 pb-8 flex flex-col gap-4 min-h-0">
            {hasResult && shadedRoute && fastestRoute && (
              <div className="flex flex-col gap-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Route Options
                </span>
                <RouteCard
                  route={shadedRoute}
                  isSelected={searchState.selectedRoute === 'shaded'}
                  onSelect={() => onSelectRoute('shaded')}
                  comparedShadeScore={fastestScore}
                />
                {fastestRoute.encodedPolyline !== shadedRoute.encodedPolyline && (
                  <RouteCard
                    route={fastestRoute}
                    isSelected={searchState.selectedRoute === 'fastest'}
                    onSelect={() => onSelectRoute('fastest')}
                    comparedShadeScore={shadedScore}
                  />
                )}
              </div>
            )}

            {hasResult && searchOrigin && searchDest && selectedRoute && (
              <NavigateButton
                origin={searchOrigin}
                dest={searchDest}
                route={selectedRoute}
              />
            )}

            <ShadeTimeline timeline={timeline} loading={timelineLoading} hasRoute={hasResult} />

            {hasResult && (
              <p className="text-xs text-gray-400 text-center">
                Shadow data from OSM buildings + real-time sun position
              </p>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          DESKTOP SIDEBAR  (hidden below md)
          ════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col z-20 absolute left-4 top-4 bottom-4 w-80 bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* Slim brand strip */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
          >
            <span className="text-xl leading-none">🌿</span>
            <span className="font-bold text-green-700 text-sm tracking-tight">Prefer Shade</span>
          </button>
          <span className="ml-auto text-xs text-gray-300">shadow routing</span>
        </div>

        {/* Search section */}
        <div className="px-4 pt-4 pb-3 flex-shrink-0 border-b border-gray-100">
          <SearchPanel
            isLoading={isLoading}
            hasGpsLocation={hasGpsLocation}
            onSearch={onSearch}
            onReset={onReset}
            hasResult={hasResult}
            mapPickCoord={mapPickCoord}
          />
          {(weather || weatherLoading) && (
            <div className="mt-2">
              <WeatherBadge weather={weather ?? null} loading={weatherLoading} />
            </div>
          )}
        </div>

        {/* Results section — scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* Status / error */}
          {(isLoading || searchState.status === 'error') && (
            <div className="px-4 py-3">
              {isLoading && (
                <div className="flex items-center gap-2.5 text-sm text-gray-500">
                  <Spinner className="w-4 h-4 text-green-500" />
                  <span>{statusLabel(searchState.status, !!searchState.fastestRoute, searchState.shadowPercent ?? null)}</span>
                </div>
              )}
              {searchState.status === 'error' && searchState.error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                  {searchState.error}
                </div>
              )}
            </div>
          )}

          {/* Route cards */}
          {hasResult && shadedRoute && fastestRoute && (
            <div className="px-4 pt-4 flex flex-col gap-2.5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Route Options</p>
              <RouteCard
                route={shadedRoute}
                isSelected={searchState.selectedRoute === 'shaded'}
                onSelect={() => onSelectRoute('shaded')}
                comparedShadeScore={fastestScore}
              />
              {fastestRoute.encodedPolyline !== shadedRoute.encodedPolyline && (
                <RouteCard
                  route={fastestRoute}
                  isSelected={searchState.selectedRoute === 'fastest'}
                  onSelect={() => onSelectRoute('fastest')}
                  comparedShadeScore={shadedScore}
                />
              )}
            </div>
          )}

          {/* Navigate */}
          {hasResult && searchOrigin && searchDest && selectedRoute && (
            <div className="px-4 pt-3">
              <NavigateButton
                origin={searchOrigin}
                dest={searchDest}
                route={selectedRoute}
              />
            </div>
          )}

          {/* Shade timeline */}
          {(hasResult || timelineLoading) && (
            <div className="px-4 pt-3 pb-4">
              <ShadeTimeline timeline={timeline} loading={timelineLoading} hasRoute={hasResult} />
            </div>
          )}

          {/* Disclaimer */}
          {hasResult && (
            <p className="px-4 pb-4 text-xs text-gray-400 text-center">
              Shadow data from OSM buildings + real-time sun position
            </p>
          )}
        </div>
      </div>
    </>
  );
}
