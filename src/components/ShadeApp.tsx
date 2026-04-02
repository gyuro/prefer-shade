'use client';

import { useCallback, useState, useRef } from 'react';
import { MapApp } from '@/components/map/MapApp';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { NavigationHUD } from '@/components/navigation/NavigationHUD';
import { NavigationProvider, useNavigationContext } from '@/context/NavigationContext';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useRouteSearch } from '@/hooks/useRouteSearch';
import { useWeather } from '@/hooks/useWeather';
import { fetchWeather, type WeatherData } from '@/lib/weather/fetchWeather';
import { geocodeAddress } from '@/lib/utils/geocode';
import type { LatLng, RouteOptions } from '@/types/route';

const DEFAULT_CENTER: LatLng = { lat: 37.7749, lng: -122.4194 };

function ShadeAppInner() {
  const { location, isLocating } = useUserLocation();
  const routeSearch = useRouteSearch();
  const { session, start: startNav } = useNavigationContext();
  const [searchOrigin, setSearchOrigin] = useState<LatLng | null>(null);
  const [searchDest, setSearchDest] = useState<LatLng | null>(null);
  const [mapPickCoord, setMapPickCoord] = useState<LatLng | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [searchWeather, setSearchWeather] = useState<WeatherData | null>(null);
  const [searchWeatherLoading, setSearchWeatherLoading] = useState(false);

  const ambientCoord = searchDest ?? searchOrigin ?? location;
  const { weather: ambientWeather, loading: ambientLoading } = useWeather(ambientCoord);

  const displayWeather = searchWeather ?? ambientWeather;
  const displayWeatherLoading = searchWeatherLoading || (!searchWeather && ambientLoading);

  const center = location ?? DEFAULT_CENTER;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const handleSearch = useCallback(
    async (originText: string | null, destinationText: string | null, time: Date, options: RouteOptions) => {
      try {
        const [origin, dest] = await Promise.all([
          originText ? geocodeAddress(originText) : Promise.resolve(location),
          destinationText ? geocodeAddress(destinationText) : Promise.resolve(location),
        ]);
        if (!origin) throw new Error('Could not determine your starting location.');
        if (!dest) throw new Error('Could not determine your destination.');

        setSearchOrigin(origin);
        setSearchDest(dest);
        setMapPickCoord(null);
        setSearchWeather(null);
        setSearchWeatherLoading(true);

        const freshWeather = await fetchWeather(dest.lat, dest.lng, time);
        setSearchWeather(freshWeather);
        setSearchWeatherLoading(false);

        await routeSearch.search(origin, dest, time, options, freshWeather);
      } catch (err) {
        setSearchWeatherLoading(false);
        routeSearch.setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
    },
    [location, routeSearch]
  );

  const handleReset = useCallback(() => {
    routeSearch.reset();
    setSearchOrigin(null);
    setSearchDest(null);
    setMapPickCoord(null);
    setSearchWeather(null);
    setSearchWeatherLoading(false);
  }, [routeSearch]);

  const selectedRoute =
    routeSearch.selectedRoute === 'shaded'
      ? routeSearch.shadedRoute
      : routeSearch.fastestRoute;

  const handleStartNavigation = useCallback(() => {
    if (selectedRoute && searchDest) {
      startNav(selectedRoute, searchDest);
    }
  }, [selectedRoute, searchDest, startNav]);

  const navActive = session.isActive || session.arrived;

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
        pickedLocation={mapPickCoord}
        onSelectRoute={routeSearch.selectRoute}
        onLongPress={(coord) => {
          setMapPickCoord({ ...coord });
          showToast('📍 Location picked');
        }}
      />

      {/* Keep Sidebar mounted so search fields retain their values after navigation ends.
          Hide it visually during navigation — display:none propagates to fixed children. */}
      <div style={{ display: navActive ? 'none' : undefined }}>
        <Sidebar
          searchState={routeSearch}
          hasGpsLocation={!!location}
          onSearch={handleSearch}
          onSelectRoute={routeSearch.selectRoute}
          onReset={handleReset}
          onStartNavigation={handleStartNavigation}
          searchOrigin={searchOrigin}
          searchDest={searchDest}
          selectedRoute={selectedRoute}
          mapPickCoord={mapPickCoord}
          weather={displayWeather}
          weatherLoading={displayWeatherLoading}
        />
      </div>

      <NavigationHUD />

      {/* Long-press feedback toast */}
      {toast && (
        <div className="absolute top-24 md:top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800/90 text-white text-sm px-4 py-2 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {isLocating && !navActive && (
        <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 bg-white text-gray-600 text-xs px-3 py-2 rounded-full shadow-md flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Getting your location...
        </div>
      )}
    </div>
  );
}

export default function ShadeApp() {
  return (
    <NavigationProvider>
      <ShadeAppInner />
    </NavigationProvider>
  );
}
