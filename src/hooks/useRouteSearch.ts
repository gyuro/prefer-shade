'use client';

import { useState, useCallback, useRef } from 'react';
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
  /**
   * 0–100 while shadow data is loading; null when idle or complete.
   * Drives the progress pill shown on the map.
   */
  shadowPercent: number | null;
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
  shadowPercent: null,
};

export function useRouteSearch() {
  const [state, setState] = useState<ExtendedState>(IDLE);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const search = useCallback(async (
    origin: LatLng,
    destination: LatLng,
    time?: Date,
    options: RouteOptions = ROUTE_PRESETS.balanced,
    weather?: WeatherData | null,
    stops?: LatLng[],
  ) => {
    const userStops = stops ?? [];
    stopTimer();
    setState((s) => ({ ...s, status: 'routing', fastestRoute: null, shadedRoute: null, shadows: [], error: null, shadowPercent: null }));

    try {
      // Start building fetch immediately (parallel with route fetch)
      const roughBbox = expandBbox(pointsBbox([origin, destination, ...userStops]), 500);
      const buildingsPromise = fetchBuildings(roughBbox);

      // ── Routes first (fast) ────────────────────────────────────────────────
      const candidates = await fetchRoutes({
        origin,
        destination,
        intermediates: userStops.length > 0 ? userStops : undefined,
      });
      if (candidates.length === 0) throw new Error('No routes found between these locations.');

      const fastest = candidates[0];
      const emptyIndex = new ShadowIndex([]);
      const routePlaceholder = scoreRouteWithIndex(fastest, emptyIndex, 'FASTEST');

      // Show fastest route immediately; start asymptotic progress simulation.
      // Approaches ~85 % over time (never reaches it) — jumps to 100 % when
      // buildings actually arrive so the percentage always feels accurate.
      const fetchStart = Date.now();
      setState((s) => ({ ...s, status: 'scoring', fastestRoute: routePlaceholder, shadedRoute: null, shadows: [], shadowPercent: 5 }));

      stopTimer();
      timerRef.current = setInterval(() => {
        const t = (Date.now() - fetchStart) / 1000;
        // Asymptotic curve: 85 * (1 - e^(-t/12)), capped at 85
        const pct = Math.min(Math.round(85 * (1 - Math.exp(-t / 12))), 85);
        setState((s) => s.status === 'scoring' ? { ...s, shadowPercent: Math.max(pct, 5) } : s);
      }, 300);

      // ── Precise bbox from actual route polylines ───────────────────────────
      const allRoutePoints: LatLng[] = candidates.flatMap((c) =>
        decode(c.encodedPolyline, 5).map(([lat, lng]) => ({ lat, lng }))
      );
      const routeBbox = expandBbox(pointsBbox(allRoutePoints), 150);

      // Wait for rough bbox to cache, then precise bbox is an instant cache hit.
      const buildings = await buildingsPromise
        .then(() => fetchBuildings(routeBbox))
        .catch(() => fetchBuildings(routeBbox).catch(() => []));

      stopTimer();

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

      // Flash 100 % so the user sees completion, then hide after a short delay.
      setState({
        status: 'done',
        fastestRoute: scoredFastest,
        shadedRoute: scoredShaded,
        selectedRoute: weather?.shadeRelevance === 'none' ? 'fastest' : initialSelectedRoute,
        error: null,
        shadows,
        shadowPercent: 100,
      });
      setTimeout(() => setState((s) => s.status === 'done' ? { ...s, shadowPercent: null } : s), 700);

      if (weather?.shadeRelevance === 'none') return;

      // Skip shadow waypoint optimisation when user already defined fixed stops —
      // the route is already constrained, and re-routing through additional
      // shade waypoints could violate the user's intended path.
      if (userStops.length > 0) return;

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
      stopTimer();
      setState({ status: 'error', fastestRoute: null, shadedRoute: null, selectedRoute: 'shaded', error: err instanceof Error ? err.message : String(err), shadows: [], shadowPercent: null });
    }
  }, [stopTimer]);

  const selectRoute = useCallback((which: 'fastest' | 'shaded') => {
    setState((s) => ({ ...s, selectedRoute: which }));
  }, []);

  const setError = useCallback((msg: string) => {
    stopTimer();
    setState({ ...IDLE, status: 'error', error: msg });
  }, [stopTimer]);

  const reset = useCallback(() => {
    stopTimer();
    setState(IDLE);
  }, [stopTimer]);

  return { ...state, search, selectRoute, reset, setError };
}
