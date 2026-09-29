import { type User, type Task, type Habit, type Transaction, type CalendarEvent, type PinnedDoc, type UserSettings } from '../types';

const CURRENT_USER_KEY = 'lifesync_current_user';
const USERS_LIST_KEY = 'lifesync_registered_users';
const DATA_PREFIX = 'lifesync_data_';

export interface UserFullData {
  tasks: Task[];
  habits: Habit[];
  transactions: Transaction[];
  events: CalendarEvent[];
  pinnedDocs: PinnedDoc[];
  settings: UserSettings;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  nickname: '',
  monobankApiKey: '',
  defaultCurrency: 'UAH',
  exchangeRates: {
    UAH: 1,
    USD: 41.5,
    EUR: 44.8,
    GBP: 52.3,
    PLN: 10.2,
  },
  googleConnected: false,
};

export const StorageService = {
  getCurrentUser(): User | null {
    try {
      const raw = localStorage.getItem(CURRENT_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setCurrentUser(user: User): void {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  },

  clearCurrentUser(): void {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

  getRegisteredUsers(): Array<{ id: string; name: string; email: string; passwordHash: string; provider: 'email' | 'google' }> {
    try {
      const raw = localStorage.getItem(USERS_LIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveRegisteredUser(user: { id: string; name: string; email: string; passwordHash: string; provider: 'email' | 'google' }): void {
    const list = this.getRegisteredUsers();
    const existingIndex = list.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
    if (existingIndex >= 0) {
      list[existingIndex] = user;
    } else {
      list.push(user);
    }
    localStorage.setItem(USERS_LIST_KEY, JSON.stringify(list));
  },

  getUserData(userId: string): UserFullData {
    try {
      const raw = localStorage.getItem(DATA_PREFIX + userId);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // fallback
    }

    // Empty initial data - no seed data
    const initialData: UserFullData = {
      tasks: [],
      habits: [],
      transactions: [],
      events: [],
      pinnedDocs: [],
      settings: { ...DEFAULT_USER_SETTINGS },
    };
    this.saveUserData(userId, initialData);
    return initialData;
  },

  saveUserData(userId: string, data: Partial<UserFullData>): void {
    try {
      const existing = localStorage.getItem(DATA_PREFIX + userId);
      const current = existing ? JSON.parse(existing) : {
        tasks: [], habits: [], transactions: [], events: [], pinnedDocs: [],
        settings: { ...DEFAULT_USER_SETTINGS },
      };
      const merged = { ...current, ...data };
      localStorage.setItem(DATA_PREFIX + userId, JSON.stringify(merged));
    } catch (e) {
      console.error('Failed to save user data locally', e);
    }
  },

  deleteUserData(userId: string): void {
    localStorage.removeItem(DATA_PREFIX + userId);
    const users = this.getRegisteredUsers().filter(u => u.id !== userId);
    localStorage.setItem(USERS_LIST_KEY, JSON.stringify(users));
    this.clearCurrentUser();
  },

  exportJSON(userId: string, userName: string): void {
    const data = this.getUserData(userId);
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lifesync-export-${userName.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
