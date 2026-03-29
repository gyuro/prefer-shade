'use client';

import { useEffect, useRef } from 'react';
import { Map, useMap } from '@vis.gl/react-google-maps';
import { decode } from '@googlemaps/polyline-codec';
import { ShadowOverlay } from './ShadowOverlay';
import { RoutePolyline } from './RoutePolyline';
import { RouteMarkers } from './RouteMarkers';
import type { Feature, Polygon } from 'geojson';
import type { LatLng, ScoredRoute } from '@/types/route';

interface MapContentProps {
  shadows: Feature<Polygon>[];
  fastestRoute: ScoredRoute | null;
  shadedRoute: ScoredRoute | null;
  selectedRoute: 'fastest' | 'shaded';
  origin: LatLng | null;
  destination: LatLng | null;
}

/** Inner component — has access to useMap() because it's rendered inside <Map> */
function MapContent({
  shadows,
  fastestRoute,
  shadedRoute,
  selectedRoute,
  origin,
  destination,
}: MapContentProps) {
  const map = useMap();
  // Track which polyline we last fitted — only refit when a new route search completes
  const fittedPolylineRef = useRef<string | null>(null);

  useEffect(() => {
    if (!map || !fastestRoute) return;

    // Don't refit just because the user toggled between route cards
    if (fastestRoute.encodedPolyline === fittedPolylineRef.current) return;
    fittedPolylineRef.current = fastestRoute.encodedPolyline;

    // Include every point from ALL returned routes so both are visible
    const bounds = new google.maps.LatLngBounds();
    const routes = [fastestRoute, shadedRoute].filter(Boolean) as ScoredRoute[];
    for (const route of routes) {
      for (const [lat, lng] of decode(route.encodedPolyline, 5)) {
        bounds.extend({ lat, lng });
      }
    }
    if (origin) bounds.extend(origin);
    if (destination) bounds.extend(destination);

    // left padding reserves space for the 320px sidebar + 16px gap
    map.fitBounds(bounds, { top: 80, bottom: 80, left: 380, right: 80 });
  }, [map, fastestRoute, shadedRoute, origin, destination]);

  const hasBothDistinct =
    fastestRoute &&
    shadedRoute &&
    fastestRoute.encodedPolyline !== shadedRoute.encodedPolyline;

  return (
    <>
      <ShadowOverlay shadows={shadows} />

      {hasBothDistinct ? (
        <>
          <RoutePolyline route={fastestRoute!} isSelected={selectedRoute === 'fastest'} />
          <RoutePolyline route={shadedRoute!} isSelected={selectedRoute === 'shaded'} />
        </>
      ) : (
        (shadedRoute ?? fastestRoute) && (
          <RoutePolyline route={(shadedRoute ?? fastestRoute)!} isSelected />
        )
      )}

      <RouteMarkers origin={origin} destination={destination} />
    </>
  );
}

interface Props extends MapContentProps {
  center: LatLng;
}

export function MapContainer({ center, ...contentProps }: Props) {
  return (
    <Map
      mapId="shade-routing-map"
      defaultCenter={center}
      defaultZoom={14}
      gestureHandling="greedy"
      disableDefaultUI={false}
      mapTypeControl={false}
      fullscreenControl={false}
      streetViewControl={false}
      style={{ width: '100%', height: '100%' }}
    >
      <MapContent {...contentProps} />
    </Map>
  );
}
