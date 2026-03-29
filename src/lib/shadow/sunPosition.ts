import SunCalc from 'suncalc';
import type { SunState } from '@/types/shadow';

export function getSunPosition(date: Date, lat: number, lng: number): SunState {
  const pos = SunCalc.getPosition(date, lat, lng);
  return {
    altitude: pos.altitude,
    azimuth: pos.azimuth,
    isDay: pos.altitude > 0,
  };
}
