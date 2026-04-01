'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { decode } from '@googlemaps/polyline-codec';
import { useWatchPosition } from './useWatchPosition';
import { extractTurns } from '@/lib/navigation/extractTurns';
import { snapToRoute } from '@/lib/navigation/snapToRoute';
import type { ScoredRoute, LatLng } from '@/types/route';
import type { TurnInstruction, LiveLocation } from '@/types/navigation';

const ARRIVAL_THRESHOLD_M = 20;

export interface NavigationSession {
  isActive: boolean;
  route: ScoredRoute | null;
  destination: LatLng | null;
  liveLocation: LiveLocation | null;
  snappedLocation: LatLng | null;
  instructions: TurnInstruction[];
  nextInstructionIndex: number;
  distanceToNextTurnM: number;
  distanceRemainingM: number;
  secondsRemaining: number;
  eta: Date | null;
  arrived: boolean;
}

const INITIAL: NavigationSession = {
  isActive: false,
  route: null,
  destination: null,
  liveLocation: null,
  snappedLocation: null,
  instructions: [],
  nextInstructionIndex: 0,
  distanceToNextTurnM: 0,
  distanceRemainingM: 0,
  secondsRemaining: 0,
  eta: null,
  arrived: false,
};

export function useNavigation() {
  const [session, setSession] = useState<NavigationSession>(INITIAL);
  const coordsRef = useRef<[number, number][]>([]);
  const walkSpeedRef = useRef(1.4); // m/s, updated when route is set

  const { location } = useWatchPosition(session.isActive);

  const start = useCallback((route: ScoredRoute, destination: LatLng) => {
    const coords = decode(route.encodedPolyline, 5) as [number, number][];
    coordsRef.current = coords;
    walkSpeedRef.current = route.distanceMeters / route.durationSeconds;
    const instructions = extractTurns(coords);
    setSession({
      ...INITIAL,
      isActive: true,
      route,
      destination,
      instructions,
      nextInstructionIndex: 0,
    });
  }, []);

  const stop = useCallback(() => {
    setSession(INITIAL);
    coordsRef.current = [];
  }, []);

  // Update navigation state whenever GPS position changes
  useEffect(() => {
    if (!session.isActive || !location || coordsRef.current.length < 2) return;

    const snap = snapToRoute(location, coordsRef.current);
    const { distanceTraveled, distanceRemaining } = snap;
    const secondsRemaining = distanceRemaining / walkSpeedRef.current;
    const eta = new Date(Date.now() + secondsRemaining * 1000);

    // Advance instruction pointer past turns already behind the user
    const { instructions } = session;
    let idx = session.nextInstructionIndex;
    while (idx < instructions.length - 1 && instructions[idx].distanceFromStart < distanceTraveled + 5) {
      idx++;
    }

    const nextInstruction = instructions[idx];
    const distanceToNextTurnM = Math.max(0, (nextInstruction?.distanceFromStart ?? 0) - distanceTraveled);

    const arrived = distanceRemaining < ARRIVAL_THRESHOLD_M;

    setSession(prev => ({
      ...prev,
      liveLocation: location,
      snappedLocation: snap.snapped,
      nextInstructionIndex: idx,
      distanceToNextTurnM,
      distanceRemainingM: distanceRemaining,
      secondsRemaining,
      eta,
      arrived,
      isActive: !arrived,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, session.isActive]);

  return { session, start, stop };
}
