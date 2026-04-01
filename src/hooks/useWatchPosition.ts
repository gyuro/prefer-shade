'use client';

import { useState, useEffect, useRef } from 'react';
import type { LiveLocation } from '@/types/navigation';

export function useWatchPosition(active: boolean): { location: LiveLocation | null; error: string | null } {
  const [location, setLocation] = useState<LiveLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const h = pos.coords.heading;
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: (h !== null && isFinite(h) && (pos.coords.speed ?? 0) > 0.3) ? h : null,
          accuracy: pos.coords.accuracy,
        });
        setError(null);
      },
      (err) => {
        setError(err.message);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [active]);

  return { location, error };
}
