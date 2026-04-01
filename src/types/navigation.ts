export type TurnDirection =
  | 'straight'
  | 'slight_left'
  | 'left'
  | 'sharp_left'
  | 'slight_right'
  | 'right'
  | 'sharp_right'
  | 'arrive';

export interface TurnInstruction {
  /** Index into the decoded polyline coords array */
  pointIndex: number;
  /** Cumulative distance from route start to this point, metres */
  distanceFromStart: number;
  direction: TurnDirection;
  label: string;
}

export interface LiveLocation {
  lat: number;
  lng: number;
  /** GPS course (direction of travel), degrees CW from north. null when stationary. */
  heading: number | null;
  accuracy: number;
}
