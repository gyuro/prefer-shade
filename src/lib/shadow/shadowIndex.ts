/**
 * Grid-based spatial index for shadow polygons.
 * Zero Turf.js dependency — pure math only.
 * Lookup is O(1) average via grid cell, point-in-polygon uses raw ray-casting.
 */

interface IndexedShadow {
  ring: number[][];      // outer ring [lng, lat][]
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

/** ~55m per cell at equator — shadows rarely span more than 2–3 cells */
const CELL_DEG = 0.0005;

function cellKey(lat: number, lng: number): string {
  return `${(lng / CELL_DEG) | 0},${(lat / CELL_DEG) | 0}`;
}

/** Ray-casting point-in-polygon — works for convex and concave polygons */
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

import type { Feature, Polygon } from 'geojson';

export class ShadowIndex {
  private grid = new Map<string, IndexedShadow[]>();

  constructor(shadows: Feature<Polygon>[]) {
    for (const shadow of shadows) {
      const ring = shadow.geometry.coordinates[0] as number[][];
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      const s: IndexedShadow = { ring, minLng, maxLng, minLat, maxLat };

      // Register shadow in every grid cell its bbox overlaps
      const x0 = (minLng / CELL_DEG) | 0;
      const x1 = Math.ceil(maxLng / CELL_DEG);
      const y0 = (minLat / CELL_DEG) | 0;
      const y1 = Math.ceil(maxLat / CELL_DEG);
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          const key = `${x},${y}`;
          let cell = this.grid.get(key);
          if (!cell) { cell = []; this.grid.set(key, cell); }
          cell.push(s);
        }
      }
    }
  }

  isInShade(lat: number, lng: number): boolean {
    const candidates = this.grid.get(cellKey(lat, lng));
    if (!candidates) return false;
    for (const s of candidates) {
      if (lng < s.minLng || lng > s.maxLng || lat < s.minLat || lat > s.maxLat) continue;
      if (pointInRing(lng, lat, s.ring)) return true;
    }
    return false;
  }
}
