'use client';

import { Marker } from 'react-map-gl/maplibre';
import type { LatLng } from '@/types/route';

interface Props {
  origin: LatLng | null;
  destination: LatLng | null;
  stops?: LatLng[];
  userLocation: LatLng | null;
  pickedLocation?: LatLng | null;
}

function PinIcon({ color, border }: { color: string; border: string }) {
  return (
    <svg viewBox="0 0 22 28" width="22" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11 1C6.58 1 3 4.58 3 9c0 6 8 18 8 18s8-12 8-18c0-4.42-3.58-8-8-8z"
        fill={color}
        stroke={border}
        strokeWidth="1.5"
      />
      <circle cx="11" cy="9" r="3" fill="white" />
    </svg>
  );
}

function PickedPin() {
  return (
    <div className="relative">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-violet-400 opacity-30 animate-ping" />
      <svg viewBox="0 0 22 28" width="22" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M11 1C6.58 1 3 4.58 3 9c0 6 8 18 8 18s8-12 8-18c0-4.42-3.58-8-8-8z"
          fill="#7c3aed"
          stroke="#4c1d95"
          strokeWidth="1.5"
        />
        <circle cx="11" cy="9" r="3" fill="white" />
      </svg>
    </div>
  );
}

function StopPin({ index }: { index: number }) {
  return (
    <svg viewBox="0 0 22 28" width="20" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11 1C6.58 1 3 4.58 3 9c0 6 8 18 8 18s8-12 8-18c0-4.42-3.58-8-8-8z"
        fill="#f97316"
        stroke="#c2410c"
        strokeWidth="1.5"
      />
      <text x="11" y="13.5" textAnchor="middle" fontSize="8" fontWeight="bold" fill="white" fontFamily="sans-serif">
        {index + 1}
      </text>
    </svg>
  );
}

function UserDot() {
  return (
    <div className="relative flex items-center justify-center w-5 h-5">
      {/* Pulsing ring */}
      <div className="absolute w-5 h-5 rounded-full bg-blue-400 opacity-40 animate-ping" />
      {/* Solid dot */}
      <div className="relative w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow-md" />
    </div>
  );
}

export function RouteMarkers({ origin, destination, stops, userLocation, pickedLocation }: Props) {
  return (
    <>
      {pickedLocation && (
        <Marker longitude={pickedLocation.lng} latitude={pickedLocation.lat} anchor="bottom">
          <PickedPin />
        </Marker>
      )}
      {userLocation && (
        <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
          <UserDot />
        </Marker>
      )}
      {origin && (
        <Marker longitude={origin.lng} latitude={origin.lat} anchor="bottom">
          <PinIcon color="#22c55e" border="#15803d" />
        </Marker>
      )}
      {stops?.map((stop, i) => (
        <Marker key={i} longitude={stop.lng} latitude={stop.lat} anchor="bottom">
          <StopPin index={i} />
        </Marker>
      ))}
      {destination && (
        <Marker longitude={destination.lng} latitude={destination.lat} anchor="bottom">
          <PinIcon color="#ef4444" border="#b91c1c" />
        </Marker>
      )}
    </>
  );
}
