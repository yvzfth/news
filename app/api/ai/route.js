// POST /api/ai — AI summary + Q&A over a news article, powered by Groq.
//
// GROQ_API_KEY is read SERVER-SIDE only (the browser never sees it).
// Model selection, most accurate first:
//   1. PULSE_AI_MODEL env override (any model id your Groq account shows)
//   2. a Groq "Compound" system model, when the account offers one — it
//      reaches the live web, so it can answer with the freshest facts
//   3. openai/gpt-oss-120b — the strongest reasoning chat model on Groq
//
// The article text itself (fetched minutes ago by our own aggregator) is
// always embedded in the system prompt, so answers stay grounded in the
// story the user is reading even when the model cannot browse.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FALLBACK_MODEL = 'openai/gpt-oss-120b';

// a 5-minute cache — models on the account are polled occasionally so a
// Compound (web-capable) model is picked up automatically if enabled
let cachedModel = null;
let cachedAt = 0;

const cleanKey = (k = '') => k.trim().replace(/^["']+|["']+$/g, '');

async function pickModel(key) {
  if (process.env.PULSE_AI_MODEL) return process.env.PULSE_AI_MODEL.trim();
  if (cachedModel && Date.now() - cachedAt < 5 * 60_000) return cachedModel;
  cachedModel = FALLBACK_MODEL;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const ids = (await res.json()).data.map((m) => m.id);
      cachedModel =
        ids.find((id) => /compound/i.test(id)) ||
        (ids.includes('openai/gpt-oss-120b') ? 'openai/gpt-oss-120b' : FALLBACK_MODEL);
      cachedAt = Date.now();
    }
  } catch {
    /* keep fallback */
  }
  return cachedModel;
}

const SUMMARY_SYSTEM = (title, content, url) =>
  "You are Pulse's news assistant. Summarize the article for a technically literate reader.\n" +
  'Rules: 3-4 tight sentences max, plain text, no markdown headers/bullets, ' +
  'no TLDR prefix, answer in the language the article is written in.\n\n' +
  `Title: ${title}\nURL: ${url}\nContent: ${content}`;

const CHAT_SYSTEM = (title, content, url) =>
  "You are Pulse's article assistant. The user is reading the article below and asks questions about it.\n" +
  'Rules: ground answers in the article; answer in the language the user writes in; ' +
  '5 sentences max unless the user asks for more; plain text, no markdown; ' +
  'if the question goes beyond the article (e.g. events after publication), answer ' +
  'with general knowledge and say clearly that you cannot browse the live web here.\n\n' +
  `Title: ${title}\nURL: ${url}\nContent: ${content}`;

export async function POST(req) {
  const key = cleanKey(process.env.GROQ_API_KEY || '');
  if (!key) {
    return Response.json(
      { ok: false, error: 'AI is not configured — set GROQ_API_KEY on the server.' },
      { status: 503 }
    );
  }

  let body;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const action = body.action === 'summary' ? 'summary' : 'chat';
  const item = body.item || {};
  const title = String(item.title || '').slice(0, 200);
  const url = String(item.url || '').slice(0, 300);
  const content = String(item.content || item.snippet || '').slice(0, 3800);
  const question = String(body.question || '').slice(0, 1200);
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && typeof m.content === 'string' && ['user', 'assistant'].includes(m.role))
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }))
    .slice(-8);

  if (action === 'summary' && !content) {
    return Response.json({ ok: false, error: 'Nothing to summarize.' }, { status: 400 });
  }

  const model = await pickModel(key);
  const messages = [
    { role: 'system', content: action === 'summary' ? SUMMARY_SYSTEM(title, content, url) : CHAT_SYSTEM(title, content, url) },
    ...history,
    ...(action === 'chat' && question ? [{ role: 'user', content: question }] : []),
  ];

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: action === 'summary' ? 0.3 : 0.5,
        max_tokens: action === 'summary' ? 400 : 700,
      }),
      signal: AbortSignal.timeout(55_000), // stays under the route's maxDuration
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      console.error(`groq ${res.status}:`, detail);
      return Response.json(
        { ok: false, error: 'AI request failed at Groq. Try again.' },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';
    return Response.json({ ok: true, text, model });
  } catch (e) {
    console.error('groq call error:', e.message);
    return Response.json(
      { ok: false, error: 'AI service unreachable. Try again shortly.' },
      { status: 504 }
    );
  }
}
