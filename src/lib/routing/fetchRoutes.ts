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

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/foot';

export async function fetchRoutes(options: FetchRoutesOptions): Promise<RouteCandidate[]> {
  const waypoints = [options.origin, ...(options.intermediates ?? []), options.destination];
  const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(';');
  const hasIntermediates = (options.intermediates ?? []).length > 0;

  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'polyline',
    alternatives: hasIntermediates ? 'false' : 'true',
  });

  const response = await fetch(`${OSRM_BASE}/${coords}?${params}`);

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
