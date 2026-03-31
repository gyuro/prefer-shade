'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchWeather, type WeatherData } from '@/lib/weather/fetchWeather';
import type { LatLng } from '@/types/route';

function coordKey(coord: LatLng): string {
  return `${coord.lat.toFixed(2)},${coord.lng.toFixed(2)}`;
}

const cache = new Map<string, WeatherData>();

export function useWeather(coord: LatLng | null): { weather: WeatherData | null; loading: boolean } {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!coord) return;
    const key = coordKey(coord);
    if (key === lastKey.current) return;
    lastKey.current = key;

    if (cache.has(key)) {
      setWeather(cache.get(key)!);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchWeather(coord.lat, coord.lng, new Date()).then((data) => {
      if (cancelled) return;
      if (data) {
        cache.set(key, data);
        setWeather(data);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [coord]);

  return { weather, loading };
}
