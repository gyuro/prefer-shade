'use client';

import type { WeatherData } from '@/lib/weather/fetchWeather';

interface Props {
  weather: WeatherData | null;
  loading?: boolean;
}

export function WeatherBadge({ weather, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 text-xs text-gray-400 w-fit">
        <span className="w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
        Fetching weather…
      </div>
    );
  }

  if (!weather) return null;

  const relevanceColors = {
    none: 'bg-gray-50 text-gray-500',
    low: 'bg-blue-50 text-blue-700',
    medium: 'bg-amber-50 text-amber-700',
    high: 'bg-orange-50 text-orange-700',
  } as const;

  return (
    <div className="flex flex-col gap-1">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium w-fit ${relevanceColors[weather.shadeRelevance]}`}>
        <span>{weather.emoji}</span>
        <span>{weather.temperature}°C · {weather.conditionText}</span>
        {weather.uvIndex > 0 && (
          <>
            <span className="text-current opacity-40">·</span>
            <span>UV {weather.uvIndex.toFixed(0)}</span>
          </>
        )}
        {weather.windSpeed > 0 && (
          <>
            <span className="text-current opacity-40">·</span>
            <span>{weather.windSpeed} km/h</span>
          </>
        )}
      </div>
      {weather.advisory && (
        <p className="text-xs text-gray-500 px-1">{weather.advisory}</p>
      )}
    </div>
  );
}
