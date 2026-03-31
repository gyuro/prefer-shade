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
}

/**
 * Detect closed loops in a route by projecting each point onto the
 * origin→destination axis. If the projection ever retreats by more than
 * 10% of the total span, the route is doubling back on itself.
 */
function hasBacktracking(encodedPolyline: string, origin: LatLng, destination: LatLng): boolean {
  const coords = decode(encodedPolyline, 5); // [[lat, lng]]
  const dx = destination.lng - origin.lng;
  const dy = destination.lat - origin.lat;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return false;
  let maxT = -Infinity;
  for (const [lat, lng] of coords) {
    const t = ((lng - origin.lng) * dx + (lat - origin.lat) * dy) / len2;
    if (t > maxT) maxT = t;
    else if (maxT - t > 0.10) return true; // retreated >10% of origin→dest span
  }
  return false;
}

export function useRouteSearch() {
  const [state, setState] = useState<ExtendedState>({
    status: 'idle',
    fastestRoute: null,
    shadedRoute: null,
    selectedRoute: 'shaded',
    error: null,
    shadows: [],
  });

  const search = useCallback(async (origin: LatLng, destination: LatLng, time?: Date, options: RouteOptions = ROUTE_PRESETS.balanced, weather?: WeatherData | null) => {
    setState((s) => ({ ...s, status: 'routing', fastestRoute: null, shadedRoute: null, shadows: [], error: null }));

    try {
      // ── Step 1: Fetch routes + buildings IN PARALLEL ──────────────────────
      // Use a rough bbox (origin→destination + 500m) so buildings can start
      // loading immediately without waiting for the polyline.
      const roughBbox = expandBbox(pointsBbox([origin, destination]), 500);

      const [candidates, buildings] = await Promise.all([
        fetchRoutes({ origin, destination }),
        fetchBuildings(roughBbox),
      ]);

      if (candidates.length === 0) throw new Error('No routes found between these locations.');

      setState((s) => ({ ...s, status: 'scoring' }));

      // ── Step 2: Cast shadow polygons (optimized: flat-earth math, not turf.destination) ──
      const now = time ?? new Date();
      const fastest = candidates[0];
      const midCoords = decode(fastest.encodedPolyline, 5);
      const mid = midCoords[Math.floor(midCoords.length / 2)];
      const sun = getSunPosition(now, mid[0], mid[1]);

      const shadows: Feature<Polygon>[] = buildings
        .map((b) => castBuildingShadow(b, sun))
        .filter((s): s is NonNullable<typeof s> => s !== null);

      // ── Step 3: Build index ONCE — shared across all scoring + waypoint passes ──
      const index = new ShadowIndex(shadows);

      // ── Step 4: Score fastest route + any OSRM alternatives ──────────────
      const scoredFastest: ScoredRoute = scoreRouteWithIndex(fastest, index, 'FASTEST');

      // OSRM may return multiple route geometries (alternatives=true). Score them
      // all and use the shadiest as the starting point for the shaded route.
      let scoredShaded: ScoredRoute = { ...scoredFastest, routeLabel: 'MOST_SHADED' };
      for (let i = 1; i < candidates.length; i++) {
        const alt = scoreRouteWithIndex(candidates[i], index, 'MOST_SHADED');
        if (alt.shadeScore >= scoredShaded.shadeScore) {
          scoredShaded = alt;
        }
      }

      // ── Step 5: Waypoint optimisation — probe parallel streets ────────────
      // Skip shade optimisation entirely when weather makes shade irrelevant
      if (weather?.shadeRelevance === 'none') {
        setState({
          status: 'done',
          fastestRoute: scoredFastest,
          shadedRoute: { ...scoredFastest, routeLabel: 'MOST_SHADED' },
          selectedRoute: 'fastest',
          error: null,
          shadows,
        });
        return;
      }

      const waypoints = optimizeWaypoints(fastest.encodedPolyline, index);

      // Detour limits derived from user options, boosted when UV/heat is high
      const weatherBoost = weather?.shadeRelevance === 'high' ? 1.3 : 1;
      const weatherGainDiscount = weather?.shadeRelevance === 'high' ? 0.7 : 1;
      const MAX_DETOUR_DIST = 1 + (options.maxDetourPct * weatherBoost) / 100;
      const MAX_DETOUR_TIME = 1 + (options.maxDetourPct * 1.25 * weatherBoost) / 100;

      if (waypoints.length > 0) {
        // ── Step 6: Fetch waypoint route + score (re-use same shadow index) ──
        // Failures here are non-fatal — fall back to the best route found so far.
        try {
          const shadedCandidates = await fetchRoutes({ origin, destination, intermediates: waypoints });
          if (shadedCandidates.length > 0) {
            const candidate = shadedCandidates[0];
            const distOk = candidate.distanceMeters <= scoredFastest.distanceMeters * MAX_DETOUR_DIST;
            const timeOk = candidate.durationSeconds <= scoredFastest.durationSeconds * MAX_DETOUR_TIME;
            const noLoop = !hasBacktracking(candidate.encodedPolyline, origin, destination);
            if (distOk && timeOk && noLoop) {
              const scored = scoreRouteWithIndex(candidate, index, 'MOST_SHADED');
              scored.waypoints = waypoints;
              const shadeGain = scored.shadeScore - scoredFastest.shadeScore;
              if (shadeGain >= options.minShadeGain * weatherGainDiscount && scored.shadeScore >= scoredShaded.shadeScore) {
                scoredShaded = scored;
              }
            }
          }
        } catch {
          // Waypoint route failed (e.g. OSRM couldn't snap a waypoint) — use best so far
        }
      }

      setState({
        status: 'done',
        fastestRoute: scoredFastest,
        shadedRoute: scoredShaded,
        selectedRoute: scoredShaded.encodedPolyline !== scoredFastest.encodedPolyline || scoredShaded.shadeScore > scoredFastest.shadeScore ? 'shaded' : 'fastest',
        error: null,
        shadows,
      });
    } catch (err) {
      setState({
        status: 'error',
        fastestRoute: null,
        shadedRoute: null,
        selectedRoute: 'shaded',
        error: err instanceof Error ? err.message : String(err),
        shadows: [],
      });
    }
  }, []);

  const selectRoute = useCallback((which: 'fastest' | 'shaded') => {
    setState((s) => ({ ...s, selectedRoute: which }));
  }, []);

  const setError = useCallback((msg: string) => {
    setState({ status: 'error', fastestRoute: null, shadedRoute: null, selectedRoute: 'shaded', error: msg, shadows: [] });
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle', fastestRoute: null, shadedRoute: null, selectedRoute: 'shaded', error: null, shadows: [] });
  }, []);

  return { ...state, search, selectRoute, reset, setError };
}
