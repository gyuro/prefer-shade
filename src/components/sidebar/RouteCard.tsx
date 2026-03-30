'use client';

import { clsx } from 'clsx';
import { Badge } from '@/components/ui/Badge';
import { ShadeScore } from './ShadeScore';
import { formatDistance, formatDuration } from '@/lib/utils/geo';
import { shadeLabel, sunExposureMinutes } from '@/lib/routing/computeShadeTimeline';
import type { ScoredRoute } from '@/types/route';

interface Props {
  route: ScoredRoute;
  isSelected: boolean;
  onSelect: () => void;
  comparedShadeScore?: number; // the other route's score, for delta display
}

export function RouteCard({ route, isSelected, onSelect, comparedShadeScore }: Props) {
  const isShaded = route.routeLabel === 'MOST_SHADED';
  const { label, icon } = shadeLabel(route.shadeScore);
  const sunMinutes = sunExposureMinutes(route.distanceMeters, route.shadeScore);
  const delta =
    comparedShadeScore !== undefined ? route.shadeScore - comparedShadeScore : null;

  return (
    <button
      onClick={onSelect}
      className={clsx(
        'w-full text-left p-3 rounded-xl border-2 transition-all',
        isSelected
          ? isShaded
            ? 'border-green-500 bg-green-50'
            : 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={clsx('w-3 h-3 rounded-full', isShaded ? 'bg-green-500' : 'bg-blue-500')} />
          <span className="text-sm font-semibold text-gray-800">
            {isShaded ? 'Most Shaded' : 'Fastest'}
          </span>
          <span className="text-sm">{icon}</span>
        </div>
        <Badge label={isShaded ? 'Prefer Shade' : 'Fast Route'} variant={isShaded ? 'green' : 'blue'} />
      </div>

      {/* Shade label */}
      <p className="text-xs text-gray-500 mb-2">{label}</p>

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mb-2.5">
        <span>{formatDuration(route.durationSeconds)}</span>
        <span>·</span>
        <span>{formatDistance(route.distanceMeters)}</span>
        <span>·</span>
        <span className="text-green-700 font-medium">
          {formatDistance(route.shadedDistanceMeters)} shaded
        </span>
      </div>

      {/* Shade bar */}
      <ShadeScore score={route.shadeScore} />

      {/* Contextual detail row */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {sunMinutes > 0 ? (
          <span className="text-orange-600">
            ☀️ ~{sunMinutes} min in direct sun
          </span>
        ) : (
          <span className="text-green-700">✓ Entirely shaded</span>
        )}
        {delta !== null && delta > 0 && (
          <span className="text-green-700 font-medium">+{delta}% more shade</span>
        )}
        {delta !== null && delta < 0 && (
          <span className="text-gray-400">{Math.abs(delta)}% less shade</span>
        )}
      </div>
    </button>
  );
}
