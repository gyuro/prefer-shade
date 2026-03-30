import { decode } from '@googlemaps/polyline-codec';
import { ShadowIndex } from '@/lib/shadow/shadowIndex';
import type { LatLng } from '@/types/route';

const DECISION_INTERVAL_M = 80;
const PERP_OFFSET_M = 80;      // must cross a city block (~80m) to hit a parallel street
const MIN_IMPROVEMENT = 0.05;  // 5% — was 12%, which was too strict
const MAX_WAYPOINTS = 8;
const MIN_WAYPOINT_SPACING_M = 60;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const R = 6371000;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Flat-earth displacement — replaces turf.destination in the hot path */
function displace(lat: number, lng: number, bearingDeg: number, distM: number): [number, number] {
  const br = bearingDeg * DEG_TO_RAD;
  const dLat = (distM * Math.cos(br) / R) * RAD_TO_DEG;
  const dLng = (distM * Math.sin(br) / (R * Math.cos(lat * DEG_TO_RAD))) * RAD_TO_DEG;
  return [lat + dLat, lng + dLng];
}

/**
 * Score a point's shade by sampling a 3×3 grid of points within ~10m radius.
 * Replaces turf.buffer + turf.intersect + turf.area entirely.
 */
function scorePoint(lat: number, lng: number, index: ShadowIndex): number {
  const dLat = 10 / 111000;
  const dLng = 10 / (111000 * Math.cos(lat * DEG_TO_RAD));
  // 9-point grid: center + 4 cardinal + 4 diagonal
  const pts: [number, number][] = [
    [lat, lng],
    [lat + dLat, lng], [lat - dLat, lng],
    [lat, lng + dLng], [lat, lng - dLng],
    [lat + dLat, lng + dLng], [lat + dLat, lng - dLng],
    [lat - dLat, lng + dLng], [lat - dLat, lng - dLng],
  ];
  let inShade = 0;
  for (const [plat, plng] of pts) {
    if (index.isInShade(plat, plng)) inShade++;
  }
  return inShade / pts.length;
}

/**
 * Walk the coord array and return [lat, lng] at cumulative distance targetM.
 * Also returns the local bearing for perpendicular offset calculation.
 */
function pointAtDistance(
  coords: number[][],
  targetM: number
): { lat: number; lng: number; bearing: number } | null {
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const lat1 = coords[i - 1][0], lng1 = coords[i - 1][1];
    const lat2 = coords[i][0], lng2 = coords[i][1];
    const segLen = haversineM(lat1, lng1, lat2, lng2);
    if (acc + segLen >= targetM) {
      const t = (targetM - acc) / segLen;
      const lat = lat1 + t * (lat2 - lat1);
      const lng = lng1 + t * (lng2 - lng1);
      // Bearing of this segment
      const dLng = (lng2 - lng1) * DEG_TO_RAD;
      const y = Math.sin(dLng) * Math.cos(lat2 * DEG_TO_RAD);
      const x =
        Math.cos(lat1 * DEG_TO_RAD) * Math.sin(lat2 * DEG_TO_RAD) -
        Math.sin(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.cos(dLng);
      const bearing = (Math.atan2(y, x) * RAD_TO_DEG + 360) % 360;
      return { lat, lng, bearing };
    }
    acc += segLen;
  }
  return null;
}

/**
 * Generate waypoints steering the route toward shadier corridors.
 * Fully replaced turf.buffer/intersect/area with ShadowIndex + inline math.
 */
export function optimizeWaypoints(
  encodedPolyline: string,
  index: ShadowIndex
): LatLng[] {
  const raw = decode(encodedPolyline, 5); // [[lat, lng]]
  if (raw.length < 2) return [];

  // Compute total route length
  let totalLen = 0;
  for (let i = 1; i < raw.length; i++) {
    totalLen += haversineM(raw[i - 1][0], raw[i - 1][1], raw[i][0], raw[i][1]);
  }

  const waypoints: LatLng[] = [];
  let lastWpDist = -Infinity;

  for (let dist = DECISION_INTERVAL_M; dist < totalLen - DECISION_INTERVAL_M; dist += DECISION_INTERVAL_M) {
    const pt = pointAtDistance(raw, dist);
    if (!pt) continue;

    const spineScore = scorePoint(pt.lat, pt.lng, index);

    // Perpendicular candidates
    const leftBearing = (pt.bearing - 90 + 360) % 360;
    const rightBearing = (pt.bearing + 90) % 360;
    const [lLat, lLng] = displace(pt.lat, pt.lng, leftBearing, PERP_OFFSET_M);
    const [rLat, rLng] = displace(pt.lat, pt.lng, rightBearing, PERP_OFFSET_M);

    const leftScore = scorePoint(lLat, lLng, index);
    const rightScore = scorePoint(rLat, rLng, index);
    const bestScore = Math.max(leftScore, rightScore);

    if (
      bestScore - spineScore >= MIN_IMPROVEMENT &&
      dist - lastWpDist >= MIN_WAYPOINT_SPACING_M
    ) {
      const useLat = leftScore >= rightScore ? lLat : rLat;
      const useLng = leftScore >= rightScore ? lLng : rLng;
      waypoints.push({ lat: useLat, lng: useLng });
      lastWpDist = dist;
    }

    if (waypoints.length >= MAX_WAYPOINTS) break;
  }

  return waypoints;
}
