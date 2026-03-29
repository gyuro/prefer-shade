'use client';

import { AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import type { LatLng } from '@/types/route';

interface Props {
  origin: LatLng | null;
  destination: LatLng | null;
}

export function RouteMarkers({ origin, destination }: Props) {
  return (
    <>
      {origin && (
        <AdvancedMarker position={origin} title="Your location">
          <Pin background="#22c55e" borderColor="#15803d" glyphColor="#fff" scale={1.1} />
        </AdvancedMarker>
      )}
      {destination && (
        <AdvancedMarker position={destination} title="Destination">
          <Pin background="#ef4444" borderColor="#b91c1c" glyphColor="#fff" scale={1.1} />
        </AdvancedMarker>
      )}
    </>
  );
}
