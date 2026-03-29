import osmtogeojson from 'osmtogeojson';
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import type { BuildingFeature, BuildingProperties } from '@/types/building';

function extractHeight(tags: Record<string, string>): number {
  if (tags['height']) {
    const h = parseFloat(tags['height']);
    if (!isNaN(h) && h > 0) return h;
  }
  if (tags['building:height']) {
    const h = parseFloat(tags['building:height']);
    if (!isNaN(h) && h > 0) return h;
  }
  if (tags['building:levels']) {
    const levels = parseFloat(tags['building:levels']);
    if (!isNaN(levels) && levels > 0) return levels * 3.5;
  }
  const type = tags['building'] ?? '';
  if (['commercial', 'office', 'hotel', 'retail', 'apartments'].includes(type)) return 12;
  return 4; // default residential
}

/**
 * Convert raw Overpass API JSON response to typed building features.
 */
export function parseOverpassResponse(overpassJson: unknown): BuildingFeature[] {
  const geojson = osmtogeojson(overpassJson as Parameters<typeof osmtogeojson>[0]) as FeatureCollection;
  const buildings: BuildingFeature[] = [];

  for (const feature of geojson.features) {
    if (!feature.geometry) continue;
    const { type } = feature.geometry;
    if (type !== 'Polygon' && type !== 'MultiPolygon') continue;

    const tags = (feature.properties ?? {}) as Record<string, string>;
    const height = extractHeight(tags);
    const id = String(feature.id ?? Math.random());

    buildings.push({
      ...feature,
      geometry: feature.geometry as Polygon | MultiPolygon,
      properties: {
        id,
        height,
        levels: tags['building:levels'] ? parseFloat(tags['building:levels']) : undefined,
        type: tags['building'],
      } satisfies BuildingProperties,
    } as BuildingFeature);
  }

  return buildings;
}
