'use client';

import { SearchPanel } from './SearchPanel';
import { RouteCard } from './RouteCard';
import { ShadeTimeline } from './ShadeTimeline';
import { Spinner } from '@/components/ui/Spinner';
import { useShadeTimeline } from '@/hooks/useShadeTimeline';
import type { RouteSearchState, ScoredRoute, LatLng } from '@/types/route';

interface Props {
  searchState: RouteSearchState;
  location: LatLng | null;
  hasGpsLocation: boolean;
  onSearch: (origin: string | null, destination: string | null, time: Date) => void;
  onSelectRoute: (which: 'fastest' | 'shaded') => void;
  onReset: () => void;
  searchOrigin: LatLng | null;
  searchDest: LatLng | null;
  selectedRoute: ScoredRoute | null;
}

function buildGoogleMapsUrl(
  origin: LatLng,
  dest: LatLng,
  waypoints?: LatLng[]
): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${dest.lat},${dest.lng}`,
    travelmode: 'walking',
  });
  if (waypoints && waypoints.length > 0) {
    params.set('waypoints', waypoints.map((w) => `${w.lat},${w.lng}`).join('|'));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

const STATUS_LABELS: Record<string, string> = {
  routing: 'Finding routes...',
  scoring: 'Calculating shade coverage...',
};

export function Sidebar({ searchState, location, hasGpsLocation, onSearch, onSelectRoute, onReset, searchOrigin, searchDest, selectedRoute }: Props) {
  const isLoading = searchState.status === 'routing' || searchState.status === 'scoring';
  const hasResult = searchState.status === 'done';

  const timelinePolyline =
    searchState.shadedRoute?.encodedPolyline ?? searchState.fastestRoute?.encodedPolyline ?? null;
  const { timeline, loading: timelineLoading, load: loadTimeline } = useShadeTimeline(
    timelinePolyline,
    location
  );

  const fastestScore = searchState.fastestRoute?.shadeScore;
  const shadedScore = searchState.shadedRoute?.shadeScore;

  return (
    <div className="absolute left-4 top-4 bottom-4 w-80 bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col z-10">
      {/* Header */}
      <div className="bg-gradient-to-br from-green-600 to-green-700 p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🌿</span>
          <h1 className="text-lg font-bold text-white">Shade Route</h1>
        </div>
        <p className="text-green-100 text-xs">Walk in the shade, not the sun</p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <SearchPanel
          isLoading={isLoading}
          hasGpsLocation={hasGpsLocation}
          onSearch={onSearch}
          onReset={onReset}
          hasResult={hasResult}
        />

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

        {/* Navigate button — opens selected route in Google Maps */}
        {hasResult && searchOrigin && searchDest && (
          <a
            href={buildGoogleMapsUrl(searchOrigin, searchDest, selectedRoute?.waypoints)}
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

        {/* Timeline — lazy, user-triggered */}
        <ShadeTimeline
          timeline={timeline}
          loading={timelineLoading}
          onLoad={loadTimeline}
          hasRoute={hasResult}
        />

        {hasResult && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700">
            <span className="font-semibold">Shadow data</span> computed from OSM buildings +
            real-time sun position.
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
        Shade Route · Shadow-driven navigation
      </div>
    </div>
  );
}
