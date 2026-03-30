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

  const [s, w, n, e] = [bbox.south, bbox.west, bbox.north, bbox.east];
  const query = `[out:json][timeout:25];(way["building"](${s},${w},${n},${e});relation["building"]["type"="multipolygon"](${s},${w},${n},${e}););out body;>;out skel qt;`;
  const body = `data=${encodeURIComponent(query)}`;

  const mirrors = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass-api.de/api/interpreter',
  ];

  let overpassJson: unknown;
  let lastError = '';
  for (const url of mirrors) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) { lastError = `${url} returned ${res.status}`; continue; }
      overpassJson = await res.json();
      break;
    } catch (err) {
      lastError = String(err);
    }
  }

  if (!overpassJson) {
    throw new Error(`Buildings fetch failed: ${lastError}`);
  }
  const buildings = parseOverpassResponse(overpassJson);

  cache.set(key, { data: buildings, expiry: Date.now() + TTL_MS });
  return buildings;
}
