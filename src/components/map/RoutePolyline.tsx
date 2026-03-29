'use client';

import { Polyline } from '@vis.gl/react-google-maps';
import { decode } from '@googlemaps/polyline-codec';
import type { ScoredRoute } from '@/types/route';

interface Props {
  route: ScoredRoute;
  isSelected: boolean;
}

export function RoutePolyline({ route, isSelected }: Props) {
  const isShaded = route.routeLabel === 'MOST_SHADED';
  const path = decode(route.encodedPolyline, 5).map(([lat, lng]) => ({ lat, lng }));

  return (
    <Polyline
      path={path}
      strokeColor={isShaded ? '#22c55e' : '#3b82f6'}
      strokeOpacity={isSelected ? 1.0 : 0.35}
      strokeWeight={isSelected ? 6 : 4}
      zIndex={isSelected ? 3 : 1}
    />
  );
}
