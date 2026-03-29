'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LatLng } from '@/types/route';

type LocationState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'ok'; location: LatLng }
  | { status: 'error'; message: string };

export function useUserLocation() {
  const [state, setState] = useState<LocationState>({ status: 'idle' });

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setState({ status: 'error', message: 'Geolocation not supported by your browser.' });
      return;
    }
    setState({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          status: 'ok',
          location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        });
      },
      (err) => {
        setState({ status: 'error', message: err.message });
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  const location = state.status === 'ok' ? state.location : null;
  const isLocating = state.status === 'locating';
  const locationError = state.status === 'error' ? state.message : null;

  return { location, isLocating, locationError, retry: locate };
}
