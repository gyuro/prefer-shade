import { decode } from '@googlemaps/polyline-codec';
import { fetchBuildings } from '@/lib/buildings/fetchBuildings';
import { castBuildingShadow, getSunPosition } from '@/lib/shadow';
import { ShadowIndex } from '@/lib/shadow/shadowIndex';
import { scorePolyline } from './scoreRoute';
import { expandBbox, pointsBbox } from '@/lib/utils/geo';
import type { LatLng } from '@/types/route';

export interface HourlyShade {
  hour: number;
  score: number;
  isNight: boolean;
}

const WALK_SPEED_M_PER_MIN = 80;

export function sunExposureMinutes(distanceMeters: number, shadeScore: number): number {
  return Math.round((distanceMeters * (1 - shadeScore / 100)) / WALK_SPEED_M_PER_MIN);
}

export function shadeLabel(score: number): { label: string; icon: string } {
  if (score >= 80) return { label: 'Deep Shade', icon: '🌿' };
  if (score >= 60) return { label: 'Mostly Shaded', icon: '🌳' };
  if (score >= 40) return { label: 'Partly Shaded', icon: '⛅' };
  if (score >= 20) return { label: 'Mostly Sunny', icon: '🌤' };
  return { label: 'Full Sun', icon: '☀️' };
}

/**
 * Compute shade score per hour using the fast ShadowIndex pipeline.
 * Buildings are fetched once (cached). Shadow polygons are recast per hour
 * using inline math. Scoring uses pure point-sampling — no Turf in the loop.
 */
export async function computeShadeTimeline(
  encodedPolyline: string,
  location: LatLng,
  date: Date
): Promise<HourlyShade[]> {
  const routeCoords = decode(encodedPolyline, 5).map(([lat, lng]) => ({ lat, lng }));
  const bbox = expandBbox(pointsBbox([location, ...routeCoords]), 200);

  // Buildings are cached — this is usually a memory hit, not a network call
  const buildings = await fetchBuildings(bbox);

  const results: HourlyShade[] = [];

  for (let hour = 5; hour <= 21; hour++) {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);

    const sun = getSunPosition(d, location.lat, location.lng);

    if (!sun.isDay) {
      results.push({ hour, score: 0, isNight: true });
      continue;
    }

    // Cast shadows (fast: inline displacement, no turf.destination)
    const shadows = buildings
      .map((b) => castBuildingShadow(b, sun))
      .filter((s): s is NonNullable<typeof s> => s !== null);

    // Build index and score (fast: point sampling, no polygon intersection)
    const index = new ShadowIndex(shadows);
    const { shadeScore } = scorePolyline(encodedPolyline, index);
    results.push({ hour, score: shadeScore, isNight: false });
  }

  return results;
}

export function bestShadeWindow(
  timeline: HourlyShade[]
): { startHour: number; endHour: number; score: number } | null {
  const day = timeline.filter((h) => !h.isNight);
  if (day.length < 2) return null;
  let best = { startHour: 0, endHour: 0, score: -1 };
  for (let i = 0; i < day.length - 1; i++) {
    const avg = Math.round((day[i].score + day[i + 1].score) / 2);
    if (avg > best.score) best = { startHour: day[i].hour, endHour: day[i + 1].hour, score: avg };
  }
  return best.score >= 0 ? best : null;
}
