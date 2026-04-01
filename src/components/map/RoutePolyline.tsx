'use client';

import { useEffect } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/maplibre';
import { decode } from '@googlemaps/polyline-codec';
import type { ScoredRoute } from '@/types/route';

interface Props {
  route: ScoredRoute;
  isSelected: boolean;
  zIndex: number;
  onSelect?: () => void;
}

export function RoutePolyline({ route, isSelected, onSelect }: Props) {
  const { current: map } = useMap();
  const isShaded = route.routeLabel === 'MOST_SHADED';
  const color = isShaded ? '#22c55e' : '#3b82f6';
  const id = `route-${route.routeLabel.toLowerCase()}`;
  const hitId = `${id}-hit`;

  const geojson = {
    type: 'FeatureCollection' as const,
    features: [{
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: decode(route.encodedPolyline, 5).map(([lat, lng]) => [lng, lat]),
      },
      properties: {},
    }],
  };

  // Register click + hover handlers on the MapLibre map instance
  useEffect(() => {
    if (!map || !onSelect) return;

    const onClick = () => onSelect();
    const onEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const onLeave = () => { map.getCanvas().style.cursor = ''; };

    map.on('click', hitId, onClick);
    map.on('mouseenter', hitId, onEnter);
    map.on('mouseleave', hitId, onLeave);

    return () => {
      map.off('click', hitId, onClick);
      map.off('mouseenter', hitId, onEnter);
      map.off('mouseleave', hitId, onLeave);
      map.getCanvas().style.cursor = '';
    };
  }, [map, onSelect, hitId]);

  return (
    <Source id={id} type="geojson" data={geojson}>
      <Layer
        id={`${id}-halo`}
        type="line"
        layout={{ 'line-cap': 'butt', 'line-join': 'round' }}
        paint={{
          'line-color': '#ffffff',
          'line-width': isSelected ? 10 : 7,
          'line-opacity': isSelected ? 0.6 : 0.2,
        }}
      />
      <Layer
        id={`${id}-line`}
        type="line"
        layout={{ 'line-cap': 'butt', 'line-join': 'round' }}
        paint={{
          'line-color': color,
          'line-width': isSelected ? 6 : 4,
          'line-opacity': isSelected ? 1.0 : 0.4,
        }}
      />
      {/* Wide transparent hit area for easy tap/click */}
      <Layer
        id={hitId}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': 'transparent', 'line-width': 20 }}
      />
    </Source>
  );
}
