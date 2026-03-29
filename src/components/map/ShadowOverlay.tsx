'use client';

import { Polygon } from '@vis.gl/react-google-maps';
import type { Feature, Polygon as GeoPolygon } from 'geojson';

interface Props {
  shadows: Feature<GeoPolygon>[];
}

export function ShadowOverlay({ shadows }: Props) {
  return (
    <>
      {shadows.map((shadow, i) => {
        const paths = shadow.geometry.coordinates.map((ring) =>
          ring.map(([lng, lat]) => ({ lat, lng }))
        );
        return (
          <Polygon
            key={i}
            paths={paths}
            fillColor="#1e293b"
            fillOpacity={0.25}
            strokeColor="#334155"
            strokeOpacity={0.1}
            strokeWeight={0}
            zIndex={0}
          />
        );
      })}
    </>
  );
}
