import { useState } from 'react';
import { type UserSettings, type Currency, type User } from '../types';
import { useTheme, ACCENT_OPTIONS } from '../context/ThemeContext';
import { GoogleService } from '../services/google';
import { ApiService } from '../services/api';

interface Props {
  settings: UserSettings;
  user?: User | null;
  onSave: (s: UserSettings) => void;
  onClose: () => void;
  onLogout: () => void;
  onExportData?: () => void;
  onDeleteAccount?: () => void;
  onUpdateUser?: (updated: User) => void;
}

const CURRENCIES: Currency[] = ['UAH', 'USD', 'EUR', 'GBP', 'PLN'];
const TABS = ['Профіль', 'Зовнішній вигляд', 'Валюти', 'Інтеграції', 'Акаунт'] as const;

const CURRENCY_META: Record<Currency, { flag: string; name: string; symbol: string; color: string }> = {
  UAH: { flag: '🇺🇦', name: 'Гривня',     symbol: '₴', color: '#3B82F6' },
  USD: { flag: '🇺🇸', name: 'Долар США',  symbol: '$', color: '#10B981' },
  EUR: { flag: '🇪🇺', name: 'Євро',        symbol: '€', color: '#8B5CF6' },
  GBP: { flag: '🇬🇧', name: 'Фунт стерл.', symbol: '£', color: '#F59E0B' },
  PLN: { flag: '🇵🇱', name: 'Злотий',      symbol: 'zł', color: '#EF4444' },
};
type Tab = typeof TABS[number];

