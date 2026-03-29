'use client';

import { useState, useCallback, useRef } from 'react';
import { computeShadeTimeline, type HourlyShade } from '@/lib/routing/computeShadeTimeline';
import type { LatLng } from '@/types/route';

export function useShadeTimeline(encodedPolyline: string | null, location: LatLng | null) {
  const [timeline, setTimeline] = useState<HourlyShade[]>([]);
  const [loading, setLoading] = useState(false);
  const lastPolyline = useRef<string | null>(null);

  // Reset timeline when route changes
  if (encodedPolyline !== lastPolyline.current && timeline.length > 0) {
    setTimeline([]);
    lastPolyline.current = encodedPolyline;
  }

  const load = useCallback(async () => {
    if (!encodedPolyline || !location || loading) return;
    lastPolyline.current = encodedPolyline;
    setLoading(true);
    try {
      const result = await computeShadeTimeline(encodedPolyline, location, new Date());
      setTimeline(result);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, [encodedPolyline, location, loading]);

  return { timeline, loading, load };
}
