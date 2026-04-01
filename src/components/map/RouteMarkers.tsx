'use client';

import { Marker } from 'react-map-gl/maplibre';
import type { LatLng } from '@/types/route';

interface Props {
  origin: LatLng | null;
  destination: LatLng | null;
  userLocation: LatLng | null;
  pickedLocation?: LatLng | null;
  heading?: number | null;
  mapBearing?: number;
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

/** Semi-transparent cone showing the direction the device is facing. */
function HeadingBeam({ heading, mapBearing }: { heading: number; mapBearing: number }) {
  const r = 52;          // cone radius in px
  const halfDeg = 30;    // half-width of the 60° beam
  const screenAngle = heading - mapBearing;

  // SVG angles: 0° = right, 90° = down; we want 0° = up (north)
  const toRad = (d: number) => (d - 90) * (Math.PI / 180);
  const a1 = toRad(screenAngle - halfDeg);
  const a2 = toRad(screenAngle + halfDeg);
  const x1 = r * Math.cos(a1);
  const y1 = r * Math.sin(a1);
  const x2 = r * Math.cos(a2);
  const y2 = r * Math.sin(a2);

  const size = r * 2 + 8;
  const cx = r + 4;

  return (
    <svg
      width={size}
      height={size}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="beamGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#3b82f6" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d={`M ${cx} ${cx} L ${cx + x1} ${cx + y1} A ${r} ${r} 0 0 1 ${cx + x2} ${cx + y2} Z`}
        fill="url(#beamGrad)"
        stroke="rgba(59,130,246,0.5)"
        strokeWidth="0.75"
      />
    </svg>
  );
}

function UserDot({ heading, mapBearing }: { heading?: number | null; mapBearing?: number }) {
  return (
    <div className="relative flex items-center justify-center w-5 h-5">
      {heading !== null && heading !== undefined && (
        <HeadingBeam heading={heading} mapBearing={mapBearing ?? 0} />
      )}
      {/* Pulsing ring */}
      <div className="absolute w-5 h-5 rounded-full bg-blue-400 opacity-40 animate-ping" />
      {/* Solid dot */}
      <div className="relative w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow-md" />
    </div>
  );
}

export function RouteMarkers({ origin, destination, userLocation, pickedLocation, heading, mapBearing }: Props) {
  return (
    <>
      {pickedLocation && (
        <Marker longitude={pickedLocation.lng} latitude={pickedLocation.lat} anchor="bottom">
          <PickedPin />
        </Marker>
      )}
      {userLocation && (
        <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
          <UserDot heading={heading} mapBearing={mapBearing} />
        </Marker>
      )}
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
