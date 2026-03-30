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
  /** Minimum shade-point improvement over the fastest route required to accept a waypoint route */
  minShadeGain: number;
}

export const ROUTE_PRESETS = {
  speed:    { maxDetourPct: 5,  minShadeGain: 10 },
  balanced: { maxDetourPct: 20, minShadeGain: 5  },
  shade:    { maxDetourPct: 35, minShadeGain: 2  },
} satisfies Record<string, RouteOptions>;

export type RoutePreset = keyof typeof ROUTE_PRESETS;

export interface RouteSearchState {
  status: 'idle' | 'locating' | 'routing' | 'scoring' | 'done' | 'error';
  fastestRoute: ScoredRoute | null;
  shadedRoute: ScoredRoute | null;
  selectedRoute: 'fastest' | 'shaded';
  error: string | null;
}
