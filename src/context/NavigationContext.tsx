'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useNavigation, type NavigationSession } from '@/hooks/useNavigation';
import type { ScoredRoute, LatLng } from '@/types/route';

interface NavigationContextValue {
  session: NavigationSession;
  start: (route: ScoredRoute, destination: LatLng) => void;
  stop: () => void;
  /** true = 45° pitch (perspective), false = 0° pitch (top-down) */
  perspectiveView: boolean;
  togglePerspective: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const nav = useNavigation();
  const [perspectiveView, setPerspectiveView] = useState(true);
  const togglePerspective = () => setPerspectiveView(v => !v);
  return (
    <NavigationContext.Provider value={{ ...nav, perspectiveView, togglePerspective }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigationContext(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigationContext must be used inside NavigationProvider');
  return ctx;
}
