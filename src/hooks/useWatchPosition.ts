'use client';

import { useState, useEffect, useRef } from 'react';
import type { LiveLocation } from '@/types/navigation';

export function useWatchPosition(active: boolean): { location: LiveLocation | null; error: string | null } {
  const [location, setLocation] = useState<LiveLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  // Throttle GPS callbacks — pedestrian navigation needs at most 1 update/sec
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    const clearWatch = () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    if (!active) {
      clearWatch();
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        // Drop updates that arrive faster than once per second
        const now = Date.now();
        if (now - lastUpdateRef.current < 900) return;
        lastUpdateRef.current = now;

        const h = pos.coords.heading;
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: (h !== null && isFinite(h) && (pos.coords.speed ?? 0) > 0.3) ? h : null,
          accuracy: pos.coords.accuracy,
        });
        setError(null);
      },
      (err) => { setError(err.message); },
      // maximumAge: 2000 — allow reusing a 2-second-old fix to avoid hammering GPS
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );

    // Ensure cleanup on page refresh/unload (React cleanup may not fire in time)
    window.addEventListener('beforeunload', clearWatch);

    return () => {
      clearWatch();
      window.removeEventListener('beforeunload', clearWatch);
    };
  }, [active]);

  return { location, error };
}
