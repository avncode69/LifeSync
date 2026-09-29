import { useState } from 'react';
import { type Section, type User } from '../types';
import { useTheme } from '../context/ThemeContext';

interface Props {
  section: Section;
  user?: User | null;
  onOpenSettings: () => void;
}

const SECTION_LABEL: Record<Section, string> = {
  dashboard: 'Dashboard',
  calendar:  'Calendar',
  tasks:     'Tasks & Habits',
  finance:   'Finance',
  ai:        'AI Assistant',
};

export default function Header({ section, user, onOpenSettings }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { mode, toggle } = useTheme();
  const isDark = mode === 'dark';

  const getInitials = (name?: string) => {
    if (!name) return 'LS';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header
      className="h-14 shrink-0 flex items-center px-4 gap-3 relative z-10"
      style={{
        background: 'var(--header-bg)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        transition: 'background 0.25s ease',
      }}
    >
      {/* Section label */}
      <span className="text-sm font-display font-500 shrink-0" style={{ color: 'var(--text-secondary)' }}>
        {SECTION_LABEL[section]}
      </span>

      {/* Search — centered, takes most space */}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex-1 max-w-lg mx-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all"
        style={{
          background: 'var(--input-bg)',
          border: '1px solid var(--input-border)',
          color: 'var(--text-muted)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <span className="flex-1 text-left">Search tasks, events, and Google Drive...</span>
        <kbd className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>⌘K</kbd>
      </button>

      {/* Right: theme toggle + avatar only */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="flex items-center gap-1 px-2 py-1.5 rounded-xl transition-all"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
          title={isDark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
        >
          <span
            className="w-6 h-6 rounded-lg flex items-center justify-center text-sm transition-all"
            style={{ background: !isDark ? 'var(--primary)' : 'transparent', color: !isDark ? '#fff' : 'var(--text-muted)' }}
          >
            ☀️
          </span>
          <span
            className="w-6 h-6 rounded-lg flex items-center justify-center text-sm transition-all"
            style={{ background: isDark ? 'var(--primary)' : 'transparent', color: isDark ? '#fff' : 'var(--text-muted)' }}
          >
            🌙
          </span>
        </button>

        {/* Avatar → opens settings */}
        <button
          onClick={onOpenSettings}
          className="w-8 h-8 rounded-xl font-display font-600 text-xs text-white hover:scale-105 transition-transform shimmer flex items-center justify-center"
          title={`Профіль: ${user?.name || 'LifeSync'}`}
        >
          {getInitials(user?.name)}
        </button>
      </div>

      {/* Search overlay */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: 'var(--modal-bg)', border: '1px solid var(--border)', backdropFilter: 'blur(24px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                autoFocus
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--text-primary)' }}
                placeholder="Пошук задач, подій, файлів…"
                onKeyDown={e => e.key === 'Escape' && setSearchOpen(false)}
              />
              <kbd className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>ESC</kbd>
            </div>
            <div className="p-4">
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>Почніть вводити для пошуку…</p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
