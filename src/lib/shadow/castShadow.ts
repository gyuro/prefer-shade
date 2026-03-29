import { convex } from '@turf/convex';
import { featureCollection, point } from '@turf/helpers';
import type { Feature, Polygon, MultiPolygon, Position } from 'geojson';
import type { SunState } from '@/types/shadow';
import type { BuildingFeature } from '@/types/building';

const MIN_ALTITUDE_RAD = 0.087; // ~5° — below this shadows become unreliably long
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Displace a vertex by distM meters in bearingDeg direction.
 * Uses flat-earth approximation — accurate to <0.1% for distances < 500m.
 * ~10× faster than turf.destination (no geodesic overhead).
 */
function displaceVertex(lng: number, lat: number, bearingDeg: number, distM: number): Position {
  const br = bearingDeg * DEG_TO_RAD;
  const R = 6371000;
  const dLat = (distM * Math.cos(br) / R) * RAD_TO_DEG;
  const dLng = (distM * Math.sin(br) / (R * Math.cos(lat * DEG_TO_RAD))) * RAD_TO_DEG;
  return [lng + dLng, lat + dLat];
}

export function castBuildingShadow(
  building: BuildingFeature,
  sun: SunState
): Feature<Polygon> | null {
  if (!sun.isDay || sun.altitude < MIN_ALTITUDE_RAD) return null;

  const height = building.properties.height;
  const shadowLengthM = height / Math.tan(sun.altitude);

  // SunCalc azimuth: 0=south, increases westward → convert to geographic bearing
  const geoBearing = (sun.azimuth * RAD_TO_DEG + 180) % 360;
  const shadowBearing = (geoBearing + 180) % 360;

  const coords = extractCoordinates(building.geometry);
  if (coords.length === 0) return null;

  // Displace each vertex using fast flat-earth math (was: turf.destination per vertex)
  const displaced = coords.map(([lng, lat]) => displaceVertex(lng, lat, shadowBearing, shadowLengthM));

  const allPoints = featureCollection([
    ...coords.map((c) => point(c)),
    ...displaced.map((c) => point(c)),
  ]);

  const hull = convex(allPoints);
  return hull as Feature<Polygon> | null;
}

function extractCoordinates(geometry: Polygon | MultiPolygon): Position[] {
  if (geometry.type === 'Polygon') return geometry.coordinates[0] ?? [];
  return geometry.coordinates.flatMap((poly) => poly[0] ?? []);
}
