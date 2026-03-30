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

// router.project-osrm.org only serves the car profile despite accepting /foot in the URL.
// routing.openstreetmap.de/routed-foot is the correct public pedestrian OSRM server (~4.6 km/h).
const OSRM_SERVERS = [
  'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  'https://router.project-osrm.org/route/v1/foot', // fallback (car speeds — better than nothing)
];

export async function fetchRoutes(options: FetchRoutesOptions): Promise<RouteCandidate[]> {
  const waypoints = [options.origin, ...(options.intermediates ?? []), options.destination];
  const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(';');
  const hasIntermediates = (options.intermediates ?? []).length > 0;

  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'polyline',
    alternatives: hasIntermediates ? 'false' : 'true',
  });

  // Allow intermediate waypoints to snap to roads within 50 m.
  if (hasIntermediates) {
    const radiuses = ['unlimited', ...(options.intermediates!.map(() => '50')), 'unlimited'].join(';');
    params.set('radiuses', radiuses);
  }

  let lastError = '';
  for (const base of OSRM_SERVERS) {
    try {
      const response = await fetch(`${base}/${coords}?${params}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) { lastError = `${base} returned ${response.status}`; continue; }
      const data: OsrmResponse = await response.json();
      if (data.code !== 'Ok') { lastError = data.message ?? 'No route found'; continue; }
      return (data.routes ?? []).map((r, i) => ({
        encodedPolyline: r.geometry,
        durationSeconds: Math.round(r.duration),
        distanceMeters: Math.round(r.distance),
        label: i === 0 ? 'FASTEST' : 'ALTERNATE',
      }));
    } catch (err) {
      lastError = String(err);
    }
  }

  throw new Error(lastError || 'Routing failed — no route found');
}

/** Decode a polyline (precision 5) into a GeoJSON LineString */
export function decodedPolylineToLineString(encoded: string): Feature<LineString> {
  const coords = decode(encoded, 5).map(([lat, lng]) => [lng, lat]); // GeoJSON: [lng, lat]
  return lineString(coords);
}