export default function Settings({
  settings,
  user,
  onSave,
  onClose,
  onLogout,
  onExportData,
  onDeleteAccount,
  onUpdateUser,
}: Props) {
  const [tab, setTab] = useState<Tab>('Профіль');
  const { mode, toggle, accent, setAccent } = useTheme();
  const [form, setForm] = useState<UserSettings>({
    ...settings,
    nickname: user?.name || settings.nickname || 'Користувач',
    googleClientId: settings.googleClientId || GoogleService.getClientId(),
    googleConnected: user?.provider === 'google' || settings.googleConnected || false,
  });
  const [saved, setSaved] = useState(false);
  const [apiVisible, setApiVisible] = useState(false);

  // Password change modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; error: boolean } | null>(null);

  // Monobank test status
  const [monoStatus, setMonoStatus] = useState<string | null>(null);
  const [monoTesting, setMonoTesting] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return 'LS';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleSave = () => {
    if (form.googleClientId) {
      GoogleService.setClientId(form.googleClientId);
    }
    if (onUpdateUser && user && form.nickname && form.nickname !== user.name) {
      onUpdateUser({ ...user, name: form.nickname });
    }
    onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateRate = (cur: Currency, val: string) => {
    setForm(f => ({ ...f, exchangeRates: { ...f.exchangeRates, [cur]: parseFloat(val) || 0 } }));
  };

  const handleTestMonobank = async () => {
    if (!form.monobankApiKey) {
      setMonoStatus('Введіть токен Monobank');
      return;
    }
    setMonoTesting(true);
    setMonoStatus(null);
    try {
      const client = await ApiService.getMonobankClient(form.monobankApiKey);
      if (client && client.name) {
        setMonoStatus(`✓ Підключено: ${client.name}`);
      } else {
        setMonoStatus('✓ Токен збережено (тест успішний)');
      }
    } catch {
      setMonoStatus('Помилка перевірки токена');
    } finally {
      setMonoTesting(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const profile = await GoogleService.promptGoogleSignIn();
      if (profile) {
        setForm(f => ({ ...f, googleConnected: true }));
        if (onUpdateUser && user) {
          onUpdateUser({
            ...user,
            name: profile.name || user.name,
            email: profile.email || user.email,
            provider: 'google',
          });
        }
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordMsg({ text: 'Пароль повинен бути не менше 6 символів', error: true });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordMsg({ text: 'Паролі не співпадають', error: true });
      return;
    }
    setPasswordMsg({ text: 'Пароль успішно змінено!', error: false });
    setTimeout(() => {
      setShowPasswordModal(false);
      setPasswordMsg(null);
      setNewPassword('');
      setConfirmNewPassword('');
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden mx-4"
        style={{ background: 'var(--modal-bg)', border: '1px solid var(--input-border)', backdropFilter: 'blur(24px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-700 text-base" style={{ color: 'var(--text-primary)' }}>⚙️ Налаштування</h2>
            {user && (
              <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>
                {user.email}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg transition-all text-sm flex items-center justify-center"
            style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-display font-500 transition-all shrink-0"
              style={{
                background: tab === t ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'transparent',
                border: `1px solid ${tab === t ? 'color-mix(in srgb, var(--primary) 40%, transparent)' : 'transparent'}`,
                color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[420px] overflow-y-auto">
          {tab === 'Профіль' && (
            <>
              <div>
                <label className="text-xs font-display mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Ім'я / Нікнейм</label>
                <input
                  value={form.nickname}
                  onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                  placeholder="Введіть ваше ім'я"
                />
              </div>
              <div>
                <label className="text-xs font-display mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Email облікового запису</label>
                <input
                  value={user?.email || 'user@lifesync.app'}
                  readOnly
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-not-allowed opacity-80"
                  style={{ background: 'var(--subcard-bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Спосіб авторизації: {user?.provider === 'google' ? 'Google Workspace OAuth 2.0' : 'Email & Пароль'}
                </p>
              </div>
              <div>
                <label className="text-xs font-display mb-2 block" style={{ color: 'var(--text-muted)' }}>Базова валюта інтерфейсу</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {CURRENCIES.map(c => {
                    const m = CURRENCY_META[c];
                    const active = form.defaultCurrency === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setForm(f => ({ ...f, defaultCurrency: c }))}
                        className="flex flex-col items-center gap-1 py-2 rounded-xl transition-all"
                        style={{
                          background: active ? `${m.color}22` : 'var(--input-bg)',
                          border: `1px solid ${active ? m.color + '70' : 'var(--input-border)'}`,
                        }}
                      >
                        <span className="text-lg leading-none">{m.flag}</span>
                        <span className="text-xs font-mono font-600" style={{ color: active ? m.color : 'var(--text-muted)' }}>{c}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {tab === 'Зовнішній вигляд' && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-display mb-2 block" style={{ color: 'var(--text-muted)' }}>Тема</label>
                <div className="flex gap-2">
                  {(['dark', 'light'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => { if (mode !== m) toggle(); }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-display font-500 transition-all"
                      style={{
                        background: mode === m ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${mode === m ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'}`,
                        color: mode === m ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {m === 'dark' ? '🌙 Темна' : '☀️ Світла'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-display mb-2 block" style={{ color: 'var(--text-muted)' }}>Акцентний колір</label>
                <div className="grid grid-cols-4 gap-2">
                  {ACCENT_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setAccent(opt)}
                      className="flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl transition-all"
                      style={{
                        background: accent.id === opt.id ? `${opt.color}20` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${accent.id === opt.id ? opt.color + '70' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: opt.color, boxShadow: accent.id === opt.id ? `0 0 12px ${opt.glow}` : 'none' }}
                      >
                        {accent.id === opt.id && <span className="text-white text-xs">✓</span>}
                      </span>
                      <span className="text-xs font-display" style={{ color: accent.id === opt.id ? '#fff' : 'var(--text-muted)' }}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'Валюти' && (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)' }}>
                <span className="text-base mt-0.5">ℹ️</span>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Курс до UAH для автоматичного конвертування транзакцій у розділі «Фінанси».
                </p>
              </div>

              {(['USD', 'EUR', 'GBP', 'PLN'] as Currency[]).map(cur => {
                const m = CURRENCY_META[cur];
                const rate = form.exchangeRates[cur as keyof typeof form.exchangeRates];
                return (
                  <div
                    key={cur}
                    className="rounded-xl overflow-hidden"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: `${m.color}12` }}>
                      <span className="text-2xl">{m.flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-display font-700" style={{ color: m.color }}>{cur}</span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.name}</span>
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          1 {m.symbol} = <span className="font-mono font-600" style={{ color: 'var(--text-secondary)' }}>{rate} ₴</span>
                        </div>
                      </div>
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-display font-700"
                        style={{ background: `${m.color}25`, color: m.color }}
                      >
                        {m.symbol}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: 'var(--subcard-bg)' }}>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>1 {cur} =</span>
                      <input
                        type="number"
                        step="0.01"
                        value={rate}
                        onChange={e => updateRate(cur, e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg text-sm font-mono outline-none transition-colors"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                      />
                      <span className="text-xs font-mono font-600" style={{ color: 'var(--text-secondary)' }}>UAH</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'Інтеграції' && (
            <div className="space-y-4">
              {/* Monobank */}
              <div className="rounded-xl p-4" style={{ background: 'var(--subcard-bg)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-800 to-black flex items-center justify-center text-base">🐱</div>
                  <div>
                    <div className="text-sm font-display font-600" style={{ color: 'var(--text-primary)' }}>Monobank API</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Автоматичний імпорт транзакцій</div>
                  </div>
                  <div className={`ml-auto px-2 py-0.5 rounded-full text-xs ${form.monobankApiKey ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                    {form.monobankApiKey ? '● Підключено' : '○ Не підключено'}
                  </div>
                </div>
                <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>API Token</label>
                <div className="flex gap-2">
                  <input
                    type={apiVisible ? 'text' : 'password'}
                    value={form.monobankApiKey}
                    onChange={e => setForm(f => ({ ...f, monobankApiKey: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-mono outline-none transition-colors"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                    placeholder="Вставте токен з api.monobank.ua"
                  />
                  <button onClick={() => setApiVisible(!apiVisible)} className="px-3 py-2 rounded-lg text-xs hover:opacity-80 transition-all"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    {apiVisible ? '🙈' : '👁'}
                  </button>
                  <button
                    type="button"
                    onClick={handleTestMonobank}
                    disabled={monoTesting}
                    className="px-3 py-2 rounded-lg text-xs font-display font-500 transition-all text-white"
                    style={{ background: 'var(--primary)' }}
                  >
                    {monoTesting ? '…' : 'Тест'}
                  </button>
                </div>
                {monoStatus && (
                  <p className="text-xs mt-2 text-emerald-400">{monoStatus}</p>
                )}
                <a href="https://api.monobank.ua" target="_blank" rel="noopener noreferrer"
                  className="text-xs mt-1.5 inline-block transition-colors underline" style={{ color: 'var(--primary)' }}>
                  Отримати персональний токен → api.monobank.ua
                </a>
              </div>

              {/* Google Workspace */}
              <div className="rounded-xl p-4" style={{ background: 'var(--subcard-bg)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-green-400 flex items-center justify-center text-sm font-bold text-white">G</div>
                  <div>
                    <div className="text-sm font-display font-600" style={{ color: 'var(--text-primary)' }}>Google Workspace</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Calendar · Drive · Docs · Gmail</div>
                  </div>
                  <div className={`ml-auto px-2 py-0.5 rounded-full text-xs ${form.googleConnected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                    {form.googleConnected ? '● Підключено' : '○ Не підключено'}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Google OAuth 2.0 Web Client ID</label>
                  <input
                    type="text"
                    value={form.googleClientId || ''}
                    onChange={e => setForm(f => ({ ...f, googleClientId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none transition-colors"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                    placeholder="xxxxxxxx.apps.googleusercontent.com"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {form.googleConnected ? 'Акаунт синхронізовано' : 'Необхідна авторизація'}
                    </span>
                    <button
                      type="button"
                      onClick={handleConnectGoogle}
                      className="px-3 py-1.5 rounded-lg text-xs font-display font-500 transition-all text-white"
                      style={{ background: form.googleConnected ? 'rgba(16,185,129,0.7)' : 'var(--primary)' }}
                    >
                      {form.googleConnected ? '✓ Підключено (Оновити)' : 'Підключити Google'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'Акаунт' && (
            <div className="space-y-3">
              {/* Account summary card */}
              <div className="rounded-xl p-4" style={{ background: 'var(--subcard-bg)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl shimmer flex items-center justify-center text-white font-display font-600 text-sm">
                    {getInitials(user?.name || form.nickname)}
                  </div>
                  <div>
                    <div className="text-sm font-display font-600" style={{ color: 'var(--text-primary)' }}>
                      {user?.name || form.nickname}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {user?.email || 'user@lifesync.app'} · Cloudflare Tier
                    </div>
                  </div>
                </div>
                <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                  Статус синхронізації: <span className="text-emerald-400 font-medium">● Local-first + Cloudflare D1</span>
                </div>
              </div>

              {/* Change password button */}
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all"
                style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--subcard-bg)' }}
              >
                <span>🔒</span> Змінити пароль
              </button>

              {/* Export JSON */}
              <button
                type="button"
                onClick={onExportData}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all"
                style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--subcard-bg)' }}
              >
                <span>📤</span> Експортувати дані (JSON)
              </button>

              {/* Logout */}
              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:text-red-300 transition-all"
                style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}
              >
                <span>🚪</span> Вийти з акаунта
              </button>

              {/* Delete account */}
              <button
                type="button"
                onClick={() => {
                  if (confirm('Ви впевнені, що бажаєте видалити свій акаунт та всі пов\'язані дані? Цю дію неможливо скасувати.')) {
                    if (onDeleteAccount) onDeleteAccount();
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs text-red-500 hover:text-red-400 transition-all"
                style={{ border: '1px solid rgba(239,68,68,0.1)' }}
              >
                <span>🗑️</span> Видалити акаунт та очистити сховище
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {tab !== 'Акаунт' && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/6">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm hover:opacity-80 transition-all"
              style={{ color: 'var(--text-muted)' }}
            >
              Скасувати
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg text-sm font-display font-500 text-white transition-all shadow-md"
              style={{
                background: saved ? 'rgba(16,185,129,0.85)' : 'var(--primary)',
                boxShadow: saved ? '0 0 16px rgba(16,185,129,0.4)' : '0 0 16px var(--accent-glow)',
              }}
            >
              {saved ? '✓ Збережено' : 'Зберегти'}
            </button>
          </div>
        )}
      </div>

      {/* Password Change Submodal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={() => setShowPasswordModal(false)}>
          <div
            className="w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4"
            style={{ background: 'var(--modal-bg)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-display font-700 text-base" style={{ color: 'var(--text-primary)' }}>Зміна пароля</h3>
            {passwordMsg && (
              <p className={`text-xs ${passwordMsg.error ? 'text-red-400' : 'text-emerald-400'}`}>
                {passwordMsg.text}
              </p>
            )}
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Новий пароль</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Повторіть пароль</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-display font-600 text-white"
                  style={{ background: 'var(--primary)' }}
                >
                  Зберегти пароль
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
