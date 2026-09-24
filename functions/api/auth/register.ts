// Cloudflare Pages Function: /api/auth/register
interface Env {
  DB?: any; // Cloudflare D1 Database binding
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'lifesync_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    const body = await request.json() as { name?: string; email?: string; password?: string };
    const { name, email, password } = body;

    if (!email || !password || !name) {
      return new Response(JSON.stringify({ error: "Всі поля обов'язкові для заповнення" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const userId = 'usr_' + crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    if (env.DB) {
      // Check if user already exists
      const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(cleanEmail).first();
      if (existing) {
        return new Response(JSON.stringify({ error: 'Користувач з таким email вже існує' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Insert new user
      await env.DB.prepare(
        'INSERT INTO users (id, email, name, password_hash, provider, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(userId, cleanEmail, name.trim(), passwordHash, 'email', new Date().toISOString()).run();

      // Insert default settings
      await env.DB.prepare(
        'INSERT INTO user_settings (user_id, nickname, default_currency, exchange_rates) VALUES (?, ?, ?, ?)'
      ).bind(userId, name.trim(), 'UAH', JSON.stringify({ UAH: 1, USD: 41.5, EUR: 44.8, GBP: 52.3, PLN: 10.2 })).run();
    }

    const user = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      provider: 'email',
    };

    return new Response(JSON.stringify({
      success: true,
      user,
      token: 'jwt_' + btoa(JSON.stringify({ id: userId, email: cleanEmail, exp: Date.now() + 86400000 * 30 })),
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Помилка реєстрації на сервері' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
