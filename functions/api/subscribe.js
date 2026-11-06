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

async function notify(context, env, email, page) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const text = 'New crochet lead\n' + email + '\n' + (page || 'newsletter');
  const send = fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  })
    .then((res) => res.text())
    .catch((err) => console.error('telegram notify failed:', err && err.message));

  if (context && typeof context.waitUntil === 'function') context.waitUntil(send);
  else await send;
}

export async function onRequestPost(context) {
  const { request, env } = context;
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

  let isNew = false;
  try {
    const res = await env.DB.prepare(
      'INSERT INTO leads (email, source, page, country, user_agent) VALUES (?, ?, ?, ?, ?) ' +
      'ON CONFLICT(email) DO NOTHING'
    ).bind(email, source, page, country, userAgent).run();
    isNew = !!(res.meta && res.meta.changes > 0);
    if (!isNew) {
      await env.DB.prepare('UPDATE leads SET last_seen_at = CURRENT_TIMESTAMP WHERE email = ?')
        .bind(email)
        .run();
    }
  } catch (err) {
    console.error('subscribe storage failed:', err && err.message);
    return json({ ok: false, error: 'storage' }, 500);
  }

  if (isNew) await notify(context, env, email, page);

  return json({ ok: true }, 200);
}
