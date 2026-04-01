'use client';

import { useEffect } from 'react';
import { useNavigationContext } from '@/context/NavigationContext';
import { NavigationArrow } from './NavigationArrow';

function formatDist(m: number): string {
  if (m < 20)   return 'Arriving';
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function formatEta(eta: Date): string {
  return eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRemaining(sec: number): string {
  const min = Math.round(sec / 60);
  if (min < 1)  return 'Arriving';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function NavigationHUD() {
  const { session, stop } = useNavigationContext();
  const { isActive, arrived, instructions, nextInstructionIndex, distanceToNextTurnM, distanceRemainingM, secondsRemaining, eta } = session;

  // Auto-stop 3 seconds after arrival
  useEffect(() => {
    if (!arrived) return;
    const t = setTimeout(stop, 3000);
    return () => clearTimeout(t);
  }, [arrived, stop]);

  if (!isActive && !arrived) return null;

  const nextInstruction = instructions[nextInstructionIndex];

  if (arrived) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div className="bg-gray-900/95 text-white px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-3">
          <NavigationArrow direction="arrive" size={56} />
          <p className="text-xl font-bold">You have arrived!</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Top banner — next turn */}
      <div className="absolute top-0 left-0 right-0 z-40 bg-gray-900/95 text-white shadow-lg">
        <div className="max-w-xl mx-auto flex items-center gap-4 px-5 py-4">
          {nextInstruction && (
            <NavigationArrow direction={nextInstruction.direction} size={48} />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-3xl font-bold leading-tight">{formatDist(distanceToNextTurnM)}</p>
            <p className="text-base text-gray-300 mt-0.5 truncate">{nextInstruction?.label ?? 'Continue'}</p>
          </div>
        </div>
      </div>

      {/* Bottom bar — remaining + end */}
      <div className="absolute bottom-0 left-0 right-0 z-40 bg-gray-900/95 text-white shadow-lg">
        <div className="max-w-xl mx-auto flex items-center gap-4 px-5 py-4">
          <div className="flex-1">
            <p className="text-lg font-bold">{formatDist(distanceRemainingM)}</p>
            <p className="text-sm text-gray-400">{formatRemaining(secondsRemaining)}{eta ? ` · ${formatEta(eta)}` : ''}</p>
          </div>
          <button
            type="button"
            onClick={stop}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            End
          </button>
        </div>
      </div>
    </>
  );
}
