// RSS/Atom fetching, light XML parsing, deduplication and persistence.
// Zero dependencies — Node 18+ built-in fetch.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Feeds, HN, ReleaseRepos, XFollowing, XBearer, SeenMaxAgeDays, ShowDays } from './sources.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// On Vercel the filesystem is read-only except /tmp, and it is per-instance —
// the serverless routes point the data dir there (see lib/data.js); locally
// ./data next to the project is kept as before.
export const DATA_DIR = process.env.PULSE_DATA_DIR
  || (process.env.VERCEL ? '/tmp/pulse-data' : path.join(__dirname, '..', 'data'));
export const NEWS_FILE = path.join(DATA_DIR, 'news.json');
export const SEEN_FILE = path.join(DATA_DIR, 'seen.json');

const FETCH_TIMEOUT_MS = 20000;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const decodeEntities = (s = '') =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') // handled pre-extraction too
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&#8217;/g, '’');

// strip scripts/styles/html tags and collapse whitespace.
// Iterative decode+strip pass handles feeds that double- or triple-encode
// their HTML (e.g. &amp;lt;p&amp;gt; appearing after one decode pass).
const cleanText = (s = '') => {
  for (let i = 0; i < 3; i++) {
    const decoded = decodeEntities(s);
    if (decoded === s) break;
    s = decoded;
  }
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const stripCdata = (s = '') => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

// dedupe key: domain + normalized title (crumbs punctuation & case)
const normalizeTitle = (t = '') =>
  t
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9ğüşöçı ]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const hashKey = (title, url) =>
  crypto
    .createHash('sha1')
    .update(normalizeTitle(title).slice(0, 120) + '|' + safeDomain(url))
    .digest('hex');

const safeDomain = (url = '') => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const safeFetch = async (url, opts = {}) => {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      // blog.mozilla.org, webkit.org etc. 403 non-browser UAs — use a
      // realistic Chrome UA string instead of a crawler-style one.
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      ...(opts.headers || {}),
    },
    ...opts,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res;
};

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
};

const loadJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

const saveJson = (file, data) => {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
};

// ---------------------------------------------------------------------------
// RSS / Atom parsing (regex-based, good enough for feed producers)
// ---------------------------------------------------------------------------

const extractTag = (block, names) => {
  for (const name of names) {
    const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i');
    const m = block.match(re);
    if (m) return cleanText(stripCdata(m[1]));
  }
  return '';
};

