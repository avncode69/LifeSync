import { useState } from 'react';
import { type Task } from '../types';

const PRIORITY_COLOR = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' };

interface Props {
  task: Task;
  onSave: (updated: Task) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function TaskEditModal({ task, onSave, onDelete, onClose }: Props) {
  const [form, setForm] = useState<Task>({ ...task });

  const handleSave = () => {
    if (!form.title.trim()) return;
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--modal-bg)', border: '1px solid var(--input-border)', backdropFilter: 'blur(24px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
          <h3 className="font-display font-700 text-white text-sm">✏️ Редагувати задачу</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/6 hover:bg-white/10 text-slate-400 hover:text-white transition-all flex items-center justify-center text-sm">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Назва задачі</label>
            <input
              autoFocus
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-colors"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
              placeholder="Назва задачі…"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Пріоритет</label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setForm(f => ({ ...f, priority: p }))}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-display font-500 transition-all"
                  style={{
                    background: form.priority === p ? `${PRIORITY_COLOR[p]}25` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${form.priority === p ? PRIORITY_COLOR[p] + '60' : 'rgba(255,255,255,0.08)'}`,
                    color: form.priority === p ? '#fff' : '#64748b',
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: PRIORITY_COLOR[p] }} />
                  {p === 'high' ? 'Високий' : p === 'medium' ? 'Середній' : 'Низький'}
                </button>
              ))}
            </div>
          </div>

          {/* Tag & Deadline */}
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Тег / Категорія</label>
              <input
                value={form.tag || ''}
                onChange={e => setForm(f => ({ ...f, tag: e.target.value || undefined }))}
                className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none transition-colors"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
                placeholder="Dev, Бізнес…"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Дедлайн</label>
              <input
                type="date"
                value={form.deadline || ''}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value || undefined }))}
                className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none transition-colors"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', colorScheme: 'normal' }}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Статус</label>
            <div className="flex gap-2">
              {[
                { val: false, label: '○ Відкрита', color: '#7C3AED' },
                { val: true,  label: '✓ Виконана', color: '#10B981' },
              ].map(s => (
                <button
                  key={String(s.val)}
                  onClick={() => setForm(f => ({ ...f, done: s.val }))}
                  className="flex-1 py-2 rounded-xl text-xs font-display font-500 transition-all"
                  style={{
                    background: form.done === s.val ? `${s.color}20` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${form.done === s.val ? s.color + '50' : 'rgba(255,255,255,0.08)'}`,
                    color: form.done === s.val ? '#fff' : '#64748b',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-white/6">
          <button
            onClick={() => { onDelete(task.id); onClose(); }}
            className="px-3 py-2 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
            style={{ border: '1px solid rgba(239,68,68,0.2)' }}
          >
            🗑 Видалити
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all">
            Скасувати
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-display font-500 text-white transition-all"
            style={{ background: 'rgba(124,58,237,0.8)', border: '1px solid rgba(124,58,237,0.4)' }}
          >
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
}
