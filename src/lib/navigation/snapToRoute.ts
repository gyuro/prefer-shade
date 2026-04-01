import nearestPointOnLine from '@turf/nearest-point-on-line';
import { length } from '@turf/length';
import { lineString, point } from '@turf/helpers';
import type { LatLng } from '@/types/route';

export interface SnapResult {
  snapped: LatLng;
  /** Metres from route start to the snapped position */
  distanceTraveled: number;
  /** Total route length in metres */
  totalLength: number;
  /** Metres remaining to destination */
  distanceRemaining: number;
}

/**
 * Snaps a GPS position to the nearest point on the route polyline.
 * @param userPos  Current GPS position
 * @param coords   Decoded polyline as [lat, lng] pairs
 */
export function snapToRoute(userPos: LatLng, coords: [number, number][]): SnapResult {
  // GeoJSON uses [lng, lat] order
  const line = lineString(coords.map(([lat, lng]) => [lng, lat]));
  const pt = point([userPos.lng, userPos.lat]);

  const nearest = nearestPointOnLine(line, pt, { units: 'kilometers' });
  const [snappedLng, snappedLat] = nearest.geometry.coordinates;
  const distanceTraveled = (nearest.properties.location ?? 0) * 1000; // km → m

  const totalLength = length(line, { units: 'kilometers' }) * 1000;
  const distanceRemaining = Math.max(0, totalLength - distanceTraveled);

  return {
    snapped: { lat: snappedLat, lng: snappedLng },
    distanceTraveled,
    totalLength,
    distanceRemaining,
  };
}
