import { useState } from 'react';
import { type User } from '../types';

interface Props {
  onLogin: (user: User) => void;
}

export default function AuthScreen({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Small delay for UX
    await new Promise(r => setTimeout(r, 400));

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (cleanEmail === 'admin' && cleanPassword === 'admin') {
      const user: User = {
        id: 'usr_admin',
        name: 'admin',
        email: 'admin',
        provider: 'email',
        createdAt: new Date().toISOString(),
      };
      onLogin(user);
    } else {
      setError('Невірний логін або пароль');
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden py-12"
      style={{ background: 'var(--background)' }}
    >
      {/* Ambient blobs */}
      <div className="ambient" />

      {/* Decorative grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Floating orbs */}
      <div
        className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', filter: 'blur(40px)' }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }}
      />

      {/* Card Container */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo & Headline */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl shimmer flex items-center justify-center text-white text-xl font-display font-700 mb-3"
            style={{ boxShadow: '0 0 35px var(--accent-glow)' }}
          >
            LS
          </div>
          <h1 className="font-display font-800 text-3xl" style={{ color: 'var(--text-primary)' }}>LifeSync</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Ваш інтелектуальний life & task manager</p>
        </div>

        {/* Auth Box */}
        <div
          className="rounded-2xl p-7 shadow-2xl"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          }}
        >
          <h2 className="text-center font-display font-600 text-sm mb-5" style={{ color: 'var(--text-primary)' }}>
            Вхід в систему
          </h2>

          {/* Error Message */}
          {error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="text-xs font-display mb-1 block" style={{ color: 'var(--text-muted)' }}>Логін</label>
              <input
                type="text"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Введіть логін"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-display mb-1 block" style={{ color: 'var(--text-muted)' }}>Пароль</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Введіть пароль"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all pr-10"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm transition-opacity hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 rounded-xl text-sm font-display font-600 text-white transition-all shadow-lg active:scale-98 disabled:opacity-50"
              style={{ background: 'var(--primary)', boxShadow: '0 4px 16px var(--accent-glow)' }}
            >
              {loading ? 'Вхід…' : 'Увійти'}
            </button>
          </form>
        </div>

        {/* Feature Badges */}
        <div className="grid grid-cols-3 gap-2.5 mt-5">
          {[
            { icon: '📅', label: 'Календар' },
            { icon: '💰', label: 'Фінанси' },
            { icon: '🤖', label: 'AI Асистент' },
          ].map(f => (
            <div
              key={f.label}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-center"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <span className="text-lg">{f.icon}</span>
              <span className="text-xs font-display font-500" style={{ color: 'var(--text-muted)' }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
