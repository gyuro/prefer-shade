'use client';

import { useCallback, useState, useRef } from 'react';
import { MapApp } from '@/components/map/MapApp';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useRouteSearch } from '@/hooks/useRouteSearch';
import { useWeather } from '@/hooks/useWeather';
import { fetchWeather } from '@/lib/weather/fetchWeather';
import { geocodeAddress } from '@/lib/utils/geocode';
import type { LatLng, RouteOptions } from '@/types/route';

const DEFAULT_CENTER: LatLng = { lat: 37.7749, lng: -122.4194 };

export default function ShadeApp() {
  const { location, isLocating } = useUserLocation();
  const routeSearch = useRouteSearch();
  const [searchOrigin, setSearchOrigin] = useState<LatLng | null>(null);
  const [searchDest, setSearchDest] = useState<LatLng | null>(null);
  const [searchTime, setSearchTime] = useState<Date | null>(null);
  // Coordinate from a map long-press — forwarded to whichever search field is focused
  const [mapPickCoord, setMapPickCoord] = useState<LatLng | null>(null);
  // Brief toast message for map long-press feedback
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const weatherCoord = searchDest ?? searchOrigin ?? location;
  const { weather, loading: weatherLoading } = useWeather(weatherCoord, searchTime);

  const center = location ?? DEFAULT_CENTER;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const handleSearch = useCallback(
    async (originText: string | null, destinationText: string | null, time: Date, options: RouteOptions) => {
      try {
        // Geocode origin + dest in parallel
        const [origin, dest] = await Promise.all([
          originText ? geocodeAddress(originText) : Promise.resolve(location),
          destinationText ? geocodeAddress(destinationText) : Promise.resolve(location),
        ]);
        if (!origin) throw new Error('Could not determine your starting location.');
        if (!dest) throw new Error('Could not determine your destination.');

        setSearchOrigin(origin);
        setSearchDest(dest);
        setSearchTime(time);

        // Fetch weather directly for the chosen dest+time so the selected date
        // is always applied. Using the hook's `weather` value here would be stale
        // because setSearchTime() only schedules a re-render, not an immediate fetch.
        const freshWeather = await fetchWeather(dest.lat, dest.lng, time);

        await routeSearch.search(origin, dest, time, options, freshWeather);
      } catch (err) {
        routeSearch.setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
    },
    [location, routeSearch]
  );

  const handleReset = useCallback(() => {
    routeSearch.reset();
    setSearchOrigin(null);
    setSearchDest(null);
    setSearchTime(null);
  }, [routeSearch]);

  const selectedRoute =
    routeSearch.selectedRoute === 'shaded'
      ? routeSearch.shadedRoute
      : routeSearch.fastestRoute;

  return (
    <div className="relative w-full h-screen">
      <MapApp
        shadows={routeSearch.shadows}
        fastestRoute={routeSearch.fastestRoute}
        shadedRoute={routeSearch.shadedRoute}
        selectedRoute={routeSearch.selectedRoute}
        origin={searchOrigin}
        destination={searchDest}
        center={center}
        userLocation={location}
        onLongPress={(coord) => {
          setMapPickCoord({ ...coord });
          showToast('📍 Location picked');
        }}
      />

      <Sidebar
        searchState={routeSearch}
        hasGpsLocation={!!location}
        onSearch={handleSearch}
        onSelectRoute={routeSearch.selectRoute}
        onReset={handleReset}
        searchOrigin={searchOrigin}
        searchDest={searchDest}
        selectedRoute={selectedRoute}
        mapPickCoord={mapPickCoord}
        weather={weather}
        weatherLoading={weatherLoading}
      />

      {/* Shadow map loading progress pill */}
      {routeSearch.shadowPercent !== null && (
        <div className="absolute top-36 md:top-5 left-1/2 md:left-[58%] -translate-x-1/2 z-40 pointer-events-none">
          <div className="bg-gray-900/85 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-full shadow-lg flex items-center gap-2.5">
            <span className="opacity-75 text-sm">🌘</span>
            <span className="opacity-80 whitespace-nowrap">Loading shadow map</span>
            <div className="w-20 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-200 ease-out"
                style={{ width: `${routeSearch.shadowPercent}%` }}
              />
            </div>
            <span className="tabular-nums w-7 text-right opacity-90 font-medium">
              {routeSearch.shadowPercent}%
            </span>
          </div>
        </div>
      )}

      {/* Long-press feedback toast */}
      {toast && (
        <div className="absolute top-24 md:top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800/90 text-white text-sm px-4 py-2 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {isLocating && (
        <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 bg-white text-gray-600 text-xs px-3 py-2 rounded-full shadow-md flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Getting your location...
        </div>
      )}
    </div>
  );
}
