import { useState } from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { type Task, type PinnedDoc, type CalendarEvent, type Transaction } from '../types';
import TaskEditModal from './TaskEditModal';

const PRIORITY_COLOR = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' };

const DOC_ICON: Record<string, string> = {
  gdocs: '📄', gsheets: '📊', gmail: '📧', gdrive: '📁', url: '🔗',
};
const DOC_TYPE_LABEL: Record<string, string> = {
  gdocs: 'Docs', gsheets: 'Sheets', gmail: 'Gmail', gdrive: 'Drive', url: 'URL',
};

const QUICK_TAGS = ['📋 Задача', '📅 Подія', '💸 Витрата'];
const TX_CATEGORIES = ['Зарплата', 'Фріланс', 'Їжа', 'Підписки', 'Сервери', 'Навчання', 'Транспорт', 'Розваги', 'Інше'];

interface Props {
  tasks: Task[];
  onUpdateTasks: (tasks: Task[]) => void;
  pinnedDocs?: PinnedDoc[];
  onUpdatePinnedDocs?: (docs: PinnedDoc[]) => void;
  events?: CalendarEvent[];
  balance?: number;
  transactions?: Transaction[];
  onUpdateTransactions?: (txs: Transaction[]) => void;
}

export default function Dashboard({
  tasks = [],
  onUpdateTasks,
  pinnedDocs: externalPinnedDocs,
  onUpdatePinnedDocs,
  events: externalEvents,
  balance = 0,
  transactions = [],
  onUpdateTransactions,
}: Props) {
  const [quickInput, setQuickInput] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [tasksCollapsed, setTasksCollapsed] = useState(false);
  const [eventsCollapsed, setEventsCollapsed] = useState(false);
  const [internalPinnedDocs, setInternalPinnedDocs] = useState<PinnedDoc[]>([]);
  const pinnedDocs = externalPinnedDocs || internalPinnedDocs;

  const updatePinnedDocs = (next: PinnedDoc[]) => {
    setInternalPinnedDocs(next);
    if (onUpdatePinnedDocs) onUpdatePinnedDocs(next);
  };

  const [showLinkMenu, setShowLinkMenu] = useState<string | null>(null);
  const [addingTransaction, setAddingTransaction] = useState(false);

  // Transaction form state
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txNote, setTxNote] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('Інше');

  // Add doc form
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocType, setNewDocType] = useState<'gdocs' | 'gsheets' | 'gmail' | 'gdrive' | 'url'>('url');

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const todayTasks = tasks.filter(t => !t.deadline || t.deadline <= todayStr);
  const pendingTasks = todayTasks.filter(t => !t.done);

  const toggleTask = (id: string) => {
    onUpdateTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const deleteTask = (id: string) => {
    onUpdateTasks(tasks.filter(t => t.id !== id));
  };

  const saveTask = (updated: Task) => {
    onUpdateTasks(tasks.map(t => t.id === updated.id ? updated : t));
  };

  const handleQuickAdd = () => {
    if (!quickInput.trim()) return;

    if (activeTag === '💸 Витрата' && onUpdateTransactions) {
      // Parse as transaction: try to extract amount
      const match = quickInput.match(/(\d+)/);
      const amount = match ? parseInt(match[1]) : 0;
      const note = quickInput.replace(/\d+/g, '').trim() || quickInput;
      const newTx: Transaction = {
        id: `tr${Date.now()}`,
        type: 'expense',
        amount: amount || 100,
        currency: 'UAH',
        category: 'Інше',
        date: todayStr,
        note,
      };
      onUpdateTransactions([newTx, ...transactions]);
    } else {
      const newTask: Task = {
        id: `t${Date.now()}`,
        title: quickInput,
        done: false,
        priority: 'medium',
        deadline: todayStr,
      };
      onUpdateTasks([...tasks, newTask]);
    }
    setQuickInput('');
    setActiveTag(null);
  };

  const handleAddTransaction = () => {
    if (!txNote.trim() || !txAmount || !onUpdateTransactions) return;
    const newTx: Transaction = {
      id: `tr${Date.now()}`,
      type: txType,
      amount: parseFloat(txAmount),
      currency: 'UAH',
      category: txCategory,
      date: todayStr,
      note: txNote,
    };
    onUpdateTransactions([newTx, ...transactions]);
    setTxNote('');
    setTxAmount('');
    setTxCategory('Інше');
    setAddingTransaction(false);
  };

  const handleAddDoc = () => {
    if (!newDocName.trim()) return;
    const newDoc: PinnedDoc = {
      id: `doc${Date.now()}`,
      name: newDocName,
      type: newDocType,
      pinned: true,
    };
    updatePinnedDocs([...pinnedDocs, newDoc]);
    setNewDocName('');
    setShowAddDoc(false);
  };

  const deleteDoc = (docId: string) => {
    updatePinnedDocs(pinnedDocs.filter(d => d.id !== docId));
  };

  const togglePin = (docId: string) => {
    const next = pinnedDocs.map(d => d.id === docId ? { ...d, pinned: !d.pinned } : d);
    updatePinnedDocs(next);
  };

  const importantDocs = [
    ...pinnedDocs.filter(d => d.pinned),
    ...pinnedDocs.filter(d => !d.pinned),
  ];

  // Compute chart data from transactions
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
  const dayNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const chartData = weekDays.map(day => {
    const dayTxs = transactions.filter(t => {
      const d = new Date(t.date);
      return dayNames[d.getDay()] === day;
    });
    return {
      day,
      income: dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    };
  });

  return (
    <div className="h-full overflow-y-auto p-4 section-enter">
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto' }}>

        {/* Today Card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          {/* Card header */}
          <div className="flex items-start justify-between px-5 pt-4 pb-2">
            <div>
              <div className="text-slate-400 text-xs font-mono mb-0.5 capitalize">{today.toLocaleDateString('uk-UA', { weekday: 'long' })},</div>
              <h2 className="font-display font-700 text-white text-lg leading-tight">
                {today.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
              </h2>
            </div>
          </div>

          {/* Tasks section */}
          <div className="px-5 pb-2">
            <button
              onClick={() => setTasksCollapsed(!tasksCollapsed)}
              className="flex items-center gap-2 text-sm font-display font-600 text-slate-200 mb-2 w-full group"
            >
              <span>Tasks ({pendingTasks.length})</span>
              <span className={`text-slate-500 text-xs transition-transform ${tasksCollapsed ? '-rotate-90' : ''}`}>▾</span>
            </button>
            {!tasksCollapsed && (
              <div className="space-y-1">
                {todayTasks.length === 0 && (
                  <p className="text-xs text-slate-600 py-2 text-center">Немає задач на сьогодні</p>
                )}
                {todayTasks.map(task => (
                  <div key={task.id} className="group flex items-start gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/3 transition-all relative">
                    <input type="checkbox" className="custom-check mt-0.5" checked={task.done} onChange={() => toggleTask(task.id)} />
                    <span
                      className={`flex-1 text-sm cursor-pointer ${task.done ? 'line-through text-slate-600' : 'text-slate-200 hover:text-white'}`}
                      onDoubleClick={() => setEditingTask(task)}
                    >{task.title}</span>
                    {task.linkedDocs?.length ? (
                      <div className="relative shrink-0">
                        <button
                          onClick={() => setShowLinkMenu(showLinkMenu === task.id ? null : task.id)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs text-blue-400 hover:bg-blue-500/10 transition-all font-mono"
                          style={{ border: '1px solid rgba(59,130,246,0.25)' }}
                        >
                          <span>🔗</span> Google Workspace
                        </button>
                        {showLinkMenu === task.id && (
                          <div className="absolute right-0 top-7 z-30 w-52 rounded-xl shadow-2xl p-2"
                            style={{ background: 'var(--modal-bg)', border: '1px solid var(--input-border)', backdropFilter: 'blur(20px)' }}>
                            <p className="text-xs text-slate-500 px-2 py-1">Add Link</p>
                            {(['gdocs','gsheets','gmail','gdrive','url'] as const).map(type => (
                              <button key={type}
                                onClick={() => setShowLinkMenu(null)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/6 text-xs text-slate-300 transition-all">
                                <span>{DOC_ICON[type]}</span> {type === 'gdocs' ? 'Google Docs' : type === 'gsheets' ? 'Google Sheets' : type === 'gmail' ? 'Gmail' : type === 'gdrive' ? 'Google Drive' : 'Custom URL'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                    <button
                      onClick={() => setEditingTask(task)}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-md hover:bg-white/10 text-slate-500 hover:text-slate-200 text-xs flex items-center justify-center transition-all shrink-0"
                      title="Редагувати"
                    >✏️</button>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-md hover:bg-red-500/15 text-red-500 text-xs flex items-center justify-center transition-all shrink-0"
                      title="Видалити"
                    >✕</button>
                  </div>
                ))}
                <button
                  onClick={() => onUpdateTasks([...tasks, { id: `t${Date.now()}`, title: 'Нова задача', done: false, priority: 'medium', deadline: todayStr }])}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <span className="text-base">＋</span> Додати задачу
                </button>
              </div>
            )}
          </div>

          {/* Calendar Events */}
          <div className="px-5 pb-4 border-t border-white/5 pt-3">
            <button
              onClick={() => setEventsCollapsed(!eventsCollapsed)}
              className="flex items-center gap-2 text-sm font-display font-600 text-slate-200 mb-2 w-full"
            >
              <span>Calendar Events ({(externalEvents || []).length})</span>
              <span className={`text-slate-500 text-xs transition-transform ${eventsCollapsed ? '-rotate-90' : ''}`}>▾</span>
            </button>
            {!eventsCollapsed && (
              <div className="space-y-1">
                {(externalEvents || []).length === 0 && (
                  <p className="text-xs text-slate-600 py-2 text-center">Немає подій</p>
                )}
                {(externalEvents || []).map(ev => (
                  <div key={ev.id} className="group flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-white/3 transition-all">
                    <input type="checkbox" className="custom-check" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-300 truncate">{ev.title}</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono" style={{ color: 'var(--primary)' }}>{ev.time}</span>
                    <span className="text-base">{ev.type === 'meeting' ? '🤝' : ev.type === 'call' ? '📞' : '🔔'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Important Documents */}
        <div className="rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <h3 className="font-display font-600 text-white text-sm">📌 Важливі документи</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">з задач</span>
              <button
                onClick={() => setShowAddDoc(!showAddDoc)}
                className="text-xs transition-colors" style={{ color: 'var(--primary)' }}
              >+ Додати</button>
            </div>
          </div>

          {/* Add doc form */}
          {showAddDoc && (
            <div className="px-4 pb-2">
              <div className="flex gap-2 flex-wrap p-3 rounded-xl" style={{ background: 'var(--subcard-bg)', border: '1px solid var(--border)' }}>
                <input
                  autoFocus
                  value={newDocName}
                  onChange={e => setNewDocName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddDoc()}
                  placeholder="Назва документу…"
                  className="flex-1 min-w-32 px-3 py-1.5 rounded-lg text-xs text-white placeholder-slate-600 outline-none"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
                />
                <select
                  value={newDocType}
                  onChange={e => setNewDocType(e.target.value as any)}
                  className="px-2 py-1.5 rounded-lg text-xs text-slate-300 outline-none"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
                >
                  <option value="gdocs">📄 Docs</option>
                  <option value="gsheets">📊 Sheets</option>
                  <option value="gmail">📧 Gmail</option>
                  <option value="gdrive">📁 Drive</option>
                  <option value="url">🔗 URL</option>
                </select>
                <button onClick={handleAddDoc} className="px-3 py-1.5 rounded-lg text-xs text-white" style={{ background: 'color-mix(in srgb, var(--primary) 80%, transparent)' }}>✓</button>
                <button onClick={() => setShowAddDoc(false)} className="px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300">✕</button>
              </div>
            </div>
          )}

          <div className="px-4 pb-4 space-y-1.5">
            {importantDocs.length === 0 && (
              <p className="text-xs text-slate-600 py-4 text-center">Немає документів</p>
            )}
            {importantDocs.map(doc => (
              <div key={doc.id} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/4 transition-all cursor-pointer"
                style={{ border: '1px solid transparent' }}
                onMouseEnter={e => (e.currentTarget.style.border = '1px solid rgba(255,255,255,0.07)')}
                onMouseLeave={e => (e.currentTarget.style.border = '1px solid transparent')}
              >
                <span className="text-xl">{DOC_ICON[doc.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate group-hover:text-white transition-colors">{doc.name}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-600">{DOC_TYPE_LABEL[doc.type]}</span>
                    {doc.taskTitle && (
                      <>
                        <span className="text-slate-700">·</span>
                        <span className="text-xs text-slate-600 truncate">{doc.taskTitle}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); togglePin(doc.id); }}
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-xs transition-all ${
                      doc.pinned ? 'text-amber-400 bg-amber-400/10' : 'text-slate-500 hover:text-amber-400 hover:bg-amber-400/8'
                    }`}
                    title={doc.pinned ? 'Відкріпити' : 'Закріпити'}
                  >
                    📌
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteDoc(doc.id); }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-xs text-red-500 hover:bg-red-500/15 transition-all"
                    title="Видалити"
                  >✕</button>
                </div>
                {doc.pinned && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Quick Input */}
        <div className="rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h3 className="font-display font-600 text-white text-sm">⚡ Quick Input</h3>
          </div>
          <div className="px-4 pb-4">
            <textarea
              value={quickInput}
              onChange={e => setQuickInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleQuickAdd())}
              rows={3}
              placeholder="Введіть задачу, подію або транзакцію…"
              className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none resize-none leading-relaxed"
            />
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/6">
              <div className="flex-1 flex gap-1.5">
                {QUICK_TAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                      activeTag === tag
                        ? ''
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`}
                    style={activeTag === tag ? {
                      background: 'color-mix(in srgb, var(--primary) 25%, transparent)',
                      color: 'var(--primary)',
                      border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)',
                    } : { border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <button
                onClick={handleQuickAdd}
                disabled={!quickInput.trim()}
                className="px-4 py-1.5 rounded-xl text-sm font-display font-500 text-white transition-all disabled:opacity-40"
                style={{ background: 'color-mix(in srgb, var(--primary) 80%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 50%, transparent)' }}
              >
                Enter
              </button>
            </div>
          </div>
        </div>

        {/* Financial Overview */}
        <div className="rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center justify-between px-5 pt-4 pb-1">
            <h3 className="font-display font-600 text-white text-sm">💰 Financial Overview</h3>
          </div>
          <div className="px-5 pb-2">
            <div className="font-mono text-2xl font-600 text-white">{balance.toLocaleString('uk-UA')} ₴</div>
            <div className="text-xs text-slate-500">Фінансовий огляд</div>
          </div>
          <div className="h-28 px-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dash-inc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="dash-exp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#334155' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--modal-bg)', border: '1px solid var(--input-border)', borderRadius: 8, fontSize: 11 }}
                  itemStyle={{ color: 'var(--text-secondary)' }}
                />
                <Area type="monotone" dataKey="income" stroke="#06B6D4" strokeWidth={1.5} fill="url(#dash-inc)" name="Дохід" />
                <Area type="monotone" dataKey="expense" stroke="var(--primary)" strokeWidth={1.5} fill="url(#dash-exp)" name="Витрати" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-3 px-5 pb-2 mt-1">
            <button
              onClick={() => { setTxType('income'); setAddingTransaction(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-emerald-400 hover:bg-emerald-500/10 transition-all"
              style={{ border: '1px solid rgba(16,185,129,0.25)' }}>
              ▲ Income
            </button>
            <button
              onClick={() => { setTxType('expense'); setAddingTransaction(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-red-400 hover:bg-red-500/10 transition-all"
              style={{ border: '1px solid rgba(239,68,68,0.25)' }}>
              ▼ Expense
            </button>
            <button
              onClick={() => setAddingTransaction(!addingTransaction)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-cyan-400 hover:bg-cyan-500/10 transition-all"
              style={{ border: '1px solid rgba(6,182,212,0.3)' }}
            >
              + Транзакція
            </button>
          </div>
          {addingTransaction && (
            <div className="px-4 pb-4 pt-0 border-t border-white/5">
              <div className="space-y-2 mt-3">
                {/* Type toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setTxType('income')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-display font-500 transition-all ${txType === 'income' ? 'text-emerald-300' : 'text-slate-500'}`}
                    style={{
                      background: txType === 'income' ? 'rgba(16,185,129,0.15)' : 'var(--input-bg)',
                      border: `1px solid ${txType === 'income' ? 'rgba(16,185,129,0.4)' : 'var(--input-border)'}`,
                    }}
                  >▲ Дохід</button>
                  <button
                    onClick={() => setTxType('expense')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-display font-500 transition-all ${txType === 'expense' ? 'text-red-300' : 'text-slate-500'}`}
                    style={{
                      background: txType === 'expense' ? 'rgba(239,68,68,0.15)' : 'var(--input-bg)',
                      border: `1px solid ${txType === 'expense' ? 'rgba(239,68,68,0.4)' : 'var(--input-border)'}`,
                    }}
                  >▼ Витрата</button>
                </div>
                <div className="flex gap-2">
                  <input
                    value={txNote}
                    onChange={e => setTxNote(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTransaction()}
                    placeholder="Опис"
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs text-white outline-none"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
                    autoFocus
                  />
                  <input
                    type="number"
                    value={txAmount}
                    onChange={e => setTxAmount(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTransaction()}
                    placeholder="Сума"
                    className="w-24 px-3 py-1.5 rounded-lg text-xs text-white outline-none font-mono"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={txCategory}
                    onChange={e => setTxCategory(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg text-xs text-slate-300 outline-none"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
                  >
                    {TX_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    onClick={handleAddTransaction}
                    disabled={!txNote.trim() || !txAmount}
                    className="px-4 py-1.5 rounded-lg text-xs text-white font-display font-500 disabled:opacity-40 transition-all"
                    style={{ background: 'color-mix(in srgb, var(--primary) 80%, transparent)' }}
                  >✓ Додати</button>
                  <button
                    onClick={() => setAddingTransaction(false)}
                    className="px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300"
                  >✕</button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onSave={saveTask}
          onDelete={deleteTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}
