'use client';

import { useState, useEffect } from 'react';
import { bestShadeWindow, type HourlyShade } from '@/lib/routing/computeShadeTimeline';
import { Spinner } from '@/components/ui/Spinner';

interface Props {
  timeline: HourlyShade[];
  loading: boolean;
  hasRoute: boolean;
}

function formatHour(h: number): string {
  if (h === 0 || h === 24) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function barColor(score: number, isNight: boolean): string {
  if (isNight) return '#e5e7eb';
  if (score >= 60) return '#22c55e';
  if (score >= 35) return '#86efac';
  if (score >= 15) return '#fbbf24';
  return '#f97316';
}

export function ShadeTimeline({ timeline, loading, hasRoute }: Props) {
  const [currentHour, setCurrentHour] = useState(-1);
  useEffect(() => { setCurrentHour(new Date().getHours()); }, []);

  const best = bestShadeWindow(timeline);
  const hasData = timeline.length > 0;

  // Max score among daytime hours — used to normalise bar heights so the
  // shadiest hour always reaches the top of the chart.
  const maxScore = Math.max(1, ...timeline.filter((h) => !h.isNight).map((h) => h.score));

  return (
    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-600">Shade by time of day</span>
        {loading && <Spinner className="w-3 h-3 text-gray-400" />}
      </div>

      {!hasRoute && (
        <p className="text-xs text-gray-400">Available after a route is found.</p>
      )}

      {hasRoute && !hasData && !loading && (
        <p className="text-xs text-gray-400">Computing shade forecast…</p>
      )}

      {hasData && (
        <>
          {/* Bar chart — heights normalised so the tallest bar fills the container */}
          <div className="flex items-end gap-px h-16 mb-1">
            {timeline.map(({ hour, score, isNight }) => {
              const heightPct = isNight
                ? 8
                : Math.max((score / maxScore) * 100, 6);
              const isCurrent = hour === currentHour;
              return (
                <div key={hour} className="flex-1 flex flex-col justify-end h-full">
                  <div
                    className="w-full rounded-sm transition-all"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: barColor(score, isNight),
                      outline: isCurrent ? '2px solid #1d4ed8' : 'none',
                      outlineOffset: '1px',
                    }}
                    title={isNight ? `${formatHour(hour)}: Night` : `${formatHour(hour)}: ${score}% shade`}
                  />
                </div>
              );
            })}
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between text-gray-400 mb-2" style={{ fontSize: '9px' }}>
            {[6, 9, 12, 15, 18, 21].map((h) => <span key={h}>{formatHour(h)}</span>)}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs mb-2 flex-wrap">
            {[
              { color: '#22c55e', label: '≥60% shaded' },
              { color: '#fbbf24', label: 'Partial' },
              { color: '#f97316', label: 'Full sun' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm inline-block" style={{ background: color }} />
                <span className="text-gray-500">{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#bfdbfe', outline: '2px solid #1d4ed8' }} />
              <span className="text-gray-500">Now</span>
            </div>
          </div>

          {best && best.score > 20 && (
            <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
              <span className="text-sm">🌿</span>
              <span className="text-xs text-green-700">
                <span className="font-semibold">Best window:</span>{' '}
                {formatHour(best.startHour)}–{formatHour(best.endHour + 1)} · {best.score}% shade
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
