// Cloudflare Pages Function: /api/auth/login
interface Env {
  DB?: any;
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
    const body = await request.json() as { email?: string; password?: string };
    const { email, password } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Введіть email та пароль' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const passwordHash = await hashPassword(password);

    if (env.DB) {
      const user = await env.DB.prepare('SELECT id, name, email, password_hash, provider FROM users WHERE email = ?')
        .bind(cleanEmail)
        .first();

      if (!user || user.password_hash !== passwordHash) {
        return new Response(JSON.stringify({ error: 'Невірний email або пароль' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        user: { id: user.id, name: user.name, email: user.email, provider: user.provider },
        token: 'jwt_' + btoa(JSON.stringify({ id: user.id, email: user.email, exp: Date.now() + 86400000 * 30 })),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user: { id: 'usr_local', name: 'Користувач', email: cleanEmail, provider: 'email' },
      token: 'jwt_mock_' + Date.now(),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Помилка авторизації' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
