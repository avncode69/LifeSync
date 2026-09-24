// Cloudflare Pages Function: /api/monobank
export const onRequest = async ({ request }: { request: Request }) => {
  const token = request.headers.get('X-Token');
  if (!token) {
    return new Response(JSON.stringify({ error: 'X-Token header required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch('https://api.monobank.ua/personal/client-info', {
      headers: {
        'X-Token': token,
      },
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Monobank proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
