export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteCandidate {
  encodedPolyline: string;
  durationSeconds: number;
  distanceMeters: number;
  label: 'FASTEST' | 'ALTERNATE';
}

export interface ScoredRoute extends RouteCandidate {
  /** 0–100: percentage of route length in shade */
  shadeScore: number;
  /** meters of shaded distance */
  shadedDistanceMeters: number;
  routeLabel: 'FASTEST' | 'MOST_SHADED';
  waypoints?: LatLng[];
}

export interface RouteOptions {
  /** Max % longer than the fastest route that is acceptable (e.g. 20 = +20%) */
  maxDetourPct: number;
  /** Shade-points of improvement required per 1% of extra distance */
  shadeGainPerDetourPct: number;
}

export const ROUTE_PRESETS = {
  speed:    { maxDetourPct: 5,  shadeGainPerDetourPct: 2.0 },
  balanced: { maxDetourPct: 20, shadeGainPerDetourPct: 1.0 },
  shade:    { maxDetourPct: 35, shadeGainPerDetourPct: 0.5 },
} satisfies Record<string, RouteOptions>;

export type RoutePreset = keyof typeof ROUTE_PRESETS;

export interface RouteSearchState {
  status: 'idle' | 'locating' | 'routing' | 'scoring' | 'done' | 'error';
  fastestRoute: ScoredRoute | null;
  shadedRoute: ScoredRoute | null;
  selectedRoute: 'fastest' | 'shaded';
  error: string | null;
}
