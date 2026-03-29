'use client';

import { Marker } from 'react-map-gl/maplibre';
import type { LatLng } from '@/types/route';

interface Props {
  origin: LatLng | null;
  destination: LatLng | null;
}

export function RouteMarkers({ origin, destination }: Props) {
  return (
    <>
      {origin && (
        <Marker longitude={origin.lng} latitude={origin.lat} anchor="center">
          <div style={{
            width: 16, height: 16,
            background: '#22c55e', border: '3px solid #15803d',
            borderRadius: '50%', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }} />
        </Marker>
      )}
      {destination && (
        <Marker longitude={destination.lng} latitude={destination.lat} anchor="bottom">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: 16, height: 16,
              background: '#ef4444', border: '3px solid #b91c1c',
              borderRadius: '50%', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }} />
            <div style={{ width: 2, height: 10, background: '#b91c1c' }} />
          </div>
        </Marker>
      )}
    </>
  );
}
