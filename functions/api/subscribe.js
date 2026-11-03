const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export async function onRequestPost({ request, env }) {
  let email;
  let page = '';

  try {
    const type = request.headers.get('content-type') || '';
    if (type.includes('application/json')) {
      const body = await request.json();
      email = body.email;
      page = body.page || '';
    } else {
      const form = await request.formData();
      email = form.get('email');
      page = form.get('page') || '';
    }
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  email = typeof email === 'string' ? email.trim().toLowerCase() : '';
  page = typeof page === 'string' ? page.trim().slice(0, 300) : '';

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'invalid_email' }, 400);
  }

  const source = page ? 'pdf' : 'newsletter';
  const country = request.cf?.country || '';
  const userAgent = (request.headers.get('user-agent') || '').slice(0, 300);

  try {
    await env.DB.prepare(
      'INSERT INTO leads (email, source, page, country, user_agent) VALUES (?, ?, ?, ?, ?) ' +
      'ON CONFLICT(email) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP'
    ).bind(email, source, page, country, userAgent).run();
  } catch (err) {
    console.error('subscribe storage failed:', err && err.message);
    return json({ ok: false, error: 'storage' }, 500);
  }

  return json({ ok: true }, 200);
}
