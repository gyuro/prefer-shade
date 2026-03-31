'use client';

import { useState, useCallback } from 'react';
import { decode } from '@googlemaps/polyline-codec';
import { fetchRoutes } from '@/lib/routing/fetchRoutes';
import { scoreRouteWithIndex } from '@/lib/routing/scoreRoute';
import { optimizeWaypoints } from '@/lib/routing/optimizeWaypoints';
import { fetchBuildings } from '@/lib/buildings/fetchBuildings';
import { castBuildingShadow, getSunPosition } from '@/lib/shadow';
import { ShadowIndex } from '@/lib/shadow/shadowIndex';
import { expandBbox, pointsBbox } from '@/lib/utils/geo';
import type { Feature, Polygon } from 'geojson';
import type { LatLng, RouteOptions, RouteSearchState, ScoredRoute } from '@/types/route';
import { ROUTE_PRESETS } from '@/types/route';
import type { WeatherData } from '@/lib/weather/fetchWeather';

interface ExtendedState extends RouteSearchState {
  shadows: Feature<Polygon>[];
  /** true while Overpass building data is still loading */
  shadowLoading: boolean;
}

function hasBacktracking(encodedPolyline: string, origin: LatLng, destination: LatLng): boolean {
  const coords = decode(encodedPolyline, 5);
  const dx = destination.lng - origin.lng;
  const dy = destination.lat - origin.lat;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return false;
  let maxT = -Infinity;
  for (const [lat, lng] of coords) {
    const t = ((lng - origin.lng) * dx + (lat - origin.lat) * dy) / len2;
    if (t > maxT) maxT = t;
    else if (maxT - t > 0.10) return true;
  }
  return false;
}

const IDLE: ExtendedState = {
  status: 'idle',
  fastestRoute: null,
  shadedRoute: null,
  selectedRoute: 'shaded',
  error: null,
  shadows: [],
  shadowLoading: false,
};

