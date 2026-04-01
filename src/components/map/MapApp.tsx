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
  userLocation: LatLng | null;
  pickedLocation?: LatLng | null;
  heading?: number | null;
  onLongPress?: (coord: LatLng) => void;
}

export function MapApp(props: Props) {
  return <MapContainer {...props} />;
}
