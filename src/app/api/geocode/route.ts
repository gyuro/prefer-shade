import { NextRequest, NextResponse } from 'next/server';

// Photon (photon.komoot.io) — free, OSM-based, no API key required
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'Missing address' }, { status: 400 });
  }

  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ShadeRoute/1.0 (shade-route-app)' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error(`Photon error: ${res.status}`);

    const data = await res.json();
    const feature = data.features?.[0];

    if (!feature) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    // Photon GeoJSON: coordinates are [lng, lat]
    const [lng, lat] = feature.geometry.coordinates as [number, number];
    return NextResponse.json({ lat, lng });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
