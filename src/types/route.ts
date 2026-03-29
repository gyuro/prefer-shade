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

export interface RouteSearchState {
  status: 'idle' | 'locating' | 'routing' | 'scoring' | 'done' | 'error';
  fastestRoute: ScoredRoute | null;
  shadedRoute: ScoredRoute | null;
  selectedRoute: 'fastest' | 'shaded';
  error: string | null;
}