export function useRouteSearch() {
  const [state, setState] = useState<ExtendedState>(IDLE);

  const search = useCallback(async (
    origin: LatLng,
    destination: LatLng,
    time?: Date,
    options: RouteOptions = ROUTE_PRESETS.balanced,
    weather?: WeatherData | null,
  ) => {
    setState((s) => ({ ...s, status: 'routing', fastestRoute: null, shadedRoute: null, shadows: [], error: null, shadowLoading: false }));

    try {
      // Start building fetch immediately (parallel with route fetch)
      const roughBbox = expandBbox(pointsBbox([origin, destination]), 500);
      const buildingsPromise = fetchBuildings(roughBbox);

      // ── Routes first (fast) ────────────────────────────────────────────────
      const candidates = await fetchRoutes({ origin, destination });
      if (candidates.length === 0) throw new Error('No routes found between these locations.');

      const fastest = candidates[0];
      const emptyIndex = new ShadowIndex([]);
      const routePlaceholder = scoreRouteWithIndex(fastest, emptyIndex, 'FASTEST');

      // Show fastest route immediately while buildings finish loading
      setState((s) => ({ ...s, status: 'scoring', fastestRoute: routePlaceholder, shadedRoute: null, shadows: [], shadowLoading: true }));

      // ── Precise bbox from actual route polylines ───────────────────────────
      const allRoutePoints: LatLng[] = candidates.flatMap((c) =>
        decode(c.encodedPolyline, 5).map(([lat, lng]) => ({ lat, lng }))
      );
      const routeBbox = expandBbox(pointsBbox(allRoutePoints), 150);

      // Wait for roughBbox to complete (already in-flight), then fetch precise
      // bbox — which is an instant cache hit because roughBbox covers it.
      // No timeout: we always wait for real data so shadows are never missing.
      const buildings = await buildingsPromise
        .then(() => fetchBuildings(routeBbox))
        .catch(() => fetchBuildings(routeBbox).catch(() => []));

      // ── Cast shadow polygons ───────────────────────────────────────────────
      const now = time ?? new Date();
      const midCoords = decode(fastest.encodedPolyline, 5);
      const mid = midCoords[Math.floor(midCoords.length / 2)];
      const sun = getSunPosition(now, mid[0], mid[1]);

      const shadows: Feature<Polygon>[] = buildings
        .map((b) => castBuildingShadow(b, sun))
        .filter((s): s is NonNullable<typeof s> => s !== null);

      const index = new ShadowIndex(shadows);

      // ── Score routes ───────────────────────────────────────────────────────
      const scoredFastest: ScoredRoute = scoreRouteWithIndex(fastest, index, 'FASTEST');
      let scoredShaded: ScoredRoute = { ...scoredFastest, routeLabel: 'MOST_SHADED' };
      for (let i = 1; i < candidates.length; i++) {
        const alt = scoreRouteWithIndex(candidates[i], index, 'MOST_SHADED');
        if (alt.shadeScore >= scoredShaded.shadeScore) scoredShaded = alt;
      }

      const initialSelectedRoute =
        scoredShaded.encodedPolyline !== scoredFastest.encodedPolyline ||
        scoredShaded.shadeScore > scoredFastest.shadeScore ? 'shaded' : 'fastest';

      // Mark done — shadow overlay and loading pill update together
      setState({
        status: 'done',
        fastestRoute: scoredFastest,
        shadedRoute: scoredShaded,
        selectedRoute: weather?.shadeRelevance === 'none' ? 'fastest' : initialSelectedRoute,
        error: null,
        shadows,
        shadowLoading: false,
      });

      if (weather?.shadeRelevance === 'none') return;

      // ── Waypoint optimisation (silent background refinement) ──────────────
      const waypoints = optimizeWaypoints(fastest.encodedPolyline, index);
      const weatherBoost        = weather?.shadeRelevance === 'high' ? 1.3 : 1;
      const weatherGainDiscount = weather?.shadeRelevance === 'high' ? 0.7 : 1;
      const MAX_DETOUR_DIST = 1 + (options.maxDetourPct * weatherBoost) / 100;
      const MAX_DETOUR_TIME = 1 + (options.maxDetourPct * 1.25 * weatherBoost) / 100;

      if (waypoints.length > 0) {
        try {
          const shadedCandidates = await fetchRoutes({ origin, destination, intermediates: waypoints });
          if (shadedCandidates.length > 0) {
            const candidate = shadedCandidates[0];
            const distOk = candidate.distanceMeters  <= scoredFastest.distanceMeters  * MAX_DETOUR_DIST;
            const timeOk = candidate.durationSeconds <= scoredFastest.durationSeconds * MAX_DETOUR_TIME;
            const noLoop = !hasBacktracking(candidate.encodedPolyline, origin, destination);
            if (distOk && timeOk && noLoop) {
              const scored = scoreRouteWithIndex(candidate, index, 'MOST_SHADED');
              scored.waypoints = waypoints;
              const shadeGain = scored.shadeScore - scoredFastest.shadeScore;
              if (shadeGain >= options.minShadeGain * weatherGainDiscount && scored.shadeScore >= scoredShaded.shadeScore) {
                scoredShaded = scored;
                setState((s) => s.status === 'done' ? { ...s, shadedRoute: scoredShaded, selectedRoute: 'shaded' } : s);
              }
            }
          }
        } catch { /* Waypoint route failed — keep initial scored route */ }
      }
    } catch (err) {
      setState({ status: 'error', fastestRoute: null, shadedRoute: null, selectedRoute: 'shaded', error: err instanceof Error ? err.message : String(err), shadows: [], shadowLoading: false });
    }
  }, []);

  const selectRoute = useCallback((which: 'fastest' | 'shaded') => {
    setState((s) => ({ ...s, selectedRoute: which }));
  }, []);

  const setError = useCallback((msg: string) => {
    setState({ ...IDLE, status: 'error', error: msg });
  }, []);

  const reset = useCallback(() => {
    setState(IDLE);
  }, []);

  return { ...state, search, selectRoute, reset, setError };
}
