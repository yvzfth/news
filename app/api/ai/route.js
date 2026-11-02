// POST /api/ai — AI summary + Q&A over a news article, powered by Groq.
//
// GROQ_API_KEY is read SERVER-SIDE only (the browser never sees it).
// Model selection, most capable first:
//   1. PULSE_AI_MODEL env override (any model id your Groq account shows)
//   2. a Groq "Compound" system model, when the account offers one — it
//      reaches the live web natively
//   3. openai/gpt-oss-120b — the strongest reasoning chat model on Groq
//
// Fresh data: Groq's plain chat models cannot browse, so for Q&A this route
// performs its own live DuckDuckGo search (no API key needed) and injects
// the just-fetched results into the system prompt. The article body —
// aggregated minutes ago by our own fetcher — is always embedded too.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FALLBACK_MODEL = 'openai/gpt-oss-120b';

let cachedModel = null;
let cachedAt = 0;

const cleanKey = (k = '') => k.trim().replace(/^["']+|["']+$/g, '');
const stripTags = (s = '') =>
  s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

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
    /* keep the fallback */
  }
  return cachedModel;
}

// ---------------------------------------------------------------------------
// keyless live web search (DuckDuckGo html endpoint, browser-grade UA)
// ---------------------------------------------------------------------------

async function webSearch(query, maxResults = 5) {
  try {
    const res = await fetch(
      `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=wt-wt`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(12_000),
      }
    );
    if (!res.ok) return [];
    const html = await res.text();

    const results = [];
    const re =
      /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]+class="[^"]*result__a|$)/gi;
    for (const m of html.matchAll(re)) {
      if (results.length >= maxResults) break;
      // href is a duckduckgo redirect (/l/?uddg=<encoded real url>)
      const uddg = (m[1].replace(/&amp;/g, '&').match(/[?&]uddg=([^&]+)/) || [])[1];
      const url = uddg ? decodeURIComponent(uddg) : m[1];
      const title = stripTags(m[2]).slice(0, 160);
      if (!url.startsWith('http') || !title) continue;
      const snipMatch = m[3].match(/result__snippet[^>]*>([\s\S]*?)<\/(a|div|span)>/i);
      const snippet = snipMatch ? stripTags(snipMatch[1]).slice(0, 240) : '';
      results.push({ url, title, snippet });
    }
    return results;
  } catch {
    return [];
  }
}

const SUMMARY_SYSTEM = (title, content, url) =>
  "You are Pulse's news assistant. Summarize the article for a technically literate reader — STRUCTURED.\n" +
  'Reply with ONLY a JSON object, exactly this shape:\n' +
  '{"hook": string, "bullets": string[], "why": string}\n' +
  '- "hook": ONE crisp sentence (max 160 chars) capturing what happened.\n' +
  '- "bullets": 3-5 key facts, each a short standalone line (max 120 chars), no markdown, no numbering.\n' +
  '- "why": one sentence (max 200 chars) on why it matters / impact.\n' +
  'Write every value in the language the article is written in. No extra keys, no markdown, no text before or after the JSON.\n\n' +
  `Title: ${title}\nURL: ${url}\nContent: ${content}`;

const SUMMARY_SIMPLE = (title, content, url) =>
  "You are Pulse's news assistant. Summarize the article below in 3-4 tight plain-text sentences, " +
  'in the language the article is written in. No markdown.\n\n' +
  `Title: ${title}\nURL: ${url}\nContent: ${content}`;

const CHAT_SYSTEM = (title, content, url, webBlock) =>
  "You are Pulse's article assistant. The user is reading the article below and asks questions about it.\n" +
  'Rules: ground answers in the article; answer in the language the user writes in; ' +
  '5 sentences max unless the user asks for more; plain text, no markdown; ' +
  'cite the supporting domain in parentheses at the end of a claim, e.g. "(bleepingcomputer.com)".\n\n' +
  "You ALSO have live web results fetched moments ago — dated " +
  new Date().toISOString().slice(0, 10) + ':\n' + webBlock +
  '\nUse them for anything the article does not cover or that is NEWER than the article ' +
  '(follow-ups, fixes, reactions, exact figures). If the web results do not contain the ' +
  'answer, say so plainly instead of guessing.\n\n' +
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

  const callGroq = async (messages, maxTokens) => {
    const payload = { model, messages, temperature: 0.3, max_tokens: maxTokens };
    // gpt-oss models waste tokens on chain-of-thought when allowed — keep it minimal
    if (/^openai\/gpt-oss/i.test(model)) payload.reasoning_effort = 'low';
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(55_000), // stays under the route's maxDuration
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return { error: `groq ${res.status}: ${detail}` };
    }
    const data = await res.json();
    return { text: data.choices?.[0]?.message?.content?.trim() || '' };
  };

  try {
    if (action === 'summary') {
      let text;
      let call = await callGroq([{ role: 'system', content: SUMMARY_SYSTEM(title, content, url) }], 700);
      if (call.error) throw new Error(call.error);
      text = call.text;

      // flaky case: gpt-oss sometimes returns nothing in content — one plain retry
      if (!text) {
        call = await callGroq([{ role: 'system', content: SUMMARY_SIMPLE(title, content, url) }], 500);
        if (call.error) throw new Error(call.error);
        text = call.text;
        if (text) return Response.json({ ok: true, summary: { plain: text }, model });
      }

      let summary;
      try {
        const jsonish = text.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '');
        const start = jsonish.indexOf('{');
        const end = jsonish.lastIndexOf('}');
        const parsed = JSON.parse(jsonish.slice(start, end + 1));
        summary = {
          hook: String(parsed.hook || '').trim(),
          bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 6) : [],
          why: String(parsed.why || '').trim(),
        };
        if (!summary.hook && !summary.bullets.length && !summary.why) throw new Error('empty');
      } catch {
        summary = text ? { plain: text } : { plain: '' };
      }
      return Response.json({ ok: true, summary, model });
    }

    // ---- chat: live web search for facts newer than the article ----
    let webBlock = '(live web search unavailable right now)';
    let webHits = 0;
    if (title) {
      const results = await webSearch(title.slice(0, 160), 5);
      webHits = results.length;
      if (results.length) {
        webBlock = results
          .map((r, i) => `[${i + 1}] ${r.title} — ${r.snippet}\n    url: ${r.url}`)
          .join('\n');
      }
    }
    const webLine = `Live web results (fetched just now, ${webHits} hits):\n${webBlock}`;

    const messages = [
      { role: 'system', content: CHAT_SYSTEM(title, content, url, webLine) },
      ...history,
      ...(question ? [{ role: 'user', content: question }] : []),
    ];

    const call = await callGroq(messages, 700);
    if (call.error) {
      console.error('groq error:', call.error);
      return Response.json(
        { ok: false, error: 'AI request failed at Groq. Try again.' },
        { status: 502 }
      );
    }
    return Response.json({ ok: true, text: call.text, model, web: webHits });
  } catch (e) {
    console.error('groq call error:', e.message);
    return Response.json(
      { ok: false, error: 'AI service unreachable. Try again shortly.' },
      { status: 504 }
    );
  }
}
