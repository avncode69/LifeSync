import { type User } from '../types';
import { StorageService, type UserFullData } from './storage';

export const ApiService = {
  // Login: only hardcoded admin/admin
  async login(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      return { success: false, error: 'Введіть логін та пароль' };
    }

    if (cleanEmail === 'admin' && cleanPassword === 'admin') {
      const user: User = {
        id: 'usr_admin',
        name: 'admin',
        email: 'admin',
        provider: 'email',
        createdAt: new Date().toISOString(),
      };
      StorageService.setCurrentUser(user);
      return { success: true, user };
    }

    return { success: false, error: 'Невірний логін або пароль' };
  },

  // Register: disabled
  async register(_name: string, _email: string, _password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    return { success: false, error: 'Реєстрація вимкнена. Використовуйте логін admin / пароль admin' };
  },

  // Sync to cloud (noop for now, keeps the interface)
  async syncToCloudflare(_userId: string, _data: Partial<UserFullData>): Promise<boolean> {
    return false;
  },

  // Monobank API
  async getMonobankClient(token: string): Promise<any> {
    try {
      const directRes = await fetch('https://api.monobank.ua/personal/client-info', {
        headers: { 'X-Token': token },
      });
      if (directRes.ok) return await directRes.json();
    } catch (e) {
      console.warn('Monobank error', e);
    }
    return null;
  }
};
