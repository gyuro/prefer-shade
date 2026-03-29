import { length } from '@turf/length';
import { lineSliceAlong } from '@turf/line-slice-along';
import type { Feature, LineString } from 'geojson';

/** Approximate segment length for shade scoring (meters) */
const SEGMENT_LENGTH_M = 15;

/**
 * Chop a route LineString into equal-length segments for per-segment shade scoring.
 */
export function segmentRoute(routeLine: Feature<LineString>): Feature<LineString>[] {
  const totalLength = length(routeLine, { units: 'meters' });
  if (totalLength === 0) return [];

  const segments: Feature<LineString>[] = [];
  for (let start = 0; start < totalLength; start += SEGMENT_LENGTH_M) {
    const end = Math.min(start + SEGMENT_LENGTH_M, totalLength);
    if (end <= start) break;
    const seg = lineSliceAlong(routeLine, start, end, { units: 'meters' });
    segments.push(seg as Feature<LineString>);
  }
  return segments;
}
