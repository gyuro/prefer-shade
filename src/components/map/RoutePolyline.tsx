'use client';

import { Source, Layer } from 'react-map-gl/maplibre';
import { decode } from '@googlemaps/polyline-codec';
import type { ScoredRoute } from '@/types/route';

interface Props {
  route: ScoredRoute;
  isSelected: boolean;
  zIndex: number;
}

export function RoutePolyline({ route, isSelected }: Props) {
  const isShaded = route.routeLabel === 'MOST_SHADED';
  const color = isShaded ? '#22c55e' : '#3b82f6';
  const id = `route-${route.routeLabel.toLowerCase()}`;

  const geojson = {
    type: 'FeatureCollection' as const,
    features: [{
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        // MapLibre GeoJSON coords: [lng, lat]
        coordinates: decode(route.encodedPolyline, 5).map(([lat, lng]) => [lng, lat]),
      },
      properties: {},
    }],
  };

  return (
    <Source id={id} type="geojson" data={geojson}>
      <Layer
        id={`${id}-halo`}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': '#ffffff',
          'line-width': isSelected ? 10 : 7,
          'line-opacity': isSelected ? 0.6 : 0.2,
        }}
      />
      <Layer
        id={`${id}-line`}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': color,
          'line-width': isSelected ? 6 : 4,
          'line-opacity': isSelected ? 1.0 : 0.4,
        }}
      />
    </Source>
  );
}
