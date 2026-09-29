import { useState } from 'react';

type EventType = 'meeting' | 'call' | 'reminder' | 'personal' | 'deadline';
type ViewMode = 'month' | 'week' | 'day';

export interface CalEvent {
  id: string;
  title: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;
  type: EventType;
  description?: string;
  attendees?: string[];
  location?: string;
  color: string;
  googleId?: string;
}

const TYPE_META: Record<EventType, { label: string; color: string; icon: string }> = {
  meeting:  { label: 'Зустріч',    color: '#7C3AED', icon: '🤝' },
  call:     { label: 'Дзвінок',    color: '#06B6D4', icon: '📞' },
  reminder: { label: 'Нагадування',color: '#F59E0B', icon: '🔔' },
  personal: { label: 'Особисте',   color: '#10B981', icon: '🌿' },
  deadline: { label: 'Дедлайн',    color: '#EF4444', icon: '🔥' },
};

const nowYMD = toYMD(new Date());

const INITIAL_EVENTS: CalEvent[] = [];

const DAYS_UK = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS_UK = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function toYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // start Monday
  d.setDate(d.getDate() + diff);
  return d;
}

const BLANK_EVENT: Omit<CalEvent, 'id'> = {
  title: '', date: toYMD(new Date()), startTime: '09:00', endTime: '10:00',
  type: 'meeting', color: '#7C3AED', description: '', attendees: [], location: '',
};

interface CalendarProps {
  events?: CalEvent[];
  onUpdateEvents?: (evts: CalEvent[]) => void;
}

