import { decode } from '@googlemaps/polyline-codec';
import { lineString } from '@turf/helpers';
import type { Feature, LineString } from 'geojson';
import type { LatLng, RouteCandidate } from '@/types/route';

export interface FetchRoutesOptions {
  origin: LatLng;
  destination: LatLng;
  intermediates?: LatLng[];
}

interface GoogleRoutesApiResponse {
  routes?: Array<{
    polyline: { encodedPolyline: string };
    duration: string; // e.g. "300s"
    distanceMeters: number;
    routeLabels?: string[];
  }>;
  error?: { message: string };
}

export async function fetchRoutes(options: FetchRoutesOptions): Promise<RouteCandidate[]> {
  const body = {
    origin: { location: { latLng: { latitude: options.origin.lat, longitude: options.origin.lng } } },
    destination: {
      location: {
        latLng: { latitude: options.destination.lat, longitude: options.destination.lng },
      },
    },
    intermediates: (options.intermediates ?? []).map((wp) => ({
      location: { latLng: { latitude: wp.lat, longitude: wp.lng } },
    })),
    computeAlternativeRoutes: (options.intermediates ?? []).length === 0,
  };

  const response = await fetch('/api/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Routes API error: ${response.status}`);
  }

  const data: GoogleRoutesApiResponse = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return (data.routes ?? []).map((r, i) => ({
    encodedPolyline: r.polyline.encodedPolyline,
    durationSeconds: parseInt(r.duration ?? '0', 10),
    distanceMeters: r.distanceMeters,
    label: i === 0 ? 'FASTEST' : 'ALTERNATE',
  }));
}

/** Decode a Google-encoded polyline into a GeoJSON LineString */
export function decodedPolylineToLineString(encoded: string): Feature<LineString> {
  const latLngs = decode(encoded, 5);
  const coords = latLngs.map(([lat, lng]) => [lng, lat]); // GeoJSON: [lng, lat]
  return lineString(coords);
}
