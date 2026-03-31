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
import type { BuildingFeature } from '@/types/building';
import type { LatLng, RouteOptions, RouteSearchState, ScoredRoute } from '@/types/route';
import { ROUTE_PRESETS } from '@/types/route';
import type { WeatherData } from '@/lib/weather/fetchWeather';

interface ExtendedState extends RouteSearchState {
  shadows: Feature<Polygon>[];
}

/** Default max time to wait for Overpass buildings before proceeding without shade data */
const DEFAULT_BUILDINGS_TIMEOUT_MS = 10_000;

/**
 * Detect closed loops in a route by projecting each point onto the
 * origin→destination axis. If the projection ever retreats by more than
 * 10% of the total span, the route is doubling back on itself.
 */
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

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  // Catch promise rejection so a failed buildings fetch degrades gracefully
  // (no shadows) rather than aborting the whole search with an error.
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
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

  const search = useCallback(async (
    origin: LatLng,
    destination: LatLng,
    time?: Date,
    options: RouteOptions = ROUTE_PRESETS.balanced,
    weather?: WeatherData | null,
  ) => {
    setState((s) => ({ ...s, status: 'routing', fastestRoute: null, shadedRoute: null, shadows: [], error: null }));

    try {
      // Rough bbox from endpoints — lets building fetch start before routes arrive
      const roughBbox = expandBbox(pointsBbox([origin, destination]), 500);

      // ── Fire buildings fetch immediately — it's the slow one (Overpass API) ──
      const buildingsPromise = fetchBuildings(roughBbox);

      // ── Await routes first — OSRM is fast (~0.5–1 s) ─────────────────────
      const candidates = await fetchRoutes({ origin, destination });
      if (candidates.length === 0) throw new Error('No routes found between these locations.');

      const fastest = candidates[0];
      const emptyIndex = new ShadowIndex([]);

      // Show the fastest route on the map immediately while shade loads
      const routePlaceholder = scoreRouteWithIndex(fastest, emptyIndex, 'FASTEST');
      setState((s) => ({
        ...s,
        status: 'scoring',
        fastestRoute: routePlaceholder,
        shadedRoute: { ...routePlaceholder, routeLabel: 'MOST_SHADED' },
        shadows: [],
      }));

      // ── Precise bbox from actual route polylines ───────────────────────────
      // The rough bbox (origin→dest straight line) misses buildings along the
      // shaded route's detours. After routes arrive we know the exact paths.
      const allRoutePoints: LatLng[] = candidates.flatMap((c) =>
        decode(c.encodedPolyline, 5).map(([lat, lng]) => ({ lat, lng }))
      );
      const routeBbox = expandBbox(pointsBbox(allRoutePoints), 150);

      // fetchBuildings returns cached data instantly if roughBbox already covers
      // routeBbox; otherwise fires a fresh Overpass query for the exact area.
      const buildingTimeoutMs = (options.buildingTimeoutSecs ?? DEFAULT_BUILDINGS_TIMEOUT_MS / 1000) * 1000;
      const buildings: BuildingFeature[] = await withTimeout(
        fetchBuildings(routeBbox),
        buildingTimeoutMs,
        [],
      );

      // Rough fetch is no longer needed — cancel its effect by ignoring it
      void buildingsPromise;

      // ── Cast shadow polygons ────────────────────────────────────────────────
      const now = time ?? new Date();
      const midCoords = decode(fastest.encodedPolyline, 5);
      const mid = midCoords[Math.floor(midCoords.length / 2)];
      const sun = getSunPosition(now, mid[0], mid[1]);

      const shadows: Feature<Polygon>[] = buildings
        .map((b) => castBuildingShadow(b, sun))
        .filter((s): s is NonNullable<typeof s> => s !== null);

      const index = new ShadowIndex(shadows);

      // ── Score fastest + OSRM alternatives ─────────────────────────────────
      const scoredFastest: ScoredRoute = scoreRouteWithIndex(fastest, index, 'FASTEST');

      let scoredShaded: ScoredRoute = { ...scoredFastest, routeLabel: 'MOST_SHADED' };
      for (let i = 1; i < candidates.length; i++) {
        const alt = scoreRouteWithIndex(candidates[i], index, 'MOST_SHADED');
        if (alt.shadeScore >= scoredShaded.shadeScore) scoredShaded = alt;
      }

      // ── Skip waypoint optimisation when weather makes shade irrelevant ──────
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

      // ── Waypoint optimisation — probe shadier parallel streets ─────────────
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
            const distOk  = candidate.distanceMeters  <= scoredFastest.distanceMeters  * MAX_DETOUR_DIST;
            const timeOk  = candidate.durationSeconds <= scoredFastest.durationSeconds * MAX_DETOUR_TIME;
            const noLoop  = !hasBacktracking(candidate.encodedPolyline, origin, destination);
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
          // Waypoint route failed — use best so far
        }
      }

      setState({
        status: 'done',
        fastestRoute: scoredFastest,
        shadedRoute: scoredShaded,
        selectedRoute:
          scoredShaded.encodedPolyline !== scoredFastest.encodedPolyline ||
          scoredShaded.shadeScore > scoredFastest.shadeScore
            ? 'shaded'
            : 'fastest',
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