export default function Calendar({ events: externalEvents, onUpdateEvents }: CalendarProps = {}) {
  const [view, setView] = useState<ViewMode>('month');
  const [current, setCurrent] = useState(new Date());
  const [events, setEvents] = useState<CalEvent[]>(externalEvents || INITIAL_EVENTS);
  const [selected, setSelected] = useState<string | null>(null); // selected date YYYY-MM-DD
  const [editEvent, setEditEvent] = useState<CalEvent | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Omit<CalEvent, 'id'>>(BLANK_EVENT);
  const [syncing, setSyncing] = useState(false);

  const year = current.getFullYear();
  const month = current.getMonth();
  const today = toYMD(new Date());

  /* ---- Month grid ---- */
  const firstDay = new Date(year, month, 1);
  const startPad = (firstDay.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsForDate = (ymd: string) => events.filter(e => e.date === ymd);

  /* ---- Week grid ---- */
  const weekStart = startOfWeek(current);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  /* ---- Day view ---- */
  const dayEvents = eventsForDate(toYMD(current)).sort((a, b) => a.startTime.localeCompare(b.startTime));

  /* ---- Actions ---- */
  const openNew = (date?: string) => {
    setFormData({ ...BLANK_EVENT, date: date || toYMD(current) });
    setEditEvent(null);
    setShowForm(true);
  };

  const openEdit = (ev: CalEvent) => {
    setFormData({ ...ev });
    setEditEvent(ev);
    setShowForm(true);
  };

  const saveEvent = () => {
    if (!formData.title.trim()) return;
    let nextEvents: CalEvent[];
    if (editEvent) {
      nextEvents = events.map(e => e.id === editEvent.id ? { ...formData, id: editEvent.id, color: TYPE_META[formData.type].color } : e);
    } else {
      nextEvents = [...events, { ...formData, id: `ce${Date.now()}`, color: TYPE_META[formData.type].color }];
    }
    setEvents(nextEvents);
    if (onUpdateEvents) onUpdateEvents(nextEvents);
    setShowForm(false);
  };

  const deleteEvent = (id: string) => {
    const nextEvents = events.filter(e => e.id !== id);
    setEvents(nextEvents);
    if (onUpdateEvents) onUpdateEvents(nextEvents);
    setShowForm(false);
  };

  const syncGoogle = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 1800);
  };

  const nav = (dir: 1 | -1) => {
    const d = new Date(current);
    if (view === 'month') d.setMonth(d.getMonth() + dir);
    else if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrent(d);
  };

  const glassCard = { background: 'var(--card)', border: '1px solid var(--border)', backdropFilter: 'blur(20px)' };

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-hidden section-enter">
      {/* Toolbar */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Nav */}
        <button onClick={() => nav(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-all text-sm" style={{ border: '1px solid var(--border)' }}>‹</button>
        <button onClick={() => nav(1)}  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-all text-sm" style={{ border: '1px solid var(--border)' }}>›</button>

        <h2 className="font-display font-700 text-white text-lg min-w-40">
          {view === 'month' && `${MONTHS_UK[month]} ${year}`}
          {view === 'week' && `${weekDays[0].getDate()} — ${weekDays[6].getDate()} ${MONTHS_UK[weekDays[6].getMonth()]} ${year}`}
          {view === 'day' && `${current.getDate()} ${MONTHS_UK[month]}, ${DAYS_UK[current.getDay()]}`}
        </h2>

        <button onClick={() => setCurrent(new Date())} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/6 transition-all" style={{ border: '1px solid var(--border)' }}>
          Сьогодні
        </button>

        {/* View toggle */}
        <div className="flex rounded-lg overflow-hidden ml-2" style={{ border: '1px solid var(--border)' }}>
          {(['month', 'week', 'day'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-display transition-all capitalize ${view === v ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
              {v === 'month' ? 'Місяць' : v === 'week' ? 'Тиждень' : 'День'}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Google Sync */}
          <button onClick={syncGoogle} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all" style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)' }}>
            <div className="w-4 h-4 rounded bg-gradient-to-br from-blue-500 to-green-400 flex items-center justify-center text-[9px] font-bold text-white">G</div>
            <span className={`text-slate-400 ${syncing ? 'animate-pulse text-cyan-400' : ''}`}>{syncing ? 'Синхронізація…' : 'Синхронізувати'}</span>
          </button>

          <button onClick={() => openNew()} className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-display font-500 text-white transition-all" style={{ background: 'rgba(124,58,237,0.75)', border: '1px solid rgba(124,58,237,0.45)' }}>
            + Подія
          </button>
        </div>
      </div>

      {/* Google Calendar badge */}
      <div className="flex items-center gap-2 shrink-0 -mt-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 font-mono">Google Calendar підключено</span>
        </div>
        {Object.entries(TYPE_META).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full" style={{ background: v.color }} />
            {v.label}
          </div>
        ))}
      </div>

      {/* Main calendar area */}
      <div className="flex-1 overflow-hidden flex gap-4 min-h-0">
        {/* Calendar grid */}
        <div className="flex-1 rounded-2xl overflow-hidden flex flex-col min-h-0" style={glassCard}>
          {view === 'month' && (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-white/6 shrink-0">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(d => (
                  <div key={d} className={`py-2 text-center text-xs font-display font-600 ${d === 'Сб' || d === 'Нд' ? 'text-slate-600' : 'text-slate-400'}`}>{d}</div>
                ))}
              </div>
              {/* Cells */}
              <div className="flex-1 grid grid-cols-7 overflow-y-auto" style={{ gridAutoRows: 'minmax(80px, 1fr)' }}>
                {cells.map((day, i) => {
                  if (!day) return <div key={i} className="border-b border-r border-white/4" />;
                  const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayEvs = eventsForDate(ymd);
                  const isToday = ymd === today;
                  const isSelected = ymd === selected;
                  const isWeekend = (i % 7) >= 5;
                  return (
                    <div
                      key={i}
                      onClick={() => { setSelected(ymd); if (view !== 'day') {} }}
                      onDoubleClick={() => openNew(ymd)}
                      className={`border-b border-r border-white/4 p-1.5 cursor-pointer transition-all min-h-0 ${isSelected ? 'bg-violet-600/10' : isWeekend ? 'bg-white/1' : 'hover:bg-white/3'}`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono mb-1 ${isToday ? 'bg-violet-600 text-white font-700' : isWeekend ? 'text-slate-600' : 'text-slate-400'}`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvs.slice(0, 3).map(ev => (
                          <div key={ev.id}
                            onClick={e => { e.stopPropagation(); openEdit(ev); }}
                            className="flex items-center gap-1 px-1 py-0.5 rounded text-xs truncate cursor-pointer hover:brightness-125 transition-all"
                            style={{ background: `${ev.color}25`, borderLeft: `2px solid ${ev.color}` }}>
                            <span className="truncate text-slate-200" style={{ fontSize: 10 }}>{ev.title}</span>
                          </div>
                        ))}
                        {dayEvs.length > 3 && (
                          <div className="text-xs text-slate-600 px-1" style={{ fontSize: 10 }}>+{dayEvs.length - 3} ще</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {view === 'week' && (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header row */}
              <div className="grid border-b border-white/6 shrink-0" style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}>
                <div />
                {weekDays.map((d, i) => {
                  const ymd = toYMD(d);
                  const isToday = ymd === today;
                  return (
                    <div key={i} className={`py-2 text-center border-l border-white/5 ${isToday ? 'bg-violet-600/10' : ''}`}>
                      <div className="text-xs text-slate-500">{DAYS_UK[d.getDay()]}</div>
                      <div className={`w-7 h-7 rounded-full mx-auto flex items-center justify-center text-sm font-mono ${isToday ? 'bg-violet-600 text-white' : 'text-slate-300'}`}>
                        {d.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Time grid */}
              <div className="flex-1 overflow-y-auto">
                {HOURS.map(hour => (
                  <div key={hour} className="grid" style={{ gridTemplateColumns: '48px repeat(7, 1fr)', minHeight: 48 }}>
                    <div className="text-right pr-2 pt-0.5 text-xs font-mono text-slate-700 shrink-0">{hour === 0 ? '' : `${String(hour).padStart(2,'0')}:00`}</div>
                    {weekDays.map((d, di) => {
                      const ymd = toYMD(d);
                      const hEvs = events.filter(e => e.date === ymd && parseInt(e.startTime) === hour);
                      const isToday = ymd === today;
                      return (
                        <div key={di}
                          className={`border-l border-t border-white/5 relative cursor-pointer hover:bg-white/2 transition-all ${isToday ? 'bg-violet-600/5' : ''}`}
                          onDoubleClick={() => { setFormData({ ...BLANK_EVENT, date: ymd, startTime: `${String(hour).padStart(2,'0')}:00`, endTime: `${String(hour+1).padStart(2,'0')}:00` }); setEditEvent(null); setShowForm(true); }}>
                          {hEvs.map(ev => (
                            <div key={ev.id}
                              onClick={e => { e.stopPropagation(); openEdit(ev); }}
                              className="absolute inset-x-0.5 top-0.5 rounded px-1 py-0.5 text-xs cursor-pointer hover:brightness-110 z-10"
                              style={{ background: `${ev.color}30`, borderLeft: `2px solid ${ev.color}` }}>
                              <div className="truncate text-slate-200 font-mono" style={{ fontSize: 10 }}>{ev.startTime} {ev.title}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'day' && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-4 py-3 border-b border-white/6 flex items-center gap-3 shrink-0">
                <div className="text-sm font-display font-600 text-white">{current.getDate()} {MONTHS_UK[month]}, {DAYS_UK[current.getDay()]}</div>
                <span className="text-xs text-slate-500">{dayEvents.length} подій</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {HOURS.map(hour => {
                  const hEvs = dayEvents.filter(e => parseInt(e.startTime) === hour);
                  return (
                    <div key={hour} className="flex border-t border-white/5" style={{ minHeight: 56 }}>
                      <div className="w-12 text-right pr-2 pt-1 text-xs font-mono text-slate-700 shrink-0">
                        {hour === 0 ? '' : `${String(hour).padStart(2,'0')}:00`}
                      </div>
                      <div className="flex-1 relative border-l border-white/5 cursor-pointer hover:bg-white/2 transition-all"
                        onDoubleClick={() => { setFormData({ ...BLANK_EVENT, date: toYMD(current), startTime: `${String(hour).padStart(2,'0')}:00`, endTime: `${String(hour+1).padStart(2,'0')}:00` }); setEditEvent(null); setShowForm(true); }}>
                        {hEvs.map(ev => (
                          <div key={ev.id}
                            onClick={e => { e.stopPropagation(); openEdit(ev); }}
                            className="mx-2 my-0.5 rounded-xl px-3 py-2 cursor-pointer hover:brightness-110 transition-all"
                            style={{ background: `${ev.color}25`, border: `1px solid ${ev.color}50` }}>
                            <div className="flex items-center gap-2">
                              <span>{TYPE_META[ev.type].icon}</span>
                              <span className="text-sm text-white font-display font-500">{ev.title}</span>
                              <span className="text-xs font-mono text-slate-400 ml-auto">{ev.startTime} – {ev.endTime}</span>
                            </div>
                            {ev.location && <div className="text-xs text-slate-500 mt-0.5 ml-6">📍 {ev.location}</div>}
                            {ev.attendees?.length ? <div className="text-xs text-slate-500 mt-0.5 ml-6">👥 {ev.attendees.join(', ')}</div> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right panel: mini events list */}
        <div className="w-64 shrink-0 flex flex-col gap-3">
          {/* Selected day events or today */}
          <div className="rounded-2xl flex-1 flex flex-col min-h-0" style={glassCard}>
            <div className="px-4 py-3 border-b border-white/6 shrink-0">
              <div className="text-sm font-display font-600 text-white">
                {selected ? `${parseInt(selected.slice(8))} ${MONTHS_UK[parseInt(selected.slice(5,7))-1]}` : 'Сьогодні'}
              </div>
              <div className="text-xs text-slate-500">{eventsForDate(selected || today).length} подій</div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {(eventsForDate(selected || today).length === 0) && (
                <div className="text-xs text-slate-600 text-center py-6">Немає подій</div>
              )}
              {eventsForDate(selected || today).map(ev => (
                <div key={ev.id}
                  onClick={() => openEdit(ev)}
                  className="px-3 py-2.5 rounded-xl cursor-pointer hover:brightness-110 transition-all"
                  style={{ background: `${ev.color}18`, border: `1px solid ${ev.color}35` }}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm">{TYPE_META[ev.type].icon}</span>
                    <span className="text-xs font-display font-500 text-slate-200 flex-1 truncate">{ev.title}</span>
                    {ev.googleId && <span className="text-[10px] text-slate-600 font-mono">G</span>}
                  </div>
                  <div className="text-xs font-mono text-slate-500">{ev.startTime} – {ev.endTime}</div>
                  {ev.location && <div className="text-xs text-slate-600 truncate">📍 {ev.location}</div>}
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-white/6 shrink-0">
              <button onClick={() => openNew(selected || today)}
                className="w-full py-2 rounded-xl text-xs font-display text-violet-400 hover:text-violet-300 hover:bg-violet-600/10 transition-all"
                style={{ border: '1px solid rgba(124,58,237,0.25)' }}>
                + Додати подію
              </button>
            </div>
          </div>

          {/* Upcoming */}
          <div className="rounded-2xl p-3" style={glassCard}>
            <div className="text-xs font-display font-600 text-slate-300 mb-2">📅 Найближчі</div>
            <div className="space-y-1.5">
              {events
                .filter(e => e.date >= today)
                .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
                .slice(0, 4)
                .map(ev => (
                  <div key={ev.id} onClick={() => openEdit(ev)}
                    className="flex items-start gap-2 cursor-pointer hover:bg-white/4 px-2 py-1.5 rounded-lg transition-all">
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: ev.color }} />
                    <div className="min-w-0">
                      <div className="text-xs text-slate-300 truncate">{ev.title}</div>
                      <div className="text-xs font-mono text-slate-600">{ev.date.slice(5)} {ev.startTime}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Event form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: 'var(--modal-bg)', border: '1px solid var(--input-border)', backdropFilter: 'blur(24px)' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
              <h3 className="font-display font-700 text-white">{editEvent ? '✏️ Редагувати подію' : '+ Нова подія'}</h3>
              <div className="flex items-center gap-2">
                {editEvent?.googleId && (
                  <span className="flex items-center gap-1 text-xs text-slate-500 px-2 py-0.5 rounded-full" style={{ border: '1px solid var(--border)' }}>
                    <span className="w-3 h-3 rounded bg-gradient-to-br from-blue-500 to-green-400 flex items-center justify-center text-[8px] text-white font-bold">G</span>
                    Google Calendar
                  </span>
                )}
                <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg bg-white/6 hover:bg-white/10 text-slate-400 hover:text-white transition-all flex items-center justify-center text-sm">✕</button>
              </div>
            </div>

            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Назва *</label>
                <input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none transition-colors"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
                  placeholder="Назва події" autoFocus />
              </div>

              {/* Type */}
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Тип</label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.entries(TYPE_META) as [EventType, typeof TYPE_META[EventType]][]).map(([k, v]) => (
                    <button key={k} onClick={() => setFormData(p => ({ ...p, type: k, color: v.color }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-display transition-all ${formData.type === k ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                      style={{ background: formData.type === k ? `${v.color}30` : 'rgba(255,255,255,0.04)', border: `1px solid ${formData.type === k ? v.color + '60' : 'rgba(255,255,255,0.07)'}` }}>
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Дата</label>
                  <input type="date" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
                    className="w-full px-2.5 py-2 rounded-lg text-xs text-white outline-none"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', colorScheme: 'normal' }} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Початок</label>
                  <input type="time" value={formData.startTime} onChange={e => setFormData(p => ({ ...p, startTime: e.target.value }))}
                    className="w-full px-2.5 py-2 rounded-lg text-xs text-white outline-none"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', colorScheme: 'normal' }} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Кінець</label>
                  <input type="time" value={formData.endTime} onChange={e => setFormData(p => ({ ...p, endTime: e.target.value }))}
                    className="w-full px-2.5 py-2 rounded-lg text-xs text-white outline-none"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', colorScheme: 'normal' }} />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Місце / Посилання</label>
                <input value={formData.location || ''} onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
                  placeholder="Google Meet, Zoom, адреса…" />
              </div>

              {/* Attendees */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Учасники (через кому)</label>
                <input
                  value={(formData.attendees || []).join(', ')}
                  onChange={e => setFormData(p => ({ ...p, attendees: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
                  placeholder="Ірина, Максим, Денис" />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Опис</label>
                <textarea rows={2} value={formData.description || ''} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none resize-none"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
                  placeholder="Додаткові деталі…" />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-5 py-4 border-t border-white/6">
              {editEvent && (
                <button onClick={() => deleteEvent(editEvent.id)}
                  className="px-3 py-2 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                  style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                  🗑 Видалити
                </button>
              )}
              <div className="flex-1" />
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all">Скасувати</button>
              <button onClick={saveEvent}
                className="px-4 py-2 rounded-lg text-sm font-display font-500 text-white transition-all"
                style={{ background: 'rgba(124,58,237,0.8)', border: '1px solid rgba(124,58,237,0.4)' }}>
                {editEvent ? 'Зберегти зміни' : 'Створити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
