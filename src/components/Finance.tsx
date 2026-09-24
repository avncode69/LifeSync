import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { TRANSACTIONS, AREA_DATA } from '../data/seed';
import { type Transaction, type Currency, type ExchangeRates } from '../types';

const CURRENCIES: Currency[] = ['UAH', 'USD', 'EUR', 'GBP', 'PLN'];
const CURRENCY_FLAGS: Record<Currency, string> = { UAH: '🇺🇦', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', PLN: '🇵🇱' };

const BUDGETS = [
  { cat: 'Їжа', limit: 5000, color: '#7C3AED' },
  { cat: 'Підписки', limit: 2000, color: '#06B6D4' },
  { cat: 'Сервери', limit: 5000, color: '#F59E0B' },
  { cat: 'Навчання', limit: 3000, color: '#10B981' },
];

const CATEGORIES = ['Зарплата', 'Фріланс', 'Їжа', 'Підписки', 'Сервери', 'Навчання', 'Транспорт', 'Розваги', 'Інше'];
const CAT_ICON: Record<string, string> = { Зарплата: '💼', Фріланс: '💻', Їжа: '🍔', Підписки: '📦', Сервери: '🖥️', Навчання: '📚', Транспорт: '🚌', Розваги: '🎮', Інше: '💳' };
const PIE_COLORS = ['#7C3AED', '#06B6D4', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6'];

interface Props {
  exchangeRates: ExchangeRates;
  transactions?: Transaction[];
  onUpdateTransactions?: (txs: Transaction[]) => void;
}

function toUAH(amount: number, currency: Currency, txRate: number | undefined, rates: ExchangeRates): number {
  if (currency === 'UAH') return amount;
  const rate = txRate ?? rates[currency as keyof ExchangeRates];
  return amount * (rate || 1);
}

const DEFAULT_NEW_TX: Omit<Transaction, 'id'> = {
  type: 'expense', amount: 0, currency: 'UAH', category: 'Їжа', date: new Date().toISOString().slice(0, 10), note: '', rate: undefined,
};

export default function Finance({ exchangeRates, transactions: externalTxs, onUpdateTransactions }: Props) {
  const [internalTxs, setInternalTxs] = useState<Transaction[]>(TRANSACTIONS);
  const transactions = externalTxs || internalTxs;

  const updateTransactions = (next: Transaction[]) => {
    setInternalTxs(next);
    if (onUpdateTransactions) onUpdateTransactions(next);
  };

  const [showAdd, setShowAdd] = useState(false);
  const [newTx, setNewTx] = useState<Omit<Transaction, 'id'>>(DEFAULT_NEW_TX);
  const [useCustomRate, setUseCustomRate] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [period, setPeriod] = useState<'тиждень' | 'місяць'>('тиждень');

  const toUah = (tx: Transaction) => toUAH(tx.amount, tx.currency, tx.rate, exchangeRates);

  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + toUah(t), 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + toUah(t), 0);
  const balance = income - expense;

  const addTx = () => {
    if (!newTx.amount || !newTx.note) return;
    const tx: Transaction = {
      ...newTx,
      id: `tr${Date.now()}`,
      rate: useCustomRate ? newTx.rate : undefined,
    };
    updateTransactions([tx, ...transactions]);
    setNewTx(DEFAULT_NEW_TX);
    setUseCustomRate(false);
    setShowAdd(false);
  };

  const deleteTx = (id: string) => updateTransactions(transactions.filter(t => t.id !== id));

  const filtered = transactions.filter(t => filterType === 'all' || t.type === filterType);

  // Build pie data from transactions
  const catMap: Record<string, number> = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + toUah(t);
  });
  const pieData = Object.entries(catMap).map(([name, value], i) => ({ name, value: Math.round(value), color: PIE_COLORS[i % PIE_COLORS.length] }));

  const budgetSpent: Record<string, number> = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    budgetSpent[t.category] = (budgetSpent[t.category] || 0) + toUah(t);
  });

  return (
    <div className="h-full overflow-y-auto p-4 section-enter">
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Summary Cards */}
        <div className="col-span-2 grid grid-cols-3 gap-4">
          {[
            { label: 'Баланс', val: balance, color: '#10B981', icon: '💎' },
            { label: 'Доходи', val: income, color: '#06B6D4', icon: '⬆️' },
            { label: 'Витрати', val: expense, color: '#EF4444', icon: '⬇️' },
          ].map(card => (
            <div key={card.label} className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-display">{card.label}</p>
                  <p className="font-mono text-2xl font-600 mt-1" style={{ color: card.color }}>
                    {Math.round(card.val).toLocaleString('uk-UA')} ₴
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">≈ {(card.val / exchangeRates.USD).toFixed(0)} USD</p>
                </div>
                <span className="text-2xl">{card.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Area Chart */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-600 text-white text-sm">📈 Динаміка потоків</h3>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {(['тиждень', 'місяць'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1 text-xs font-display transition-all capitalize ${period === p ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={AREA_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="finInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.35}/><stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="finExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.35}/><stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--modal-bg)', border: '1px solid var(--input-border)', borderRadius: 10, fontSize: 12 }} itemStyle={{ color: 'var(--text-secondary)' }} formatter={(v: number) => [`${v.toLocaleString('uk-UA')} ₴`]} />
                <Area type="monotone" dataKey="income" stroke="#06B6D4" strokeWidth={2} fill="url(#finInc)" name="Дохід" />
                <Area type="monotone" dataKey="expense" stroke="#7C3AED" strokeWidth={2} fill="url(#finExp)" name="Витрати" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie + Budgets */}
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: 'var(--card)', border: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-start gap-4">
            <div className="w-32 h-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={32} outerRadius={56} paddingAngle={3} dataKey="value">
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="transparent" />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--modal-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [`${v.toLocaleString('uk-UA')} ₴`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {pieData.slice(0, 5).map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-xs text-slate-400 flex-1">{d.name}</span>
                  <span className="text-xs font-mono text-slate-300">{d.value.toLocaleString()} ₴</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 border-t border-white/6 pt-3">
            <h4 className="text-xs font-display font-600 text-slate-300">🎯 Ліміти</h4>
            {BUDGETS.map(b => {
              const spent = Math.round(budgetSpent[b.cat] || 0);
              const pct = Math.min(100, Math.round((spent / b.limit) * 100));
              const over = pct >= 90;
              return (
                <div key={b.cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">{b.cat}</span>
                    <span className={`text-xs font-mono ${over ? 'text-amber-400' : 'text-slate-500'}`}>
                      {over && '⚠️ '}{spent.toLocaleString()} / {b.limit.toLocaleString()} ₴
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: over ? '#F59E0B' : b.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Transactions list */}
        <div className="col-span-2 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6">
            <h3 className="font-display font-600 text-white text-sm">🧾 Транзакції</h3>
            <div className="flex gap-1">
              {(['all', 'income', 'expense'] as const).map(ft => (
                <button key={ft} onClick={() => setFilterType(ft)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all ${filterType === ft ? 'bg-violet-600/25 text-violet-300' : 'text-slate-500 hover:text-slate-300 hover:bg-white/4'}`}
                  style={{ border: filterType === ft ? '1px solid rgba(124,58,237,0.35)' : '1px solid transparent' }}>
                  {ft === 'all' ? 'Всі' : ft === 'income' ? 'Доходи' : 'Витрати'}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAdd(!showAdd)}
              className="ml-auto px-3 py-1.5 rounded-lg text-xs font-display font-500 text-white transition-all"
              style={{ background: 'rgba(124,58,237,0.7)', border: '1px solid rgba(124,58,237,0.4)' }}>
              + Додати
            </button>
          </div>

          {/* Add transaction form */}
          {showAdd && (
            <div className="px-5 py-4 border-b border-white/6" style={{ background: 'var(--subcard-bg)' }}>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Тип</label>
                  <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--input-border)' }}>
                    {(['expense', 'income'] as const).map(t => (
                      <button key={t} onClick={() => setNewTx(p => ({ ...p, type: t }))}
                        className={`flex-1 py-2 text-xs font-display transition-all ${newTx.type === t ? (t === 'income' ? 'bg-emerald-600/40 text-emerald-300' : 'bg-red-600/30 text-red-300') : 'text-slate-500 hover:bg-white/5'}`}>
                        {t === 'income' ? '+ Дохід' : '- Витрата'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Сума</label>
                  <div className="flex gap-1">
                    <input type="number" value={newTx.amount || ''} onChange={e => setNewTx(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                      className="flex-1 px-3 py-2 rounded-lg text-sm text-white font-mono outline-none"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }} placeholder="0" />
                    <select value={newTx.currency} onChange={e => setNewTx(p => ({ ...p, currency: e.target.value as Currency }))}
                      className="px-2 py-2 rounded-lg text-xs text-slate-300 outline-none"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{CURRENCY_FLAGS[c]} {c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Категорія</label>
                  <select value={newTx.category} onChange={e => setNewTx(p => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm text-slate-300 outline-none"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Опис</label>
                  <input value={newTx.note} onChange={e => setNewTx(p => ({ ...p, note: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }} placeholder="Нотатка…" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Дата</label>
                  <input type="date" value={newTx.date} onChange={e => setNewTx(p => ({ ...p, date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', colorScheme: 'normal' }} />
                </div>
                {newTx.currency !== 'UAH' && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <label className="text-xs text-slate-500">Курс (до UAH)</label>
                      <button onClick={() => setUseCustomRate(!useCustomRate)}
                        className={`text-xs px-1.5 py-0.5 rounded transition-all ${useCustomRate ? 'text-violet-300 bg-violet-600/20' : 'text-slate-600 hover:text-slate-400'}`}>
                        {useCustomRate ? 'власний' : `авто: ${exchangeRates[newTx.currency as keyof ExchangeRates]}`}
                      </button>
                    </div>
                    {useCustomRate ? (
                      <input type="number" step="0.01" value={newTx.rate || ''} onChange={e => setNewTx(p => ({ ...p, rate: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 rounded-lg text-sm text-white font-mono outline-none"
                        style={{ background: 'var(--input-bg)', border: '1px solid rgba(124,58,237,0.3)' }}
                        placeholder={`${exchangeRates[newTx.currency as keyof ExchangeRates]}`} />
                    ) : (
                      <div className="px-3 py-2 rounded-lg text-sm text-slate-500 font-mono"
                        style={{ background: 'var(--subcard-bg)', border: '1px solid var(--border)' }}>
                        1 {newTx.currency} = {exchangeRates[newTx.currency as keyof ExchangeRates]} UAH
                      </div>
                    )}
                  </div>
                )}
              </div>
              {newTx.amount > 0 && newTx.currency !== 'UAH' && (
                <p className="text-xs text-slate-500 font-mono mt-2">
                  ≈ {Math.round(newTx.amount * (useCustomRate && newTx.rate ? newTx.rate : exchangeRates[newTx.currency as keyof ExchangeRates])).toLocaleString('uk-UA')} UAH
                </p>
              )}
              <div className="flex gap-2 mt-3 justify-end">
                <button onClick={() => setShowAdd(false)} className="px-4 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all">Скасувати</button>
                <button onClick={addTx} className="px-4 py-1.5 rounded-lg text-sm font-display font-500 text-white transition-all"
                  style={{ background: 'rgba(124,58,237,0.8)', border: '1px solid rgba(124,58,237,0.4)' }}>
                  Додати
                </button>
              </div>
            </div>
          )}

          {/* List */}
          <div className="p-3 space-y-1">
            {filtered.map(tx => {
              const uahAmount = Math.round(toUah(tx));
              const hasCustomRate = tx.rate !== undefined;
              return (
                <div key={tx.id} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/3 transition-all">
                  <span className="text-lg">{CAT_ICON[tx.category] || '💳'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{tx.note}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 font-mono">{tx.category}</span>
                      <span className="text-slate-700">·</span>
                      <span className="text-xs text-slate-600 font-mono">{tx.date.slice(5)}</span>
                      {tx.currency !== 'UAH' && (
                        <>
                          <span className="text-slate-700">·</span>
                          <span className="text-xs text-slate-600 font-mono">{CURRENCY_FLAGS[tx.currency]} {tx.amount} {tx.currency}</span>
                          {hasCustomRate && <span className="text-xs text-violet-400 font-mono">@{tx.rate}</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`font-mono text-sm font-500 ${tx.type === 'income' ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {tx.type === 'income' ? '+' : '-'}{uahAmount.toLocaleString('uk-UA')} ₴
                  </span>
                  <button onClick={() => deleteTx(tx.id)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md flex items-center justify-center text-red-500 text-xs hover:bg-red-500/15 transition-all shrink-0"
                    title="Видалити">✕</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
