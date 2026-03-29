import { decode } from '@googlemaps/polyline-codec';
import { lineString } from '@turf/helpers';
import type { Feature, LineString } from 'geojson';
import type { LatLng, RouteCandidate } from '@/types/route';

export interface FetchRoutesOptions {
  origin: LatLng;
  destination: LatLng;
  intermediates?: LatLng[];
}

interface OsrmResponse {
  code: string; // "Ok" on success
  routes?: Array<{
    geometry: string;  // encoded polyline, precision 5
    duration: number;  // seconds (float)
    distance: number;  // meters (float)
  }>;
  message?: string;
}

export async function fetchRoutes(options: FetchRoutesOptions): Promise<RouteCandidate[]> {
  const body = {
    origin: options.origin,
    destination: options.destination,
    intermediates: options.intermediates ?? [],
  };

  const response = await fetch('/api/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Routes API error: ${response.status}`);
  }

  const data: OsrmResponse = await response.json();

  if (data.code !== 'Ok') {
    throw new Error(data.message ?? 'Routing failed — no route found');
  }

  return (data.routes ?? []).map((r, i) => ({
    encodedPolyline: r.geometry,
    durationSeconds: Math.round(r.duration),
    distanceMeters: Math.round(r.distance),
    label: i === 0 ? 'FASTEST' : 'ALTERNATE',
  }));
}

/** Decode a polyline (precision 5) into a GeoJSON LineString */
export function decodedPolylineToLineString(encoded: string): Feature<LineString> {
  const coords = decode(encoded, 5).map(([lat, lng]) => [lng, lat]); // GeoJSON: [lng, lat]
  return lineString(coords);
}
