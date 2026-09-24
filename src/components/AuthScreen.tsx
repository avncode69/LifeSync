import { useState } from 'react';
import { type User } from '../types';
import { ApiService } from '../services/api';
import { GoogleService } from '../services/google';

interface Props {
  onLogin: (user: User) => void;
}

export default function AuthScreen({ onLogin }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await ApiService.login(loginEmail, loginPassword);
      if (res.success && res.user) {
        onLogin(res.user);
      } else {
        setError(res.error || 'Не вдалося увійти');
      }
    } catch (err: any) {
      setError(err.message || 'Сталася непередбачена помилка');
    } finally {
      setLoading(false);
    }
  };

  // Handle Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (regPassword !== regConfirmPassword) {
      setError('Паролі не співпадають');
      return;
    }

    setLoading(true);
    try {
      const res = await ApiService.register(regName, regEmail, regPassword);
      if (res.success && res.user) {
        onLogin(res.user);
      } else {
        setError(res.error || 'Не вдалося зареєструватися');
      }
    } catch (err: any) {
      setError(err.message || 'Сталася непередбачена помилка');
    } finally {
      setLoading(false);
    }
  };

  // Handle Google Sign-In
  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const profile = await GoogleService.promptGoogleSignIn();
      if (profile) {
        const user = await ApiService.loginWithGoogle(profile);
        onLogin(user);
      }
    } catch (err: any) {
      setError(err.message || 'Помилка авторизації через Google');
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo Login
  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = await ApiService.loginWithGoogle({
        name: 'Олександр Коваленко',
        email: 'alex@lifesync.app',
      });
      onLogin(user);
    } finally {
      setLoading(false);
    }
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
          {/* Tab Selector */}
          <div className="flex p-1 rounded-xl mb-6" style={{ background: 'var(--subcard-bg)', border: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => { setTab('login'); setError(null); }}
              className={`flex-1 py-2 rounded-lg text-xs font-display font-600 transition-all ${
                tab === 'login' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              style={{ background: tab === 'login' ? 'var(--primary)' : 'transparent' }}
            >
              Вхід
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setError(null); }}
              className={`flex-1 py-2 rounded-lg text-xs font-display font-600 transition-all ${
                tab === 'register' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              style={{ background: tab === 'register' ? 'var(--primary)' : 'transparent' }}
            >
              Реєстрація
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 animate-shake">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign-in Button */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl font-display font-600 text-sm transition-all active:scale-98 disabled:opacity-50"
            style={{
              background: 'var(--text-primary)',
              color: 'var(--background)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Продовжити через Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>або з Email</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {/* Tab 1: LOGIN FORM */}
          {tab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-display mb-1 block" style={{ color: 'var(--text-muted)' }}>Email</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-display" style={{ color: 'var(--text-muted)' }}>Пароль</label>
                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    className="text-xs font-medium hover:underline"
                    style={{ color: 'var(--primary)' }}
                  >
                    Швидкий демо-вхід ⚡
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                />
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
          )}

          {/* Tab 2: REGISTER FORM */}
          {tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-display mb-1 block" style={{ color: 'var(--text-muted)' }}>Ваше ім'я</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  placeholder="Олександр Коваленко"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="text-xs font-display mb-1 block" style={{ color: 'var(--text-muted)' }}>Email</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-display mb-1 block" style={{ color: 'var(--text-muted)' }}>Пароль</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="Мінімум 6 знаків"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-display mb-1 block" style={{ color: 'var(--text-muted)' }}>Повтор</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regConfirmPassword}
                    onChange={e => setRegConfirmPassword(e.target.value)}
                    placeholder="Повторіть"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 rounded-xl text-sm font-display font-600 text-white transition-all shadow-lg active:scale-98 disabled:opacity-50"
                style={{ background: 'var(--primary)', boxShadow: '0 4px 16px var(--accent-glow)' }}
              >
                {loading ? 'Створення акаунта…' : 'Створити акаунт'}
              </button>
            </form>
          )}

          {/* Terms */}
          <p className="text-xs text-center mt-5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Продовжуючи, ви погоджуєтесь з{' '}
            <span className="underline cursor-pointer" style={{ color: 'var(--primary)' }}>Умовами використання</span>
            {' '}та{' '}
            <span className="underline cursor-pointer" style={{ color: 'var(--primary)' }}>Політикою конфіденційності</span>
          </p>
        </div>

        {/* Feature Badges */}
        <div className="grid grid-cols-3 gap-2.5 mt-5">
          {[
            { icon: '📅', label: 'Google Calendar' },
            { icon: '📁', label: 'Google Drive' },
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
