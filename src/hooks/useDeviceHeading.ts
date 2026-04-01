'use client';

import { useState, useEffect, useCallback } from 'react';

interface DeviceHeading {
  /** Compass heading in degrees (0 = north, 90 = east). null when unavailable. */
  heading: number | null;
  /** True on iOS 13+ before the user has granted DeviceOrientation permission. */
  needsPermission: boolean;
  /** Call this inside a user gesture (tap) to request iOS permission. */
  requestPermission: () => void;
}

export function useDeviceHeading(): DeviceHeading {
  const [heading, setHeading] = useState<number | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);

  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    // iOS: webkitCompassHeading is 0–360, clockwise from north
    const wko = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
    if (typeof wko === 'number' && isFinite(wko)) {
      setHeading(wko);
      return;
    }
    // Android (deviceorientationabsolute): alpha is CCW from north, convert to CW
    if (e.absolute && e.alpha !== null && isFinite(e.alpha)) {
      setHeading((360 - e.alpha) % 360);
    }
  }, []);

  const subscribe = useCallback(() => {
    window.addEventListener('deviceorientationabsolute', handleOrientation as EventListener, true);
    window.addEventListener('deviceorientation', handleOrientation as EventListener, true);
  }, [handleOrientation]);

  useEffect(() => {
    // iOS 13+ requires an explicit permission request triggered by a user gesture
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DOE.requestPermission === 'function') {
      setNeedsPermission(true);
      // Don't auto-subscribe; wait for requestPermission() call
    } else {
      subscribe();
    }

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener, true);
      window.removeEventListener('deviceorientation', handleOrientation as EventListener, true);
    };
  }, [subscribe, handleOrientation]);

  const requestPermission = useCallback(() => {
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DOE.requestPermission !== 'function') return;
    DOE.requestPermission()
      .then((state) => {
        if (state === 'granted') {
          setNeedsPermission(false);
          subscribe();
        }
      })
      .catch(() => {});
  }, [subscribe]);

  return { heading, needsPermission, requestPermission };
}
