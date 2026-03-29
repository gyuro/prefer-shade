import { NextRequest, NextResponse } from 'next/server';

const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

const FIELD_MASK = [
  'routes.duration',
  'routes.distanceMeters',
  'routes.polyline.encodedPolyline',
  'routes.routeLabels',
].join(',');

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_ROUTES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: { message: 'Routes API key not configured' } }, { status: 500 });
  }

  const clientBody = await req.json();

  const requestBody = {
    ...clientBody,
    travelMode: 'WALK',
    routingPreference: 'ROUTING_PREFERENCE_UNSPECIFIED',
    languageCode: 'en-US',
    units: 'METRIC',
  };

  const response = await fetch(ROUTES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