// pick the best available image for a feed item block.
// prefers largest media:content, then media:thumbnail, enclosure, inline <img>
const pickImage = (block) => {
  const candidates = [];
  for (const m of block.matchAll(/<media:content\b[^>]*>/gi)) {
    const url = m[0].match(/url=["']([^"']+)["']/i)?.[1];
    const width = +(m[0].match(/width=["'](\d+)["']/i)?.[1] || 0);
    if (url) candidates.push([width, url]);
  }
  for (const m of block.matchAll(/<media:thumbnail\b[^>]*>/gi)) {
    const url = m[0].match(/url=["']([^"']+)["']/i)?.[1];
    const width = +(m[0].match(/width=["'](\d+)["']/i)?.[1] || 0);
    if (url) candidates.push([width, url]);
  }
  for (const m of block.matchAll(/<enclosure\b[^>]*>/gi)) {
    if (/type=["']image\//i.test(m[0])) {
      const url = m[0].match(/url=["']([^"']+)["']/i)?.[1];
      if (url) candidates.push([1, url]);
    }
  }
  const inline = block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  if (inline) candidates.push([0, inline]);
  candidates.sort((a, b) => b[0] - a[0]);
  return candidates[0]?.[1] || '';
};

const buildBlockItem = (block) => ({
  title: extractTag(block, ['title']),
  snippet: extractTag(block, ['description', 'summary', 'content']).slice(0, 280),
  content: extractTag(block, ['content:encoded', 'description', 'content', 'summary']).slice(0, 2500),
  image: pickImage(block),
  published: extractTag(block, ['pubDate', 'published', 'updated', 'dc:date']),
});

const atomLink = (block) =>
  block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)?.[1] ||
  block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ||
  '';

const rssLink = (block) =>
  extractTag(block, ['link']) ||
  block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ||
  '';

const parseFeed = (xml) => {
  const items = [];

  // Atom entries
  for (const m of xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)) {
    const block = m[0];
    items.push({ ...buildBlockItem(block), url: atomLink(block) });
  }

  // RSS items
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const block = m[0];
    items.push({ ...buildBlockItem(block), url: rssLink(block) });
  }

  return items.filter((it) => it.title && it.url);
};

// ---------------------------------------------------------------------------
// fetching
// ---------------------------------------------------------------------------

// readable source name: keep last two labels, but include the third for
// public suffixes like co.uk / com.tr (feeds.bbci.co.uk → bbc.co.uk)
const prettySource = (url = '') => {
  const host = safeDomain(url);
  if (!host) return '';
  const labels = host.split('.');
  if (/^(co|com|org|gov|net)\.\w\w$/.test(labels.slice(-2).join('.'))) {
    return labels.slice(-3).join('.');
  }
  return labels.slice(-2).join('.');
};

const fetchFeed = async (feed) => {
  const xml = await (await safeFetch(feed.url)).text();
  const parsed = parseFeed(xml).slice(0, feed.limit || 40).map((it) => ({
    ...it,
    source: feed.label || prettySource(it.url) || prettySource(feed.url),
    category: feed.category,
  }));
  return parsed;
};

const fetchHackerNews = async () => {
  const ids = (await (await safeFetch(HN.top)).json()).slice(0, HN.limit);
  const stories = await Promise.allSettled(
    ids.map(async (id) => {
      const item = await (await safeFetch(`${HN.item}/${id}.json`)).json();
      if (!item || item.type !== 'story') throw new Error('skip');
      const url = item.url || `https://news.ycombinator.com/item?id=${item.id}`;
      return {
        title: item.title || '',
        url,
        snippet: '',
        content: item.text ? cleanText(item.text).slice(0, 2500) : '',
        image: '',
        published: item.time
          ? new Date(item.time * 1000).toISOString()
          : new Date().toISOString(),
        source: 'news.ycombinator.com',
        category: HN.category,
      };
    })
  );
  return stories.filter((r) => r.status === 'fulfilled').map((r) => r.value);
};

// ---------------------------------------------------------------------------
// dedupe & persistence
// ---------------------------------------------------------------------------

const loadSeen = () => loadJson(SEEN_FILE, { keys: {} });

const saveSeen = (seen) => {
  // prune old entries so the file doesn't grow forever
  const cutoff = Date.now() - SeenMaxAgeDays * 86400000;
  for (const [k, v] of Object.entries(seen.keys)) {
    if (v < cutoff) delete seen.keys[k];
  }
  saveJson(SEEN_FILE, seen);
};

// ---------------------------------------------------------------------------
// GitHub releases + channel release notes ("Releases" section)
// ---------------------------------------------------------------------------

// Latest releases from a repo via its `releases.atom` feed — served by
// github.com web, so it is NOT limited by the 60/hr unauthenticated REST
// API quota (which one refresh of a big repo list burns instantly), needs
// no GITHUB_TOKEN, and returns the 10 newest releases instead of only the
// single latest one. 404 here just means the repo publishes no releases —
// Promise.allSettled upstream skips those silently.
const fetchGithubRelease = async (item) => {
  const xml = await (await safeFetch(`https://github.com/${item.repo}/releases.atom`)).text();
  const repoName = item.repo.split('/')[1];

  return parseFeed(xml).slice(0, item.limit || 3).map((it) => {
    // many release names already start with the repo name — don't duplicate
    const title = it.title.toLowerCase().startsWith(repoName.toLowerCase() + ' ')
      ? it.title
      : `${repoName} ${it.title}`;
    return {
      title,
      url: it.url,
      snippet: (it.snippet || it.content || '').slice(0, 200),
      content: (it.content || it.snippet || '').slice(0, 2500),
      image: '',
      published: it.published || new Date().toISOString(),
      source: repoName,
      category: item.category,
    };
  });
};

// ---------------------------------------------------------------------------
// X (Twitter) via official API v2 — requires X_BEARER_TOKEN (see sources.js).
// Items are tagged social:true; the UI shows an "unverified" warning on them.
// ---------------------------------------------------------------------------

const fetchXFeed = async (feed) => {
  if (!XBearer) throw new Error(`no X API token — skipping @${feed.handle}`);
  const query = encodeURIComponent(
    `from:${feed.handle} -is:retweet -is:reply`
  );
  const url =
    `https://api.x.com/2/tweets/search/recent?query=${query}` +
    `&max_results=10&tweet.fields=created_at` +
    `&expansions=attachments.media_keys&media.fields=url,height,width`;

  const json = await (
    await safeFetch(url, { headers: { Authorization: `Bearer ${XBearer}` } })
  ).json();

  if (json.errors?.length && !json.data?.length) throw new Error(json.errors[0].message || 'X API error');

  const mediaBykey = new Map(
    (json.includes?.media || []).map((m) => [m.media_key, m])
  );

  return (json.data || []).map((t) => {
    const photos =
      (t.attachments?.media_keys || [])
        .map((k) => mediaBykey.get(k))
        .filter((m) => m?.type === 'photo') || [];
    return {
      title: cleanText(t.text).slice(0, 150),
      url: `https://x.com/${feed.handle}/status/${t.id}`,
      snippet: cleanText(t.text),
      content: cleanText(t.text),
      image: photos[0]?.url || '',
      published: t.created_at,
      source: `@${feed.handle} · X`,
      category: feed.category,
      social: true,
    };
  });
};

// ---------------------------------------------------------------------------
// image enrichment — items whose feed had no image get one pulled from
// the article page's <meta property="og:image"> / twitter:image.
// ---------------------------------------------------------------------------

const ENRICH_CONCURRENCY = 10;

const extractMetaImage = (html) => {
  const og = html.match(
    /<meta[^>]+(?:property=["']og:image["']|name=["']twitter:image[^"']*["'])[^>]*>/i
  );
  const url = og?.[0].match(/content=["']([^"']+)["']/i)?.[1];
  return url || '';
};

const resolveMaybeRelative = (url, base) => {
  try {
    return new URL(url, base).href;
  } catch {
    return '';
  }
};

const enrichOne = async (item) => {
  if (item.image || !item.url) return item;
  let host = '';
  try {
    host = new URL(item.url).hostname;
  } catch {
    return item;
  }
  // skip API-style links with no real article page
  if (/news\.ycombinator\.com/.test(host)) return item;

  try {
    const res = await safeFetch(item.url, {
      headers: { Accept: 'text/html' },
    });
    const html = (await res.text()).slice(0, 300000);
    const meta = extractMetaImage(html);
    if (meta) item.image = resolveMaybeRelative(meta, item.url);
  } catch {
    /* page fetch failed — keep the placeholder */
  }
  return item;
};

const enrichImages = async (newItems) => {
  const queue = newItems.filter((i) => !i.image);
  for (let i = 0; i < queue.length; i += ENRICH_CONCURRENCY) {
    await Promise.allSettled(queue.slice(i, i + ENRICH_CONCURRENCY).map(enrichOne));
  }
  return newItems;
};

// ---------------------------------------------------------------------------
// main: fetch everything, dedupe, persist
// ---------------------------------------------------------------------------

export const refreshAll = async () => {
  ensureDataDir();

  const seen = loadSeen();
  const prevNews = loadJson(NEWS_FILE, { items: [] });
  const now = Date.now();
  const window = now - ShowDays * 86400000; // keep last N days

  // Wipe expired entries from the active list (dedupe key memory still holds them)
  const keptPrev = prevNews.items.filter(
    (it) => new Date(it.lastSeen || it.firstSeen).getTime() >= window
  );
  const byKey = new Map(keptPrev.map((it) => [it.id, it]));

  // Fire all feeds in parallel (RSS, HN, and X-social when a token exists)
  const feedJobs = [
    ...Feeds.map((f) => fetchFeed(f)),
    fetchHackerNews(),
    ...ReleaseRepos.map((r) => fetchGithubRelease(r)),
    ...XFollowing.map((s) => fetchXFeed(s)),
  ];
  const results = await Promise.allSettled(feedJobs);

  let freshCount = 0;
  const freshList = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const it of r.value) {
      const key = hashKey(it.title, it.url);
      const pubMs = it.published ? new Date(it.published).getTime() : now;
      const published = Number.isFinite(pubMs)
        ? new Date(pubMs).toISOString()
        : new Date(now).toISOString();

      if (seen.keys[key] && seen.keys[key] > now - SeenMaxAgeDays * 86400000) {
        // story was already published on an earlier day — skip entirely
        continue;
      }

      const existing = byKey.get(key);
      if (existing) {
        existing.lastSeen = published > existing.lastSeen ? published : existing.lastSeen;
        continue; // already shown today; no duplicate
      }

      seen.keys[key] = now;
      const stored = {
        id: key,
        title: it.title,
        url: it.url,
        snippet: it.snippet?.slice(0, 260) || '',
        content: it.content || it.snippet || '',
        image: it.image || '',
        source: it.source,
        category: it.category,
        social: !!it.social, // X/Twitter posts: flagged "unverified" in the UI
        published,
        firstSeen: new Date(now).toISOString(),
        lastSeen: published,
      };
      byKey.set(key, stored);
      freshList.push(stored);
      freshCount++;
    }
  }

  const items = [...byKey.values()]
    .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen))
    .slice(0, 400);

  // newly added article items without a feed image get one from the page's
  // og:image (social/X items are skipped — the API supplies their media)
  await enrichImages(freshList.filter((it) => !it.image && !it.social));

  const collected = { lastFetch: new Date(now).toISOString(), items };
  saveJson(NEWS_FILE, collected);
  saveSeen(seen);

  return {
    fetchedAt: collected.lastFetch,
    fresh: freshCount,
    total: items.length,
  };
};

export const readNews = () =>
  loadJson(NEWS_FILE, { lastFetch: null, items: [] });
