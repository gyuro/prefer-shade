import type { Feature, Polygon, MultiPolygon } from 'geojson';

export interface BuildingProperties {
  id: string;
  height: number; // meters
  levels?: number;
  type?: string;
}

export type BuildingFeature = Feature<Polygon | MultiPolygon, BuildingProperties>;
