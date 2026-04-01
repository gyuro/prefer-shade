'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useNavigation, type NavigationSession } from '@/hooks/useNavigation';
import type { ScoredRoute, LatLng } from '@/types/route';

interface NavigationContextValue {
  session: NavigationSession;
  start: (route: ScoredRoute, destination: LatLng) => void;
  stop: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const nav = useNavigation();
  return <NavigationContext.Provider value={nav}>{children}</NavigationContext.Provider>;
}

export function useNavigationContext(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigationContext must be used inside NavigationProvider');
  return ctx;
}
