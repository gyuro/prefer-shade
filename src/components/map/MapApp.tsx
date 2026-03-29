'use client';

import { MapContainer } from './MapContainer';
import type { Feature, Polygon } from 'geojson';
import type { LatLng, ScoredRoute } from '@/types/route';

interface Props {
  shadows: Feature<Polygon>[];
  fastestRoute: ScoredRoute | null;
  shadedRoute: ScoredRoute | null;
  selectedRoute: 'fastest' | 'shaded';
  origin: LatLng | null;
  destination: LatLng | null;
  center: LatLng;
}

export function MapApp(props: Props) {
  return <MapContainer {...props} />;
}
