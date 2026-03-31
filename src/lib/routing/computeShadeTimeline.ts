import { decode } from '@googlemaps/polyline-codec';
import { fetchBuildings } from '@/lib/buildings/fetchBuildings';
import { castBuildingShadow, getSunPosition } from '@/lib/shadow';
import { ShadowIndex } from '@/lib/shadow/shadowIndex';
import { scorePolyline } from './scoreRoute';
import { expandBbox, pointsBbox } from '@/lib/utils/geo';

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
 * Compute shade score per hour for the given route.
 *
 * Performance notes:
 * - Buildings are fetched once (usually a cache hit from the route-search fetch).
 * - Shadow polygons are recast per hour using fast flat-earth math.
 * - The loop yields to the browser event loop between each hour so the UI
 *   (buttons, maps) stays responsive throughout the computation.
 * - Polyline scoring uses a coarser 20 m sample interval (vs 6 m for route
 *   scoring) since the timeline chart only needs approximate values.
 */
export async function computeShadeTimeline(
  encodedPolyline: string,
  date: Date
): Promise<HourlyShade[]> {
  const routeCoords = decode(encodedPolyline, 5).map(([lat, lng]) => ({ lat, lng }));
  if (routeCoords.length === 0) return [];

  const mid = routeCoords[Math.floor(routeCoords.length / 2)];
  // Use a 500 m expansion — matches the rough bbox from useRouteSearch, maximising
  // the chance that fetchBuildings returns a cached result (no second Overpass call).
  const bbox = expandBbox(pointsBbox(routeCoords), 500);

  const buildings = await fetchBuildings(bbox);

  const results: HourlyShade[] = [];

  for (let hour = 5; hour <= 21; hour++) {
    // Yield to the browser event loop so clicks/animations stay responsive.
    await new Promise<void>((r) => setTimeout(r, 0));

    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);

    const sun = getSunPosition(d, mid.lat, mid.lng);

    if (!sun.isDay) {
      results.push({ hour, score: 0, isNight: true });
      continue;
    }

    const shadows = buildings
      .map((b) => castBuildingShadow(b, sun))
      .filter((s): s is NonNullable<typeof s> => s !== null);

    const index = new ShadowIndex(shadows);
    // 20 m sample interval — 3× faster than the 6 m used for route scoring,
    // accurate enough for the per-hour bar chart.
    const { shadeScore } = scorePolyline(encodedPolyline, index, 20);
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
