import { decode } from '@googlemaps/polyline-codec';
import { ShadowIndex } from '@/lib/shadow/shadowIndex';
import type { Feature, Polygon } from 'geojson';
import type { RouteCandidate, ScoredRoute } from '@/types/route';

/** Sample a point every N meters along the route for shade checks */
const SAMPLE_M = 6;
const DEG_TO_RAD = Math.PI / 180;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Walk the decoded polyline, checking a sample point every SAMPLE_M metres.
 * No Turf calls — pure arithmetic + ShadowIndex lookups.
 */
export function scorePolyline(
  encodedPolyline: string,
  index: ShadowIndex
): { shadeScore: number; shadedDistanceMeters: number; totalDistanceMeters: number } {
  const raw = decode(encodedPolyline, 5); // [[lat, lng]]
  if (raw.length < 2) return { shadeScore: 0, shadedDistanceMeters: 0, totalDistanceMeters: 0 };

  let totalSamples = 0;
  let shadedSamples = 0;
  let totalDistance = 0;
  let distToNextSample = SAMPLE_M; // metres remaining until the next sample point

  for (let i = 1; i < raw.length; i++) {
    const lat1 = raw[i - 1][0], lng1 = raw[i - 1][1];
    const lat2 = raw[i][0], lng2 = raw[i][1];
    const segLen = haversineM(lat1, lng1, lat2, lng2);
    totalDistance += segLen;
    if (segLen < 0.001) continue;

    let walked = 0; // metres walked into this segment so far
    while (walked + distToNextSample <= segLen) {
      walked += distToNextSample;
      distToNextSample = SAMPLE_M;
      const t = walked / segLen;
      totalSamples++;
      if (index.isInShade(lat1 + t * (lat2 - lat1), lng1 + t * (lng2 - lng1))) shadedSamples++;
    }
    distToNextSample -= (segLen - walked); // carry forward into next segment
  }

  const shadeScore = totalSamples > 0 ? Math.round((shadedSamples / totalSamples) * 100) : 0;
  return {
    shadeScore,
    shadedDistanceMeters: Math.round(totalDistance * shadeScore / 100),
    totalDistanceMeters: Math.round(totalDistance),
  };
}

/** Build a shadow index and score a single route. Synchronous. */
export function scoreRoute(
  candidate: RouteCandidate,
  shadows: Feature<Polygon>[],
  routeLabel: ScoredRoute['routeLabel']
): ScoredRoute {
  const index = new ShadowIndex(shadows);
  const { shadeScore, shadedDistanceMeters } = scorePolyline(candidate.encodedPolyline, index);
  return { ...candidate, shadeScore, shadedDistanceMeters, routeLabel };
}

/** Score using a pre-built index (avoids rebuilding when scoring multiple routes). */
export function scoreRouteWithIndex(
  candidate: RouteCandidate,
  index: ShadowIndex,
  routeLabel: ScoredRoute['routeLabel']
): ScoredRoute {
  const { shadeScore, shadedDistanceMeters } = scorePolyline(candidate.encodedPolyline, index);
  return { ...candidate, shadeScore, shadedDistanceMeters, routeLabel };
}
