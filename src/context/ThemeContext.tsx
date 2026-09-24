import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface AccentOption {
  id: string;
  label: string;
  color: string;      // primary (button bg, active nav, etc.)
  glow: string;       // rgba for box-shadow glow
  shimmerA: string;
  shimmerB: string;
}

export const ACCENT_OPTIONS: AccentOption[] = [
  { id: 'violet', label: 'Фіолетовий', color: '#7C3AED', glow: 'rgba(124,58,237,0.25)', shimmerA: '#7C3AED', shimmerB: '#5B21B6' },
  { id: 'cyan',   label: 'Блакитний',  color: '#0891B2', glow: 'rgba(8,145,178,0.25)',   shimmerA: '#0891B2', shimmerB: '#06B6D4' },
  { id: 'emerald',label: 'Смарагдовий',color: '#059669', glow: 'rgba(5,150,105,0.25)',   shimmerA: '#059669', shimmerB: '#10B981' },
  { id: 'orange', label: 'Помаранчевий',color:'#D97706', glow: 'rgba(217,119,6,0.25)',   shimmerA: '#D97706', shimmerB: '#F59E0B' },
  { id: 'pink',   label: 'Рожевий',    color: '#DB2777', glow: 'rgba(219,39,119,0.25)',  shimmerA: '#DB2777', shimmerB: '#EC4899' },
  { id: 'blue',   label: 'Синій',      color: '#2563EB', glow: 'rgba(37,99,235,0.25)',   shimmerA: '#2563EB', shimmerB: '#3B82F6' },
  { id: 'rose',   label: 'Червоний',   color: '#E11D48', glow: 'rgba(225,29,72,0.25)',   shimmerA: '#E11D48', shimmerB: '#F43F5E' },
];

interface ThemeCtx {
  mode: ThemeMode;
  accent: AccentOption;
  setMode: (m: ThemeMode) => void;
  setAccent: (a: AccentOption) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({} as ThemeCtx);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [accent, setAccent] = useState<AccentOption>(ACCENT_OPTIONS[0]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);

    if (mode === 'dark') {
      root.style.setProperty('--background', '#0B0F17');
      root.style.setProperty('--foreground', '#F1F5F9');
      root.style.setProperty('--card', 'rgba(17,24,39,0.55)');
      root.style.setProperty('--card-foreground', '#F1F5F9');
      root.style.setProperty('--secondary', '#1E293B');
      root.style.setProperty('--secondary-foreground', '#CBD5E1');
      root.style.setProperty('--muted', '#1E293B');
      root.style.setProperty('--muted-foreground', '#64748B');
      root.style.setProperty('--border', 'rgba(255,255,255,0.07)');
      root.style.setProperty('--sidebar-bg', 'rgba(10,13,22,0.85)');
      root.style.setProperty('--header-bg', 'rgba(10,13,22,0.80)');
      root.style.setProperty('--input-bg', 'rgba(255,255,255,0.05)');
      root.style.setProperty('--input-border', 'rgba(255,255,255,0.10)');
      root.style.setProperty('--hover-bg', 'rgba(255,255,255,0.05)');
      root.style.setProperty('--text-primary', '#F1F5F9');
      root.style.setProperty('--text-secondary', '#94A3B8');
      root.style.setProperty('--text-muted', '#475569');
      root.style.setProperty('--ambient-a', 'rgba(124,58,237,0.12)');
      root.style.setProperty('--ambient-b', 'rgba(6,182,212,0.10)');
      root.style.setProperty('--modal-bg', 'rgba(12,16,28,0.97)');
      root.style.setProperty('--subcard-bg', 'rgba(255,255,255,0.03)');
      root.style.setProperty('--divider', 'rgba(255,255,255,0.06)');
    } else {
      root.style.setProperty('--background', '#F0F4F8');
      root.style.setProperty('--foreground', '#0F172A');
      root.style.setProperty('--card', 'rgba(255,255,255,0.80)');
      root.style.setProperty('--card-foreground', '#0F172A');
      root.style.setProperty('--secondary', '#E2E8F0');
      root.style.setProperty('--secondary-foreground', '#334155');
      root.style.setProperty('--muted', '#F1F5F9');
      root.style.setProperty('--muted-foreground', '#64748B');
      root.style.setProperty('--border', 'rgba(0,0,0,0.08)');
      root.style.setProperty('--sidebar-bg', 'rgba(255,255,255,0.90)');
      root.style.setProperty('--header-bg', 'rgba(248,250,252,0.90)');
      root.style.setProperty('--input-bg', 'rgba(0,0,0,0.04)');
      root.style.setProperty('--input-border', 'rgba(0,0,0,0.10)');
      root.style.setProperty('--hover-bg', 'rgba(0,0,0,0.04)');
      root.style.setProperty('--text-primary', '#0F172A');
      root.style.setProperty('--text-secondary', '#475569');
      root.style.setProperty('--text-muted', '#94A3B8');
      root.style.setProperty('--ambient-a', 'rgba(124,58,237,0.06)');
      root.style.setProperty('--ambient-b', 'rgba(6,182,212,0.05)');
      root.style.setProperty('--modal-bg', 'rgba(248,250,252,0.98)');
      root.style.setProperty('--subcard-bg', 'rgba(0,0,0,0.03)');
      root.style.setProperty('--divider', 'rgba(0,0,0,0.07)');
    }

    // Accent
    root.style.setProperty('--primary', accent.color);
    root.style.setProperty('--accent-glow', accent.glow);
    root.style.setProperty('--shimmer-a', accent.shimmerA);
    root.style.setProperty('--shimmer-b', accent.shimmerB);
  }, [mode, accent]);

  const toggle = () => setMode(m => m === 'dark' ? 'light' : 'dark');

  return <Ctx.Provider value={{ mode, accent, setMode, setAccent, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
