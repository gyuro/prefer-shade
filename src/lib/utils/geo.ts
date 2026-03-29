import type { BoundingBox } from '@/types/map';
import type { LatLng } from '@/types/route';

/** Expand a bbox by `meters` on all sides */
export function expandBbox(bbox: BoundingBox, meters: number): BoundingBox {
  const latDelta = meters / 111_000;
  const lngDelta = meters / (111_000 * Math.cos((bbox.south * Math.PI) / 180));
  return {
    south: bbox.south - latDelta,
    west: bbox.west - lngDelta,
    north: bbox.north + latDelta,
    east: bbox.east + lngDelta,
  };
}

/** Compute bounding box that covers a set of LatLng points */
export function pointsBbox(points: LatLng[]): BoundingBox {
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
  for (const { lat, lng } of points) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
  }
  return { south, west, north, east };
}

/** Meters between two LatLng points (Haversine) */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Format meters as a human-readable string */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/** Format seconds as a human-readable string */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}
