'use client';

import { useState, useEffect, useRef } from 'react';
import { computeShadeTimeline, type HourlyShade } from '@/lib/routing/computeShadeTimeline';

export function useShadeTimeline(encodedPolyline: string | null) {
  const [timeline, setTimeline] = useState<HourlyShade[]>([]);
  const [loading, setLoading] = useState(false);
  const computedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!encodedPolyline || encodedPolyline === computedForRef.current) return;
    computedForRef.current = encodedPolyline;
    setTimeline([]);
    setLoading(true);
    computeShadeTimeline(encodedPolyline, new Date())
      .then(setTimeline)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [encodedPolyline]);

  return { timeline, loading };
}
