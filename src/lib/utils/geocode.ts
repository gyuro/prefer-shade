import type { LatLng } from '@/types/route';

/**
 * Geocode a free-text address via the server-side proxy (no Maps JS SDK required).
 */
export async function geocodeAddress(address: string): Promise<LatLng> {
  const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error ?? 'Geocoding failed');
  }
  return { lat: data.lat, lng: data.lng };
}
