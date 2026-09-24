import { type Task, type Habit, type Transaction, type CalendarEvent, type PinnedDoc } from '../types';

export const TASKS: Task[] = [
  {
    id: 't1', title: 'Підготувати презентацію для інвесторів', done: false, priority: 'high',
    deadline: '2026-09-25', tag: 'Бізнес',
    linkedDocs: [{ id: 'd1', name: 'Стратегія Q4 2026.docx', type: 'gdocs' }],
  },
  {
    id: 't2', title: 'Ревью коду модуля авторизації', done: false, priority: 'high',
    deadline: '2026-09-24', tag: 'Dev',
    linkedDocs: [{ id: 'd2', name: 'ТЗ_LifeSync_v2.pdf', type: 'gdrive' }],
  },
  { id: 't3', title: 'Оплатити хостинг сервера', done: true, priority: 'medium', deadline: '2026-09-24', tag: 'Фінанси' },
  {
    id: 't4', title: 'Написати звіт по Q3 аналітиці', done: false, priority: 'medium',
    deadline: '2026-09-27', tag: 'Аналітика',
    linkedDocs: [{ id: 'd3', name: 'Бюджет_жовтень.xlsx', type: 'gsheets' }],
  },
  { id: 't5', title: 'Позвонити Максиму щодо контракту', done: false, priority: 'low', deadline: '2026-09-26', tag: 'Комунікації' },
  { id: 't6', title: 'Оновити резюме та портфоліо', done: true, priority: 'low', tag: 'Особисте' },
];

function genHistory(): boolean[] {
  return Array.from({ length: 35 }, () => Math.random() > 0.25);
}

export const HABITS: Habit[] = [
  { id: 'h1', name: 'Ранкова медитація', emoji: '🧘', streak: 12, completedToday: true, history: genHistory() },
  { id: 'h2', name: 'Читання 30 хв', emoji: '📚', streak: 7, completedToday: false, history: genHistory() },
  { id: 'h3', name: 'Фізичні вправи', emoji: '💪', streak: 21, completedToday: true, history: genHistory() },
  { id: 'h4', name: 'Вода 2+ літри', emoji: '💧', streak: 4, completedToday: false, history: genHistory() },
  { id: 'h5', name: 'Без соцмереж до 10:00', emoji: '🚫', streak: 3, completedToday: true, history: genHistory() },
];

export const TRANSACTIONS: Transaction[] = [
  { id: 'tr1', type: 'income', amount: 85000, currency: 'UAH', category: 'Зарплата', date: '2026-09-01', note: 'Основна зарплата' },
  { id: 'tr2', type: 'income', amount: 300, currency: 'USD', rate: 41.5, category: 'Фріланс', date: '2026-09-10', note: 'Проєкт Landing Page' },
  { id: 'tr3', type: 'expense', amount: 380, currency: 'UAH', category: 'Їжа', date: '2026-09-24', note: 'Обід у ресторані' },
  { id: 'tr4', type: 'expense', amount: 30, currency: 'USD', category: 'Підписки', date: '2026-09-23', note: 'ChatGPT Pro' },
  { id: 'tr5', type: 'expense', amount: 4500, currency: 'UAH', category: 'Сервери', date: '2026-09-22', note: 'AWS EC2' },
  { id: 'tr6', type: 'expense', amount: 70, currency: 'EUR', rate: 44.2, category: 'Навчання', date: '2026-09-20', note: 'Udemy курс' },
  { id: 'tr7', type: 'expense', amount: 890, currency: 'UAH', category: 'Їжа', date: '2026-09-19', note: 'Grocery' },
  { id: 'tr8', type: 'income', amount: 5000, currency: 'UAH', category: 'Фріланс', date: '2026-09-15', note: 'Консультація' },
];

export const EVENTS: CalendarEvent[] = [
  { id: 'e1', title: 'Стендап з командою', time: '09:30', type: 'meeting' },
  { id: 'e2', title: 'Зустріч з клієнтом BioTech', time: '14:00', type: 'meeting' },
  { id: 'e3', title: 'Дзвінок з інвестором', time: '17:30', type: 'call' },
];

export const DEFAULT_PINNED_DOCS: PinnedDoc[] = [
  { id: 'd1', name: 'Стратегія Q4 2026.docx', type: 'gdocs', pinned: true, taskId: 't1', taskTitle: 'Презентація для інвесторів' },
  { id: 'd2', name: 'ТЗ_LifeSync_v2.pdf', type: 'gdrive', pinned: true, taskId: 't2', taskTitle: 'Ревью коду авторизації' },
  { id: 'd3', name: 'Бюджет_жовтень.xlsx', type: 'gsheets', pinned: false, taskId: 't4', taskTitle: 'Звіт Q3 аналітика' },
  { id: 'd4', name: 'Контракт_Максим.pdf', type: 'gdrive', pinned: false, taskId: 't5', taskTitle: 'Контракт' },
];

export const AREA_DATA = [
  { day: 'Пн', income: 0, expense: 1200 },
  { day: 'Вт', income: 0, expense: 890 },
  { day: 'Ср', income: 0, expense: 3094 },
  { day: 'Чт', income: 12450, expense: 4500 },
  { day: 'Пт', income: 0, expense: 1245 },
  { day: 'Сб', income: 5000, expense: 380 },
  { day: 'Нд', income: 0, expense: 380 },
];

export const PIE_DATA = [
  { name: 'Їжа', value: 1270, color: '#7C3AED' },
  { name: 'Сервери', value: 4500, color: '#06B6D4' },
  { name: 'Підписки', value: 1245, color: '#F59E0B' },
  { name: 'Навчання', value: 3094, color: '#10B981' },
  { name: 'Інше', value: 900, color: '#EC4899' },
];
