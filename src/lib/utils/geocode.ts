import type { LatLng } from '@/types/route';

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

/** Reverse-geocode a coordinate to a human-readable address string. */
export async function reverseGeocodeLatLng(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'ShadeRoute/1.0 (prefer-shade)' } });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const f = data.features?.[0];
    if (!f) throw new Error();
    const p = f.properties;
    const parts = [
      p.name,
      p.street && p.housenumber ? `${p.street} ${p.housenumber}` : p.street,
      p.city,
      p.country,
    ].filter(Boolean);
    return parts.join(', ') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}
