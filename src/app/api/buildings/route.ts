import { NextRequest, NextResponse } from 'next/server';

// Try mirrors in order — overpass-api.de is the most heavily loaded
const OVERPASS_MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

export const maxDuration = 30; // seconds — needed for Vercel/Next.js edge timeout

export async function POST(req: NextRequest) {
  const { bbox } = await req.json(); // [south, west, north, east]
  const [s, w, n, e] = bbox as number[];

  const query = `[out:json][timeout:25];(way["building"](${s},${w},${n},${e});relation["building"]["type"="multipolygon"](${s},${w},${n},${e}););out body;>;out skel qt;`;

  let lastError = '';

  for (const url of OVERPASS_MIRRORS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(27_000),
      });

      if (!response.ok) {
        lastError = `${url} returned ${response.status}`;
        continue;
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (err) {
      lastError = String(err);
    }
  }

  return NextResponse.json({ error: `All Overpass mirrors failed: ${lastError}` }, { status: 502 });
}
