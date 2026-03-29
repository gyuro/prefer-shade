export interface SunState {
  /** Altitude above horizon in radians (negative = below horizon) */
  altitude: number;
  /** Azimuth in SunCalc convention: 0=south, clockwise toward west */
  azimuth: number;
  /** Whether sun is above the horizon */
  isDay: boolean;
}

export interface ShadowPolygon {
  buildingId: string;
  /** GeoJSON polygon coordinates [lng, lat] */
  coords: number[][][];
  /** Shade coverage fraction 0–1 for a given segment */
  coverage?: number;
}
