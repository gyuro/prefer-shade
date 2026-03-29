import { NextRequest, NextResponse } from 'next/server';

// OSRM public demo — free, no API key. For high-volume production use,
// self-host OSRM or switch to OpenRouteService free tier.
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/foot';

export const maxDuration = 20;

export async function POST(req: NextRequest) {
  const { origin, destination, intermediates } = await req.json() as {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    intermediates?: { lat: number; lng: number }[];
  };

  // OSRM coords format: lng,lat — semicolon-separated
  const waypoints = [origin, ...(intermediates ?? []), destination];
  const coords = waypoints.map((p) => `${p.lng},${p.lat}`).join(';');
  const hasIntermediates = (intermediates ?? []).length > 0;

  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'polyline', // precision 5 — matches @googlemaps/polyline-codec default
    alternatives: hasIntermediates ? 'false' : 'true',
  });

  try {
    const res = await fetch(`${OSRM_BASE}/${coords}?${params}`, {
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `OSRM error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
