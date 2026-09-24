// Cloudflare Pages Function: /api/sync
interface Env {
  DB?: any;
}

function getUserIdFromAuth(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer jwt_')) return null;
  try {
    const raw = auth.replace('Bearer jwt_', '');
    const decoded = JSON.parse(atob(raw));
    return decoded.id || null;
  } catch {
    return null;
  }
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const userId = getUserIdFromAuth(request);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Неавторизовано' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ synced: false, message: 'D1 database not bound' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const [tasksRes, habitsRes, txRes, eventsRes, settingsRes] = await Promise.all([
      env.DB.prepare('SELECT * FROM tasks WHERE user_id = ?').bind(userId).all(),
      env.DB.prepare('SELECT * FROM habits WHERE user_id = ?').bind(userId).all(),
      env.DB.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC').bind(userId).all(),
      env.DB.prepare('SELECT * FROM calendar_events WHERE user_id = ?').bind(userId).all(),
      env.DB.prepare('SELECT * FROM user_settings WHERE user_id = ?').bind(userId).first(),
    ]);

    const tasks = (tasksRes.results || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      done: Boolean(t.done),
      priority: t.priority,
      deadline: t.deadline || undefined,
      tag: t.tag || undefined,
      linkedDocs: t.linked_docs ? JSON.parse(t.linked_docs) : undefined,
      subtasks: t.subtasks ? JSON.parse(t.subtasks) : undefined,
    }));

    const habits = (habitsRes.results || []).map((h: any) => ({
      id: h.id,
      name: h.name,
      emoji: h.emoji,
      streak: Number(h.streak) || 0,
      completedToday: Boolean(h.completed_today),
      history: h.history ? JSON.parse(h.history) : [],
    }));

    const transactions = (txRes.results || []).map((tx: any) => ({
      id: tx.id,
      type: tx.type,
      amount: Number(tx.amount),
      currency: tx.currency,
      rate: tx.rate ? Number(tx.rate) : undefined,
      category: tx.category,
      date: tx.date,
      note: tx.note,
    }));

    const events = (eventsRes.results || []).map((e: any) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      startTime: e.start_time,
      endTime: e.end_time,
      type: e.type,
      description: e.description,
      attendees: e.attendees ? JSON.parse(e.attendees) : [],
      location: e.location,
      color: e.color,
      googleId: e.google_id,
    }));

    let settings = null;
    if (settingsRes) {
      settings = {
        nickname: settingsRes.nickname,
        monobankApiKey: settingsRes.monobank_api_key || '',
        defaultCurrency: settingsRes.default_currency || 'UAH',
        exchangeRates: settingsRes.exchange_rates ? JSON.parse(settingsRes.exchange_rates) : undefined,
      };
    }

    return new Response(JSON.stringify({
      synced: true,
      data: { tasks, habits, transactions, events, settings },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const userId = getUserIdFromAuth(request);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Неавторизовано' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ synced: false, message: 'D1 database not bound' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = await request.json() as {
      tasks?: any[];
      habits?: any[];
      transactions?: any[];
      events?: any[];
      settings?: any;
    };

    const statements: any[] = [];

    // Save tasks
    if (payload.tasks && Array.isArray(payload.tasks)) {
      statements.push(env.DB.prepare('DELETE FROM tasks WHERE user_id = ?').bind(userId));
      for (const t of payload.tasks) {
        statements.push(
          env.DB.prepare(
            'INSERT INTO tasks (id, user_id, title, done, priority, deadline, tag, linked_docs, subtasks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            t.id, userId, t.title, t.done ? 1 : 0, t.priority || 'medium',
            t.deadline || null, t.tag || null,
            t.linkedDocs ? JSON.stringify(t.linkedDocs) : null,
            t.subtasks ? JSON.stringify(t.subtasks) : null
          )
        );
      }
    }

    // Save habits
    if (payload.habits && Array.isArray(payload.habits)) {
      statements.push(env.DB.prepare('DELETE FROM habits WHERE user_id = ?').bind(userId));
      for (const h of payload.habits) {
        statements.push(
          env.DB.prepare(
            'INSERT INTO habits (id, user_id, name, emoji, streak, completed_today, history) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            h.id, userId, h.name, h.emoji || '⭐', h.streak || 0,
            h.completedToday ? 1 : 0,
            h.history ? JSON.stringify(h.history) : null
          )
        );
      }
    }

    // Save transactions
    if (payload.transactions && Array.isArray(payload.transactions)) {
      statements.push(env.DB.prepare('DELETE FROM transactions WHERE user_id = ?').bind(userId));
      for (const tx of payload.transactions) {
        statements.push(
          env.DB.prepare(
            'INSERT INTO transactions (id, user_id, type, amount, currency, rate, category, date, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            tx.id, userId, tx.type, tx.amount, tx.currency || 'UAH',
            tx.rate || null, tx.category, tx.date, tx.note || ''
          )
        );
      }
    }

    // Save calendar events
    if (payload.events && Array.isArray(payload.events)) {
      statements.push(env.DB.prepare('DELETE FROM calendar_events WHERE user_id = ?').bind(userId));
      for (const e of payload.events) {
        statements.push(
          env.DB.prepare(
            'INSERT INTO calendar_events (id, user_id, title, date, start_time, end_time, type, description, attendees, location, color, google_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            e.id, userId, e.title, e.date, e.startTime, e.endTime,
            e.type || 'meeting', e.description || '',
            e.attendees ? JSON.stringify(e.attendees) : null,
            e.location || '', e.color || '#7C3AED', e.googleId || null
          )
        );
      }
    }

    // Save settings
    if (payload.settings) {
      const s = payload.settings;
      statements.push(
        env.DB.prepare(
          'INSERT INTO user_settings (user_id, nickname, monobank_api_key, default_currency, exchange_rates, updated_at) VALUES (?, ?, ?, ?, ?, ?) ' +
          'ON CONFLICT(user_id) DO UPDATE SET nickname=excluded.nickname, monobank_api_key=excluded.monobank_api_key, default_currency=excluded.default_currency, exchange_rates=excluded.exchange_rates, updated_at=excluded.updated_at'
        ).bind(
          userId, s.nickname || '', s.monobankApiKey || '',
          s.defaultCurrency || 'UAH',
          s.exchangeRates ? JSON.stringify(s.exchangeRates) : null,
          new Date().toISOString()
        )
      );
    }

    if (statements.length > 0) {
      await env.DB.batch(statements);
    }

    return new Response(JSON.stringify({ success: true, savedAt: new Date().toISOString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
