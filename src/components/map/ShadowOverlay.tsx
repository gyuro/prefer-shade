'use client';

import { Source, Layer } from 'react-map-gl/maplibre';
import type { Feature, Polygon } from 'geojson';

interface Props {
  shadows: Feature<Polygon>[];
}

export function ShadowOverlay({ shadows }: Props) {
  const geojson = {
    type: 'FeatureCollection' as const,
    features: shadows,
  };

  return (
    <Source id="shadows" type="geojson" data={geojson}>
      <Layer
        id="shadows-fill"
        type="fill"
        paint={{ 'fill-color': '#1e293b', 'fill-opacity': 0.25 }}
      />
    </Source>
  );
}
