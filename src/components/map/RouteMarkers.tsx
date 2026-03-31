'use client';

import { Marker } from 'react-map-gl/maplibre';
import type { LatLng } from '@/types/route';

interface Props {
  origin: LatLng | null;
  destination: LatLng | null;
}

function PinIcon({ color, border }: { color: string; border: string }) {
  return (
    <svg viewBox="0 0 22 28" width="22" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Teardrop body */}
      <path
        d="M11 1C6.58 1 3 4.58 3 9c0 6 8 18 8 18s8-12 8-18c0-4.42-3.58-8-8-8z"
        fill={color}
        stroke={border}
        strokeWidth="1.5"
      />
      {/* White inner dot */}
      <circle cx="11" cy="9" r="3" fill="white" />
    </svg>
  );
}

export function RouteMarkers({ origin, destination }: Props) {
  return (
    <>
      {origin && (
        <Marker longitude={origin.lng} latitude={origin.lat} anchor="bottom">
          <PinIcon color="#22c55e" border="#15803d" />
        </Marker>
      )}
      {destination && (
        <Marker longitude={destination.lng} latitude={destination.lat} anchor="bottom">
          <PinIcon color="#ef4444" border="#b91c1c" />
        </Marker>
      )}
    </>
  );
}
