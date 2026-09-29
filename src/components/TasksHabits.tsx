import { useState } from 'react';
import { type Task, type Habit } from '../types';
import TaskEditModal from './TaskEditModal';

const PRIORITY_COLOR = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' };
const HEAT_COLORS = ['#1e293b', '#4c1d95', '#6d28d9', '#7c3aed', '#8b5cf6'];

function heatColor(done: boolean, i: number): string {
  if (!done) return HEAT_COLORS[0];
  return HEAT_COLORS[Math.min(4, Math.floor((i / 7) * 2) + 2)];
}

interface Props {
  tasks: Task[];
  onUpdateTasks: (tasks: Task[]) => void;
  habits?: Habit[];
  onUpdateHabits?: (habits: Habit[]) => void;
}

export default function TasksHabits({ tasks = [], onUpdateTasks, habits: externalHabits, onUpdateHabits }: Props) {
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [internalHabits, setInternalHabits] = useState<Habit[]>([]);
  const habits = externalHabits || internalHabits;

  const updateHabits = (next: Habit[]) => {
    setInternalHabits(next);
    if (onUpdateHabits) onUpdateHabits(next);
  };

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium' as Task['priority'], tag: '', deadline: '' });
  const [newHabit, setNewHabit] = useState({ name: '', emoji: '⭐' });
  const [filterPriority, setFilterPriority] = useState<'all' | Task['priority']>('all');

  const toggleTask = (id: string) => onUpdateTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const deleteTask = (id: string) => onUpdateTasks(tasks.filter(t => t.id !== id));
  const saveTask = (updated: Task) => onUpdateTasks(tasks.map(t => t.id === updated.id ? updated : t));

  const addTask = () => {
    if (!newTask.title.trim()) return;
    onUpdateTasks([...tasks, {
      id: `t${Date.now()}`, title: newTask.title, done: false,
      priority: newTask.priority, tag: newTask.tag || undefined,
      deadline: newTask.deadline || undefined,
    }]);
    setNewTask({ title: '', priority: 'medium', tag: '', deadline: '' });
    setShowAddTask(false);
  };

  const toggleHabit = (id: string) => {
    const next = habits.map(h =>
      h.id === id ? { ...h, completedToday: !h.completedToday, streak: h.completedToday ? Math.max(0, h.streak - 1) : h.streak + 1 } : h
    );
    updateHabits(next);
  };

  const deleteHabit = (id: string) => {
    const next = habits.filter(h => h.id !== id);
    updateHabits(next);
  };

  const addHabit = () => {
    if (!newHabit.name.trim()) return;
    const next = [...habits, {
      id: `h${Date.now()}`, name: newHabit.name, emoji: newHabit.emoji,
      streak: 0, completedToday: false, history: Array(35).fill(false),
    }];
    updateHabits(next);
    setNewHabit({ name: '', emoji: '⭐' });
    setShowAddHabit(false);
  };

  const filteredTasks = tasks.filter(t => filterPriority === 'all' || t.priority === filterPriority);

  const kanbanCols = {
    'Відкриті':   tasks.filter(t => !t.done && t.priority === 'high'),
    'В роботі':   tasks.filter(t => !t.done && t.priority === 'medium'),
    'Готово':     tasks.filter(t => t.done),
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 section-enter">

      {/* Task Manager */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/6">
          <h2 className="font-display font-700 text-white">✅ Таск-менеджер</h2>
          <div className="flex gap-1 ml-2">
            {(['all', 'high', 'medium', 'low'] as const).map(p => (
              <button key={p} onClick={() => setFilterPriority(p)}
                className={`px-2 py-0.5 rounded-md text-xs transition-all ${filterPriority === p ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                style={{ background: filterPriority === p ? (p === 'all' ? 'rgba(124,58,237,0.4)' : p === 'high' ? 'rgba(239,68,68,0.25)' : p === 'medium' ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)') : undefined }}>
                {p === 'all' ? 'Всі' : p === 'high' ? '🔴 Високий' : p === 'medium' ? '🟡 Середній' : '🟢 Низький'}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {(['list', 'kanban'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-display font-500 transition-all ${view === v ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                  {v === 'list' ? '≡ Список' : '⊞ Канбан'}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAddTask(!showAddTask)}
              className="px-3 py-1.5 rounded-lg text-xs font-display font-500 text-white transition-all"
              style={{ background: 'rgba(124,58,237,0.7)', border: '1px solid rgba(124,58,237,0.4)' }}>
              + Задача
            </button>
          </div>
        </div>

        {showAddTask && (
          <div className="px-5 py-3 border-b border-white/6" style={{ background: 'var(--subcard-bg)' }}>
            <div className="flex gap-2 flex-wrap">
              <input autoFocus value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                placeholder="Назва задачі…"
                className="flex-1 min-w-40 px-3 py-2 rounded-lg text-sm text-white placeholder-slate-600 outline-none"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }} />
              <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value as Task['priority'] }))}
                className="px-2 py-2 rounded-lg text-xs text-slate-300 outline-none"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}>
                <option value="high">🔴 Високий</option>
                <option value="medium">🟡 Середній</option>
                <option value="low">🟢 Низький</option>
              </select>
              <input value={newTask.tag} onChange={e => setNewTask(p => ({ ...p, tag: e.target.value }))}
                placeholder="Тег" className="w-24 px-2 py-2 rounded-lg text-xs text-slate-300 outline-none"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }} />
              <input type="date" value={newTask.deadline} onChange={e => setNewTask(p => ({ ...p, deadline: e.target.value }))}
                className="px-2 py-2 rounded-lg text-xs text-slate-300 outline-none"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', colorScheme: 'normal' }} />
              <button onClick={addTask} className="px-3 py-2 rounded-lg text-xs text-white" style={{ background: 'rgba(124,58,237,0.8)' }}>✓ Додати</button>
              <button onClick={() => setShowAddTask(false)} className="px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all">✕</button>
            </div>
          </div>
        )}

        {view === 'list' ? (
          <div className="p-3 space-y-0.5">
            {filteredTasks.map(task => (
              <div key={task.id}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${task.done ? 'opacity-40' : 'hover:bg-white/3'}`}>
                <input type="checkbox" className="custom-check" checked={task.done} onChange={() => toggleTask(task.id)} />
                <span
                  className={`flex-1 text-sm cursor-pointer ${task.done ? 'line-through text-slate-500' : 'text-slate-200 hover:text-white'}`}
                  onDoubleClick={() => setEditingTask(task)}
                >{task.title}</span>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {task.deadline && <span className="text-xs text-slate-500 font-mono">{task.deadline.slice(5)}</span>}
                  {task.tag && <span className="text-xs px-2 py-0.5 rounded-full text-slate-400" style={{ background: 'var(--hover-bg)' }}>{task.tag}</span>}
                </div>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[task.priority] }} />
                <button onClick={() => setEditingTask(task)}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-white text-xs hover:bg-white/10 transition-all shrink-0"
                  title="Редагувати">✏️</button>
                <button onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md flex items-center justify-center text-red-500 text-xs hover:bg-red-500/15 transition-all shrink-0"
                  title="Видалити">✕</button>
              </div>
            ))}
            {filteredTasks.length === 0 && (
              <p className="text-center text-slate-600 text-sm py-6">Немає задач</p>
            )}
          </div>
        ) : (
          <div className="p-4 grid grid-cols-3 gap-3">
            {(Object.entries(kanbanCols) as [string, Task[]][]).map(([col, colTasks]) => (
              <div key={col} className="rounded-xl p-3" style={{ background: 'var(--subcard-bg)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-display font-600 text-slate-400 uppercase tracking-wide">{col}</span>
                  <span className="text-xs text-slate-600 font-mono">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map(task => (
                    <div key={task.id} className="group rounded-lg p-3 transition-all"
                      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}>
                      <div className="flex items-start gap-1.5">
                        <p className="text-xs text-slate-200 flex-1 cursor-pointer" onDoubleClick={() => setEditingTask(task)}>{task.title}</p>
                        <button onClick={() => setEditingTask(task)}
                          className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded flex items-center justify-center text-slate-500 hover:text-white text-[10px] hover:bg-white/10 transition-all shrink-0" title="Редагувати">✏️</button>
                        <button onClick={() => deleteTask(task.id)}
                          className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded flex items-center justify-center text-red-500 text-[10px] hover:bg-red-500/15 transition-all shrink-0">✕</button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIORITY_COLOR[task.priority] }} />
                        {task.tag && <span className="text-xs px-1.5 py-0.5 rounded text-slate-500" style={{ background: 'var(--hover-bg)' }}>{task.tag}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Habit Tracker */}
      <div className="rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <h2 className="font-display font-700 text-white">🔥 Трекер звичок</h2>
          <button onClick={() => setShowAddHabit(!showAddHabit)}
            className="px-3 py-1.5 rounded-lg text-xs font-display font-500 text-white transition-all"
            style={{ background: 'rgba(124,58,237,0.7)', border: '1px solid rgba(124,58,237,0.4)' }}>
            + Звичка
          </button>
        </div>

        {showAddHabit && (
          <div className="px-5 py-3 border-b border-white/6" style={{ background: 'var(--subcard-bg)' }}>
            <div className="flex gap-2">
              <input value={newHabit.emoji} onChange={e => setNewHabit(p => ({ ...p, emoji: e.target.value }))}
                className="w-12 px-2 py-2 rounded-lg text-center text-lg outline-none"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }} />
              <input autoFocus value={newHabit.name} onChange={e => setNewHabit(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addHabit()}
                placeholder="Назва звички…"
                className="flex-1 px-3 py-2 rounded-lg text-sm text-white placeholder-slate-600 outline-none"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }} />
              <button onClick={addHabit} className="px-3 py-2 rounded-lg text-xs text-white" style={{ background: 'rgba(124,58,237,0.8)' }}>✓</button>
              <button onClick={() => setShowAddHabit(false)} className="px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300">✕</button>
            </div>
          </div>
        )}

        <div className="p-4 space-y-4">
          {habits.map(habit => (
            <div key={habit.id} className="group flex items-start gap-4">
              <button onClick={() => toggleHabit(habit.id)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-all ${
                  habit.completedToday ? 'scale-105' : 'hover:bg-white/8'
                }`}
                style={{
                  background: habit.completedToday ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
                  border: habit.completedToday ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: habit.completedToday ? '0 0 16px rgba(6,182,212,0.2)' : 'none',
                }}>
                {habit.emoji}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-display font-500 text-slate-200">{habit.name}</span>
                  <span className="text-xs font-mono text-orange-400">🔥 {habit.streak}д</span>
                  {habit.completedToday && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full text-emerald-400" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)' }}>Виконано</span>
                  )}
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, week) => (
                    <div key={week} className="flex flex-col gap-1">
                      {Array.from({ length: 7 }).map((_, day) => {
                        const idx = week * 7 + day;
                        return (
                          <div key={day} className="heat-cell" style={{ background: heatColor(habit.history[idx] ?? false, idx) }}
                            title={habit.history[idx] ? 'Виконано' : 'Пропущено'} />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => deleteHabit(habit.id)}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md flex items-center justify-center text-red-500 text-xs hover:bg-red-500/15 transition-all shrink-0 mt-2"
                title="Видалити звичку">✕</button>
            </div>
          ))}
          {habits.length === 0 && (
            <p className="text-center text-slate-600 text-sm py-4">Додайте першу звичку</p>
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
