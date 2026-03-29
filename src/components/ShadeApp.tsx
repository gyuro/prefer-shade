'use client';

import { useCallback, useState } from 'react';
import { MapApp } from '@/components/map/MapApp';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useRouteSearch } from '@/hooks/useRouteSearch';
import { geocodeAddress } from '@/lib/utils/geocode';
import type { LatLng } from '@/types/route';

const DEFAULT_CENTER: LatLng = { lat: 37.7749, lng: -122.4194 };

export default function ShadeApp() {
  const { location, isLocating } = useUserLocation();
  const routeSearch = useRouteSearch();
  // Track the exact coords used for the last search so markers match the route
  const [searchOrigin, setSearchOrigin] = useState<LatLng | null>(null);
  const [searchDest, setSearchDest] = useState<LatLng | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const center = location ?? DEFAULT_CENTER;

  const handleSearch = useCallback(
    async (originText: string | null, destinationText: string | null, time: Date) => {
      try {
        const origin = originText ? await geocodeAddress(originText) : location;
        if (!origin) throw new Error('Could not determine your starting location.');
        const dest = destinationText ? await geocodeAddress(destinationText) : location;
        if (!dest) throw new Error('Could not determine your destination.');
        setSearchOrigin(origin);
        setSearchDest(dest);
        await routeSearch.search(origin, dest, time);
      } catch (err) {
        console.error('Search error:', err);
      }
    },
    [location, routeSearch]
  );

  const handleReset = useCallback(() => {
    routeSearch.reset();
    setSearchOrigin(null);
    setSearchDest(null);
  }, [routeSearch]);

  const selectedRoute =
    routeSearch.selectedRoute === 'shaded'
      ? routeSearch.shadedRoute
      : routeSearch.fastestRoute;

  return (
    <div className="relative w-full h-screen">
      <MapApp
        apiKey={apiKey}
        shadows={routeSearch.shadows}
        fastestRoute={routeSearch.fastestRoute}
        shadedRoute={routeSearch.shadedRoute}
        selectedRoute={routeSearch.selectedRoute}
        origin={searchOrigin}
        destination={searchDest}
        center={center}
      />

      <Sidebar
        searchState={routeSearch}
        location={location}
        hasGpsLocation={!!location}
        onSearch={handleSearch}
        onSelectRoute={routeSearch.selectRoute}
        onReset={handleReset}
        searchOrigin={searchOrigin}
        searchDest={searchDest}
        selectedRoute={selectedRoute}
      />

      {isLocating && (
        <div className="absolute bottom-6 right-6 bg-white text-gray-600 text-xs px-3 py-2 rounded-full shadow-md flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Getting your location...
        </div>
      )}
    </div>
  );
}
