import { type User } from '../types';
import { StorageService, type UserFullData } from './storage';

// Helper to hash password on client for local storage fallback
async function hashClientPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'lifesync_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const ApiService = {
  // 1. Реєстрація нового користувача
  async register(name: string, email: string, password: string):Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();

    if (!cleanName || !cleanEmail || !password) {
      return { success: false, error: "Будь ласка, заповніть усі поля" };
    }
    if (password.length < 6) {
      return { success: false, error: 'Пароль повинен містити щонайменше 6 символів' };
    }

    // Спроба відправити запит до Cloudflare Pages Functions (/api/auth/register)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, email: cleanEmail, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) localStorage.setItem('lifesync_token', data.token);
        if (data.user) {
          StorageService.setCurrentUser(data.user);
          return { success: true, user: data.user };
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        // Якщо сервер повернув явну помилку валідації (наприклад email зайнятий)
        if (res.status === 409) {
          return { success: false, error: errData.error || 'Користувач з таким email вже існує' };
        }
      }
    } catch {
      // Якщо бекенд не розгорнутий локально — використовуємо локальне сховище (Local-First fallback)
    }

    // Local-First Fallback
    const existingUsers = StorageService.getRegisteredUsers();
    if (existingUsers.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'Користувач з таким email вже зареєстрований' };
    }

    const passwordHash = await hashClientPassword(password);
    const newUser: User = {
      id: 'usr_' + Date.now().toString(36),
      name: cleanName,
      email: cleanEmail,
      provider: 'email',
      createdAt: new Date().toISOString(),
    };

    StorageService.saveRegisteredUser({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      passwordHash,
      provider: 'email',
    });

    // Initialize initial user data
    StorageService.getUserData(newUser.id);
    StorageService.setCurrentUser(newUser);

    return { success: true, user: newUser };
  },

  // 2. Вхід за Email та Паролем
  async login(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanEmail = email.toLowerCase().trim();

    if (!cleanEmail || !password) {
      return { success: false, error: 'Введіть email та пароль' };
    }

    // Спроба відправити запит до Cloudflare Pages Functions (/api/auth/login)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) localStorage.setItem('lifesync_token', data.token);
        if (data.user) {
          StorageService.setCurrentUser(data.user);
          return { success: true, user: data.user };
        }
      } else if (res.status === 401) {
        return { success: false, error: 'Невірний email або пароль' };
      }
    } catch {
      // Fallback to local
    }

    // Local-First Fallback
    const existingUsers = StorageService.getRegisteredUsers();
    const userRecord = existingUsers.find(u => u.email.toLowerCase() === cleanEmail);

    if (!userRecord) {
      return { success: false, error: 'Користувача з таким email не знайдено. Створіть акаунт у вкладці "Реєстрація"' };
    }

    const passwordHash = await hashClientPassword(password);
    if (userRecord.passwordHash !== passwordHash) {
      return { success: false, error: 'Невірний пароль' };
    }

    const user: User = {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      provider: userRecord.provider,
    };

    StorageService.setCurrentUser(user);
    return { success: true, user };
  },

  // 3. Вхід через Google OAuth 2.0
  async loginWithGoogle(profile?: { name?: string; email?: string; avatar?: string }): Promise<User> {
    const user: User = {
      id: 'usr_g_' + (profile?.email ? btoa(profile.email).replace(/=/g, '') : Date.now().toString(36)),
      name: profile?.name || 'Олександр Коваленко',
      email: profile?.email || 'alex.kovalenko@gmail.com',
      avatar: profile?.avatar,
      provider: 'google',
      createdAt: new Date().toISOString(),
    };

    StorageService.setCurrentUser(user);
    // Ініціалізація даних, якщо новий
    StorageService.getUserData(user.id);
    return user;
  },

  // 4. Синхронізація даних з Cloudflare D1
  async syncToCloudflare(userId: string, data: Partial<UserFullData>): Promise<boolean> {
    const token = localStorage.getItem('lifesync_token');
    if (!token) return false;

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // 5. Monobank API через проксі
  async getMonobankClient(token: string): Promise<any> {
    try {
      const res = await fetch('/api/monobank', {
        headers: { 'X-Token': token },
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback direct request
      try {
        const directRes = await fetch('https://api.monobank.ua/personal/client-info', {
          headers: { 'X-Token': token },
        });
        if (directRes.ok) return await directRes.json();
      } catch (e) {
        console.warn('Monobank CORS or Network error', e);
      }
    }
    return null;
  }
};
