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
import type { LatLng, RouteSearchState, ScoredRoute } from '@/types/route';

interface ExtendedState extends RouteSearchState {
  shadows: Feature<Polygon>[];
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

  const search = useCallback(async (origin: LatLng, destination: LatLng, time?: Date) => {
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

      // ── Step 4: Score fastest route (synchronous, no Turf in hot path) ──
      const scoredFastest: ScoredRoute = scoreRouteWithIndex(fastest, index, 'FASTEST');

      // ── Step 5: Optimize waypoints (uses same index, no extra intersection ops) ──
      const waypoints = optimizeWaypoints(fastest.encodedPolyline, index);

      let scoredShaded: ScoredRoute = { ...scoredFastest, routeLabel: 'MOST_SHADED' };

      if (waypoints.length > 0) {
        // ── Step 6: Fetch waypoint route + score (re-use same shadow index) ──
        const shadedCandidates = await fetchRoutes({ origin, destination, intermediates: waypoints });
        if (shadedCandidates.length > 0) {
          const scored = scoreRouteWithIndex(shadedCandidates[0], index, 'MOST_SHADED');
          scored.waypoints = waypoints;
          if (scored.shadeScore > scoredFastest.shadeScore) {
            scoredShaded = scored;
          }
        }
      }

      setState({
        status: 'done',
        fastestRoute: scoredFastest,
        shadedRoute: scoredShaded,
        selectedRoute: scoredShaded.shadeScore > scoredFastest.shadeScore ? 'shaded' : 'fastest',
        error: null,
        shadows, // expose for map overlay — no second computation needed in page.tsx
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

  const reset = useCallback(() => {
    setState({ status: 'idle', fastestRoute: null, shadedRoute: null, selectedRoute: 'shaded', error: null, shadows: [] });
  }, []);

  return { ...state, search, selectRoute, reset };
}
