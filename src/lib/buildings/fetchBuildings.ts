import { parseOverpassResponse } from './parseOverpass';
import type { BuildingFeature } from '@/types/building';
import type { BoundingBox } from '@/types/map';

interface CacheEntry {
  data: BuildingFeature[];
  bbox: BoundingBox;
  expiry: number;
}

// In-memory cache keyed by bbox string, TTL 30 minutes
const cache = new Map<string, CacheEntry>();
const TTL_MS = 30 * 60 * 1000;

function bboxKey(bbox: BoundingBox): string {
  // Round to ~50m grid to improve cache hits on near-identical requests
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return `${round(bbox.south)},${round(bbox.west)},${round(bbox.north)},${round(bbox.east)}`;
}

/**
 * True if `outer` fully covers `inner`.
 * Small tolerance (~11 m) absorbs floating-point rounding differences.
 */
function bboxContains(outer: BoundingBox, inner: BoundingBox): boolean {
  const tol = 0.0001;
  return (
    outer.south <= inner.south + tol &&
    outer.north >= inner.north - tol &&
    outer.west  <= inner.west  + tol &&
    outer.east  >= inner.east  - tol
  );
}

export async function fetchBuildings(bbox: BoundingBox): Promise<BuildingFeature[]> {
  const now = Date.now();

  // Return data from any cached entry whose bbox already covers what we need.
  // This prevents a second Overpass fetch when the timeline asks for a smaller
  // area that is already covered by the route-search's larger rough bbox.
  for (const entry of cache.values()) {
    if (entry.expiry > now && bboxContains(entry.bbox, bbox)) {
      return entry.data;
    }
  }

  const key = bboxKey(bbox);
  const existing = cache.get(key);
  if (existing && existing.expiry > now) return existing.data;

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
  cache.set(key, { data: buildings, bbox, expiry: now + TTL_MS });
  return buildings;
}
