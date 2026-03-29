import { buffer } from '@turf/buffer';
import { intersect } from '@turf/intersect';
import { area } from '@turf/area';
import { bbox } from '@turf/bbox';
import { featureCollection } from '@turf/helpers';
import type { Feature, LineString, Polygon } from 'geojson';

/** Buffer width in meters on each side of the segment (pedestrian corridor) */
const BUFFER_M = 1.5;

/**
 * Score a route segment against a list of shadow polygons.
 * Returns a shade fraction 0.0 (full sun) to 1.0 (full shade).
 */
export function scoreSegmentShade(
  segment: Feature<LineString>,
  shadows: Feature<Polygon>[]
): number {
  if (shadows.length === 0) return 0;

  const segBuf = buffer(segment, BUFFER_M / 1000, { units: 'kilometers' }) as Feature<Polygon>;
  if (!segBuf) return 0;

  const segArea = area(segBuf);
  if (segArea === 0) return 0;

  const segBbox = bbox(segBuf);
  let shadedArea = 0;

  for (const shadow of shadows) {
    // Quick bounding box pre-filter
    const shadowBbox = bbox(shadow);
    if (!bboxOverlaps(segBbox, shadowBbox)) continue;

    const intersection = intersect(featureCollection([segBuf, shadow]));
    if (intersection) {
      shadedArea += area(intersection);
    }
  }

  return Math.min(shadedArea / segArea, 1.0);
}

function bboxOverlaps(a: number[], b: number[]): boolean {
  return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
}
