'use client';

import { APIProvider } from '@vis.gl/react-google-maps';
import { MapContainer } from './MapContainer';
import type { Feature, Polygon } from 'geojson';
import type { LatLng, ScoredRoute } from '@/types/route';

interface Props {
  apiKey: string;
  shadows: Feature<Polygon>[];
  fastestRoute: ScoredRoute | null;
  shadedRoute: ScoredRoute | null;
  selectedRoute: 'fastest' | 'shaded';
  origin: LatLng | null;
  destination: LatLng | null;
  center: LatLng;
}

export function MapApp({ apiKey, ...rest }: Props) {
  return (
    <APIProvider apiKey={apiKey} libraries={['marker']}>
      <MapContainer {...rest} />
    </APIProvider>
  );
}
