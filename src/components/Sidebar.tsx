import { type Section } from '../types';

const NAV_ITEMS: { id: Section | 'settings'; label: string; emoji: string; decoration: string }[] = [
  { id: 'dashboard', label: 'Dashboard',    emoji: '⊞', decoration: '🪴' },
  { id: 'calendar',  label: 'Calendar',     emoji: '📅', decoration: '🧭' },
  { id: 'tasks',     label: 'Tasks',        emoji: '✓', decoration: '✨' },
  { id: 'finance',   label: 'Finance',      emoji: '$', decoration: '🪙' },
  { id: 'ai',        label: 'AI-Assistant', emoji: '✦', decoration: '🤖' },
];

interface Props {
  active: Section;
  onChange: (s: Section) => void;
  onOpenSettings: () => void;
  syncStatus: 'synced' | 'syncing' | 'offline';
}

export default function Sidebar({ active, onChange, onOpenSettings, syncStatus }: Props) {
  return (
    <aside className="flex flex-col w-60 shrink-0 h-full relative z-10" style={{
      background: 'var(--sidebar-bg)',
      backdropFilter: 'blur(24px)',
      borderRight: '1px solid var(--border)',
      transition: 'background 0.25s ease',
    }}>
      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl shimmer flex items-center justify-center text-white text-xs font-bold font-display shrink-0">LS</div>
          <div className="min-w-0">
            <div className="font-display font-700 text-white text-sm leading-tight truncate">Проєкт Life Manager</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = active === (item.id as Section);
          return (
            <button
              key={item.id}
              onClick={() => item.id !== 'settings' && onChange(item.id as Section)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-display font-500
                transition-all duration-150 relative overflow-hidden group
                ${isActive
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/4'
                }
              `}
              style={isActive ? {
                background: 'color-mix(in srgb, var(--primary) 18%, transparent)',
                border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)',
                boxShadow: '0 0 20px var(--accent-glow)',
              } : { border: '1px solid transparent' }}
            >
              <span className="text-base w-5 text-center opacity-70">{item.emoji}</span>
              <span>{item.label}</span>
              {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--primary)' }} />}

              {/* Decorative floating icon */}
              <span className="absolute right-2 text-xl opacity-40 group-hover:opacity-60 transition-opacity pointer-events-none select-none"
                style={{ filter: 'drop-shadow(0 2px 8px rgba(124,58,237,0.4))' }}>
                {item.decoration}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Google Sync */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--subcard-bg)', border: '1px solid var(--border)' }}>
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-green-400 flex items-center justify-center text-xs font-bold text-white shrink-0">G</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-400 truncate">Google Workspace</div>
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-400' : syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-xs text-slate-600 font-mono">
                {syncStatus === 'synced' ? 'Синхронізовано' : syncStatus === 'syncing' ? 'Синхронізація…' : 'Офлайн'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Settings at bottom */}
      <div className="px-3 pb-4 border-t border-white/5 pt-2">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/4 transition-all text-sm font-display group"
          style={{ border: '1px solid transparent' }}
        >
          <span className="text-base">⚙️</span>
          <span>Settings</span>
          <span className="absolute right-6 text-xl opacity-30 group-hover:opacity-50 transition-opacity select-none"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(6,182,212,0.3))' }}>🔧</span>
        </button>
      </div>
    </aside>
  );
}
