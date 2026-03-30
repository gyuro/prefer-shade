import type { LatLng } from '@/types/route';

/**
 * Geocode a free-text address via the server-side proxy (no Maps JS SDK required).
 */
export async function geocodeAddress(address: string): Promise<LatLng> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ShadeRoute/1.0 (prefer-shade)' },
  });
  if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`);
  const data = await response.json();
  const feature = data.features?.[0];
  if (!feature) throw new Error('Location not found');
  const [lng, lat] = feature.geometry.coordinates as [number, number];
  return { lat, lng };
}
