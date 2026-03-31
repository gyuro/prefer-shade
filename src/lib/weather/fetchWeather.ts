import { getSunPosition } from '@/lib/shadow';

export interface WeatherData {
  temperature: number;       // °C, rounded
  feelsLike: number;         // °C apparent temperature
  precipitation: number;     // mm/h
  cloudCover: number;        // 0–100 %
  windSpeed: number;         // km/h
  weatherCode: number;       // WMO code
  uvIndex: number;           // 0–11+ (computed from sun + cloud cover)
  emoji: string;
  conditionText: string;
  /** How much building shade matters right now */
  shadeRelevance: 'none' | 'low' | 'medium' | 'high';
  /** One-line advisory to show in the sidebar, or null if unremarkable */
  advisory: string | null;
}

// WMO weather interpretation codes → human text + emoji
function interpret(code: number): { text: string; emoji: string } {
  if (code === 0)           return { emoji: '☀️',  text: 'Clear sky' };
  if (code <= 2)            return { emoji: '⛅',  text: 'Partly cloudy' };
  if (code === 3)           return { emoji: '☁️',  text: 'Overcast' };
  if (code <= 48)           return { emoji: '🌫️', text: 'Foggy' };
  if (code <= 57)           return { emoji: '🌦️', text: 'Drizzle' };
  if (code <= 67)           return { emoji: '🌧️', text: 'Rain' };
  if (code <= 77)           return { emoji: '🌨️', text: 'Snow' };
  if (code <= 82)           return { emoji: '🌦️', text: 'Showers' };
  return                           { emoji: '⛈️',  text: 'Thunderstorm' };
}

function calcShadeRelevance(
  cloudCover: number,
  precipitation: number,
  uvIndex: number,
  feelsLike: number,
): WeatherData['shadeRelevance'] {
  if (precipitation > 0.2 || cloudCover >= 80) return 'none';
  if (cloudCover >= 55) return 'low';
  if (uvIndex >= 6 || feelsLike >= 32) return 'high';
  return 'medium';
}

function buildAdvisory(
  relevance: WeatherData['shadeRelevance'],
  uvIndex: number,
  feelsLike: number,
  precipitation: number,
): string | null {
  if (relevance === 'none') {
    if (precipitation > 0.2) return `It's raining — shade won't help. Fastest route shown.`;
    return `Overcast today — building shade won't make a difference.`;
  }
  if (relevance === 'high') {
    if (uvIndex >= 8) return `UV ${uvIndex.toFixed(0)} (very high) — seeking maximum shade.`;
    if (feelsLike >= 35) return `Feels like ${feelsLike}°C — shade will cool your walk.`;
    return `UV ${uvIndex.toFixed(0)} — prioritising shaded streets.`;
  }
  return null;
}

/**
 * Fetch current weather from Open-Meteo (free, no API key).
 * UV index is computed from the current sun altitude + cloud cover
 * so it's accurate for the exact moment of the search.
 */
export async function fetchWeather(lat: number, lng: number, date: Date): Promise<WeatherData | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,apparent_temperature,precipitation,cloudcover,weathercode,windspeed_10m` +
      `&wind_speed_unit=kmh&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const c = data.current;

    // Compute UV from sun altitude × cloud transmittance
    const sun = getSunPosition(date, lat, lng);
    const rawUV = sun.isDay ? 11 * Math.sin(Math.max(sun.altitude, 0)) : 0;
    const uvIndex = Math.round(rawUV * (1 - c.cloudcover / 100) * 10) / 10;

    const { emoji, text: conditionText } = interpret(c.weathercode);
    const feelsLike = Math.round(c.apparent_temperature);
    const relevance = calcShadeRelevance(c.cloudcover, c.precipitation, uvIndex, feelsLike);

    return {
      temperature: Math.round(c.temperature_2m),
      feelsLike,
      precipitation: c.precipitation,
      cloudCover: c.cloudcover,
      windSpeed: Math.round(c.windspeed_10m),
      weatherCode: c.weathercode,
      uvIndex,
      emoji,
      conditionText,
      shadeRelevance: relevance,
      advisory: buildAdvisory(relevance, uvIndex, feelsLike, c.precipitation),
    };
  } catch {
    return null;
  }
}
