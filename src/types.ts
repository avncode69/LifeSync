export type Section = 'dashboard' | 'calendar' | 'tasks' | 'finance' | 'ai';

export type Priority = 'high' | 'medium' | 'low';
export type Currency = 'UAH' | 'USD' | 'EUR' | 'GBP' | 'PLN';

export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: Priority;
  deadline?: string;
  tag?: string;
  linkedDocs?: LinkedDoc[];
  subtasks?: Task[];
}

export interface LinkedDoc {
  id: string;
  name: string;
  type: 'gdocs' | 'gsheets' | 'gmail' | 'gdrive' | 'url';
  url?: string;
}

export interface PinnedDoc {
  id: string;
  name: string;
  type: 'gdocs' | 'gsheets' | 'gmail' | 'gdrive' | 'url';
  pinned: boolean;
  taskId?: string;
  taskTitle?: string;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  streak: number;
  completedToday: boolean;
  history: boolean[];
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: Currency;
  rate?: number;         // custom rate for this transaction (to UAH)
  category: string;
  date: string;
  note: string;
}

export interface ExchangeRates {
  USD: number;
  EUR: number;
  GBP: number;
  PLN: number;
  UAH: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  type: 'meeting' | 'call' | 'reminder';
}

export interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  time: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: 'email' | 'google';
  createdAt?: string;
}

export interface UserSettings {
  nickname: string;
  monobankApiKey: string;
  defaultCurrency: Currency;
  exchangeRates: ExchangeRates;
  googleClientId?: string;
  googleConnected?: boolean;
}
