import { parseOverpassResponse } from './parseOverpass';
import type { BuildingFeature } from '@/types/building';
import type { BoundingBox } from '@/types/map';

// Simple in-memory cache keyed by bbox string, TTL 30 minutes
const cache = new Map<string, { data: BuildingFeature[]; expiry: number }>();
const TTL_MS = 30 * 60 * 1000;

function bboxKey(bbox: BoundingBox): string {
  // Round to ~50m grid to improve cache hits
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return `${round(bbox.south)},${round(bbox.west)},${round(bbox.north)},${round(bbox.east)}`;
}

export async function fetchBuildings(bbox: BoundingBox): Promise<BuildingFeature[]> {
  const key = bboxKey(bbox);
  const cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  const response = await fetch('/api/buildings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bbox: [bbox.south, bbox.west, bbox.north, bbox.east] }),
  });

  if (!response.ok) {
    throw new Error(`Buildings API error: ${response.status}`);
  }

  const overpassJson = await response.json();
  const buildings = parseOverpassResponse(overpassJson);

  cache.set(key, { data: buildings, expiry: Date.now() + TTL_MS });
  return buildings;
}
