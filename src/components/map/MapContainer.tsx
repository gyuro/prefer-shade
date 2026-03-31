'use client';

import { useEffect, useRef } from 'react';
import Map, { useMap } from 'react-map-gl/maplibre';
import { decode } from '@googlemaps/polyline-codec';
import { ShadowOverlay } from './ShadowOverlay';
import { RoutePolyline } from './RoutePolyline';
import { RouteMarkers } from './RouteMarkers';
import type { Feature, Polygon } from 'geojson';
import type { LatLng, ScoredRoute } from '@/types/route';

// Free vector tile style — no API key required
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const LONG_PRESS_MS = 600;
const MOVE_THRESHOLD_PX = 10;

/** Fires onLongPress when the user holds still on the map for 600 ms. */
function LongPressHandler({ onLongPress }: { onLongPress?: (coord: LatLng) => void }) {
  const { current: map } = useMap();

  useEffect(() => {
    if (!map || !onLongPress) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let startX = 0, startY = 0;
    let moved = false;

    const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onDown = (e: any) => {
      moved = false;
      const clientX = e.originalEvent?.touches?.[0]?.clientX ?? e.originalEvent?.clientX ?? 0;
      const clientY = e.originalEvent?.touches?.[0]?.clientY ?? e.originalEvent?.clientY ?? 0;
      startX = clientX; startY = clientY;
      clear();
      timer = setTimeout(() => { if (!moved) onLongPress({ lat: e.lngLat.lat, lng: e.lngLat.lng }); }, LONG_PRESS_MS);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onMove = (e: any) => {
      const clientX = e.originalEvent?.touches?.[0]?.clientX ?? e.originalEvent?.clientX ?? startX;
      const clientY = e.originalEvent?.touches?.[0]?.clientY ?? e.originalEvent?.clientY ?? startY;
      if (Math.hypot(clientX - startX, clientY - startY) > MOVE_THRESHOLD_PX) { moved = true; clear(); }
    };

    map.on('mousedown', onDown);
    map.on('mousemove', onMove);
    map.on('mouseup', clear);
    map.on('touchstart', onDown);
    map.on('touchmove', onMove);
    map.on('touchend', clear);
    map.on('contextmenu', clear);

    return () => {
      clear();
      map.off('mousedown', onDown);
      map.off('mousemove', onMove);
      map.off('mouseup', clear);
      map.off('touchstart', onDown);
      map.off('touchmove', onMove);
      map.off('touchend', clear);
      map.off('contextmenu', clear);
    };
  }, [map, onLongPress]);

  return null;
}

interface MapContentProps {
  shadows: Feature<Polygon>[];
  fastestRoute: ScoredRoute | null;
  shadedRoute: ScoredRoute | null;
  selectedRoute: 'fastest' | 'shaded';
  origin: LatLng | null;
  destination: LatLng | null;
  userLocation: LatLng | null;
  onLongPress?: (coord: LatLng) => void;
}

function MapContent({ shadows, fastestRoute, shadedRoute, selectedRoute, origin, destination, userLocation, onLongPress }: MapContentProps) {
  const { current: map } = useMap();
  const fittedPolylineRef = useRef<string | null>(null);
  const centeredOnGpsRef = useRef(false);

  // Fly to GPS location once it first resolves — skip if a route is already shown
  useEffect(() => {
    if (!map || !userLocation || centeredOnGpsRef.current || fastestRoute) return;
    centeredOnGpsRef.current = true;
    map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 15, duration: 800 });
  }, [map, userLocation, fastestRoute]);

  useEffect(() => {
    if (!map || !fastestRoute) return;
    if (fastestRoute.encodedPolyline === fittedPolylineRef.current) return;
    fittedPolylineRef.current = fastestRoute.encodedPolyline;

    const lngs: number[] = [];
    const lats: number[] = [];

    const routes = [fastestRoute, shadedRoute].filter(Boolean) as ScoredRoute[];
    for (const route of routes) {
      for (const [lat, lng] of decode(route.encodedPolyline, 5)) {
        lats.push(lat);
        lngs.push(lng);
      }
    }
    if (origin) { lngs.push(origin.lng); lats.push(origin.lat); }
    if (destination) { lngs.push(destination.lng); lats.push(destination.lat); }
    if (lngs.length === 0) return;

    // On mobile the sidebar is a bottom sheet (h-64 ≈ 256px); on desktop it's
    // a 320px left sidebar. Use different padding so the route is always visible.
    const mobile = window.innerWidth < 768;
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      {
        padding: mobile
          ? { top: 140, bottom: 150, left: 24, right: 24 }
          : { top: 80, bottom: 80, left: 380, right: 80 },
        duration: 800,
      }
    );
  }, [map, fastestRoute, shadedRoute, origin, destination]);

  const hasBothDistinct =
    fastestRoute && shadedRoute &&
    fastestRoute.encodedPolyline !== shadedRoute.encodedPolyline;

  return (
    <>
      <LongPressHandler onLongPress={onLongPress} />
      <ShadowOverlay shadows={shadows} />

      {hasBothDistinct ? (
        <>
          <RoutePolyline route={fastestRoute!} isSelected={selectedRoute === 'fastest'} zIndex={selectedRoute === 'fastest' ? 2 : 1} />
          <RoutePolyline route={shadedRoute!} isSelected={selectedRoute === 'shaded'} zIndex={selectedRoute === 'shaded' ? 2 : 1} />
        </>
      ) : (
        (shadedRoute ?? fastestRoute) && (
          <RoutePolyline route={(shadedRoute ?? fastestRoute)!} isSelected zIndex={2} />
        )
      )}

      <RouteMarkers origin={origin} destination={destination} />
    </>
  );
}

interface Props extends MapContentProps {
  center: LatLng;
  onLongPress?: (coord: LatLng) => void;
}

export function MapContainer({ center, ...contentProps }: Props) {
  return (
    <Map
      id="shade-map"
      mapStyle={MAP_STYLE}
      initialViewState={{ longitude: center.lng, latitude: center.lat, zoom: 4 }}
      style={{ width: '100%', height: '100%' }}
    >
      <MapContent {...contentProps} />
    </Map>
  );
}
