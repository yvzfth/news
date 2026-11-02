'use client';

// Pulse News — the whole frontend lives here: masthead (with the dock
// behaviour), tabs + search, day-grouped grid and the detail modal.
// Data comes from the site's own /api/news route.

import { useState, useEffect, useRef, useCallback } from 'react';

const DAYS_NAMES = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday',
};

const TABS = [
  ['all', 'All'], ['tech', 'Tech'], ['security', 'Security'],
  ['software', 'Software'], ['hn', 'Hacker News'], ['releases', 'Releases'],
  ['politics', 'Politics'], ['world', 'World'],
];

const CAT_COLORS = {
  tech: 'var(--tech)',
  security: 'var(--security)',
  software: 'var(--software)',
  hn: 'var(--hn)',
  releases: 'var(--releases)',
  politics: 'var(--politics)',
  world: 'var(--world)',
  all: 'var(--accent)',
};

const relTime = (iso) => {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

// ---------- small pieces ----------

function Logo({ cls = 'logo', width = 34, height = 24 }) {
  return (
    <svg className={cls} viewBox="6 8 36 32" width={width} height={height} aria-hidden="true">
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" className="grad-a" />
          <stop offset="100%" className="grad-b" />
        </linearGradient>
      </defs>
      <polyline className="pulse-line" points="8,24 17,24 21,13 27,35 31,24 40,24" />
      <circle className="pulse-dot" cx="40" cy="24" r="2.6" />
    </svg>
  );
}

function Figure({ item, cls }) {
  const [broken, setBroken] = useState(false);
  const hasImg = item.image && !broken;
  return (
    <div className={cls} style={{ '--cat-color': CAT_COLORS[item.category] || CAT_COLORS.all }}>
      {hasImg ? (
        <img
          loading="lazy"
          referrerPolicy="no-referrer"
          alt={item.title || 'article image'}
          src={item.image}
          onError={() => setBroken(true)}
        />
      ) : (
        // only cards with NO (working) thumbnail get the letter placeholder
        <span className="ph-letter">{(item.source || item.category || '•').charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

function Chip({ item }) {
  return (
    <span className={`chip ${item.category}`}>{item.category}</span>
  );
}

function SocialBadge() {
  return <span className="badge-social" title="Unverified social post — may be misleading">⚠ X · Unverified</span>;
}

function Card({ item, isHero = false, onOpen }) {
  const snip = (item.snippet || item.content || '').slice(0, isHero ? 240 : 160);
  return (
    <article
      className={isHero ? 'hero-card' : 'card'}
      onClick={() => onOpen(item)}
    >
      <Figure item={item} cls="figure" />
      <div className={isHero ? 'hero-body' : 'card-body'}>
        <span className="chip-row" style={{ display: 'inline' }}>
          <Chip item={item} />
          {item.social ? <SocialBadge /> : null}
        </span>
        {isHero
          ? <h2 className="hero-title">{item.title}</h2>
          : <h3 className="card-title">{item.title}</h3>}
        {snip ? (
          <p className={isHero ? 'hero-snip' : 'card-snip'}>
            {snip + (snip.length >= (isHero ? 240 : 160) ? '…' : '')}
          </p>
        ) : null}
        <div className={isHero ? 'modal-meta' : 'card-meta'}>
          <span className="src">{item.source}</span>
          <span className="dot" />
          <span>{relTime(item.published)}</span>
        </div>
      </div>
    </article>
  );
}

function Tabs({ active, onSelect }) {
  return (
    <nav className="tabs" id="tabs">
      {TABS.map(([cat, label]) => (
        <button
          key={cat}
          data-cat={cat}
          className={active === cat ? 'active' : ''}
          onClick={() => onSelect(cat)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function SearchRow({ query, onQuery }) {
  return (
    <div className="search-row">
      <input
        id="search"
        type="search"
        placeholder="Search headlines…"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
    </div>
  );
}

// circular refresh arrow for the navbar — only rendered while the wire
// is stale (never fetched, or the daily pull is overdue). Sits next to
// the theme button on every breakpoint, spins while pulling feeds.
function FetchButton({ busy, onClick }) {
  return (
    <button
      id="fetch-btn"
      className={busy ? 'busy' : ''}
      title="Fetch feeds now"
      aria-label="Fetch feeds now"
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </g>
      </svg>
    </button>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2v6a2 2 0 0 0 2 2h6" />
        <path d="M6 21V4a2 2 0 0 1 2-2h9l5 5v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" />
        <path d="M10 13h6M10 17h6" />
      </g>
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L13.663 8.5a2 2 0 0 0 1.063 1.062l6.135 1.582a.5.5 0 0 1 0 .962L14.726 14.063A2 2 0 0 0 13.662 15.5l-1.581 6.135a.5.5 0 0 1-.963 0z" />
      </g>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 3 3 10.5l7 2.5M21 3l-6.5 18-4-8M21 3 10 13" />
      </g>
    </svg>
  );
}

// the AI panel that opens under the article: auto summary first, then Q&A
function ArticleChat({ item, onClose }) {
  const [summaryData, setSummaryData] = useState(null); // {hook,bullets,why} | {plain}
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const [model, setModel] = useState('');
  const [messages, setMessages] = useState([]); // {role:'user'|'assistant', content}
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  // auto-summary: requested as soon as the panel opens
  useEffect(() => {
    let alive = true;
    setSummaryData(null);
    setSummaryError('');
    setMessages([]);
    setSummaryLoading(true);
    fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'summary', item }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.ok) {
          setSummaryData(d.summary || { plain: '' });
          setModel(d.model || '');
        } else {
          setSummaryError(d.error || 'AI summary unavailable.');
        }
      })
      .catch(() => { if (alive) setSummaryError('AI summary unavailable.'); })
      .finally(() => { if (alive) setSummaryLoading(false); });
    return () => { alive = false; };
  }, [item.id, item.url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.scrollTo({ top: 1e9 });
  }, [messages.length, sending]);

  const ask = async () => {
    const q = input.trim();
    if (!q || sending || summaryLoading) return;
    setInput('');
    setSending(true);
    const history = [...messages, { role: 'user', content: q }];
    setMessages(history);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', item, messages: history, question: q }),
      });
      const d = await res.json();
      setMessages((m) => [...m, {
        role: 'assistant',
        content: d.ok ? d.text : `⚠ ${d.error || 'AI is unavailable right now.'}`,
      }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: '⚠ Could not reach the AI service.' }]);
    }
    setSending(false);
  };

  return (
    <div className="pane ai-card">
      <div className="ai-chrome">
        <span className="ai-chrome-title">
          <SparkleIcon />
          AI Summary
        </span>
        {model ? <span className="ai-model">{model}</span> : null}
        <button className="close-btn" aria-label="Close" onClick={onClose}>✕</button>
      </div>

      <div className={`ai-summary${summaryLoading ? ' loading' : ''}`}>
        {summaryLoading ? (
          'Summarizing…'
        ) : summaryError ? (
          summaryError
        ) : summaryData?.plain ? (
          <p className="ai-plain">{summaryData.plain}</p>
        ) : (
          summaryData && (
            <>
              {summaryData.hook ? <p className="ai-lead">{summaryData.hook}</p> : null}
              {summaryData.bullets?.length ? (
                <>
                  <div className="ai-label">Key points</div>
                  <ul className="ai-bullets">
                    {summaryData.bullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </>
              ) : null}
              {summaryData.why ? (
                <>
                  <div className="ai-label">Why it matters</div>
                  <p className="ai-why">{summaryData.why}</p>
                </>
              ) : null}
            </>
          )
        )}
      </div>

      {messages.length || sending ? (
        <div className="ai-messages" ref={listRef}>
          {messages.map((m, i) => (
            <div key={i} className={`ai-msg ${m.role}`}>{m.content}</div>
          ))}
          {sending ? (
            <div className="ai-msg assistant ai-typing">
              <span className="ai-dots" />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="ai-input-row">
        <input
          type="text"
          placeholder={
            summaryLoading ? 'Summarizing first…' : 'Ask something about this news…'
          }
          value={input}
          disabled={summaryLoading}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
        />
        <button className={`ai-send${sending ? ' busy' : ''}`} aria-label="Ask" title="Ask the AI" onClick={ask}>
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

function Modal({ item, onClose }) {
  const [dateStr, setDateStr] = useState('');
  const [minimized, setMinimized] = useState(false);
  useEffect(() => {
    if (!item) return undefined;
    setDateStr(
      `${DAYS_NAMES[new Date(item.published).getDay()]}, ` +
      `${new Date(item.published).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    );
    setMinimized(false); // a freshly opened article always shows in full
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [item, onClose]);

  // scroll lock follows the minimized state: locked behind the full
  // window, released while the mini card floats so the feed itself
  // stays browsable underneath
  useEffect(() => {
    if (!item) return undefined;
    document.body.style.overflow = minimized ? '' : 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [item, minimized]);

  if (!item) return null;

  const full = (item.content || item.snippet || '').trim();
  // split long content into readable ~2-sentence paragraphs
  const paragraphs = full
    ? full.split(/(?<=\.)\s+(?=[A-Z„“"])/).reduce((acc, p, i) => {
        const gi = Math.floor(i / 2);
        (acc[gi] = acc[gi] || []).push(p);
        return acc;
      }, []).map((g) => g.join(' '))
    : [];

  return (
    <div
      className={`overlay${minimized ? ' minimized' : ''}`}
      onClick={(e) => { if (!minimized && e.target === e.currentTarget) setMinimized(true); }}
    >
      {/* the full window only hides while minimized — its DOM (and the
          AI conversation in it) stays alive and remounts nothing          */}
      <div className="modal-row" onClick={(e) => e.stopPropagation()}>
        {/* window 1 — the article itself, own title & own scroll */}
        <article className="pane article-modal" role="dialog" aria-modal="true">
          <div className="ai-chrome">
            <span className="ai-chrome-title">
              <DocIcon />
              Article
            </span>
            <button className="close-btn" aria-label="Close" onClick={onClose}>✕</button>
          </div>
          <div className="article-body">
            {item.image ? (
              <figure className="modal-hero">
                <img src={item.image} referrerPolicy="no-referrer" alt={item.title || ''} />
              </figure>
            ) : null}
            <div className="modal-meta">
              <Chip item={item} />
              {item.social ? <SocialBadge /> : null}
              <span className="src">{item.source}</span>
              <span className="dot" />
              <span>{dateStr} · {relTime(item.published)}</span>
            </div>
            {item.social ? (
              <div className="modal-warning">
                ⚠ This is an unverified social-media post — the claims aren&apos;t fact-checked and it can be misleading. Treat it as a signal, not news.
              </div>
            ) : null}
            <h2 className="modal-title">{item.title}</h2>
            <div className="modal-content">
              {paragraphs.length ? paragraphs.map((p, i) => <p key={i}>{p}</p>) : (
                <p>Full detail is available at the original source.</p>
              )}
            </div>
            <a className="modal-link" href={item.url} target="_blank" rel="noopener noreferrer">
              Read full story at source ↗
            </a>
          </div>
        </article>
        {/* window 2 — the AI assistant, independent from the article window */}
        <ArticleChat item={item} onClose={onClose} />
      </div>

      {/* minimized — small docked card; tap to restore, ✕ to close for good */}
      {minimized ? (
        <div className="mini-modal" onClick={(e) => e.stopPropagation()}>
          <button
            className="mini-restore"
            title="Restore window"
            aria-label="Restore article window"
            onClick={() => setMinimized(false)}
          >
            <Figure item={item} cls="mini-fig" />
            <span className="mini-text">
              <span className="mini-overline">{item.source}</span>
              <span className="mini-title">{item.title}</span>
            </span>
          </button>
          <button className="mini-close" title="Close" aria-label="Close article window" onClick={onClose}>✕</button>
        </div>
      ) : null}
    </div>
  );
}

// ---------- page ----------

export default function Page() {
  const [news, setNews] = useState({ lastFetch: null, items: [] });
  const [fetchError, setFetchError] = useState(false);
  const [activeCat, setActiveCat] = useState('all');
  const [query, setQuery] = useState('');
  const [today, setToday] = useState('');
  const [busy, setBusy] = useState(false);
  const [docked, setDocked] = useState(false);
  const [width, setWidth] = useState(1280); // SSR-safe desktop default
  const [panel, setPanel] = useState(null); // 'cat' | 'search' | null (mobile)
  const [openItem, setOpenItem] = useState(null);
  const searchRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      setNews(data);
      setFetchError(false);
    } catch {
      setFetchError(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => { setToday(new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })); }, []);

  // docking: replicate the vanilla scroll-listener (dock on any scroll)
  useEffect(() => {
    const onScroll = () => setDocked(window.scrollY > 10);
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    onScroll();
    onResize();
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); };
  }, []);

  // body classes drive the mobile collapsible panel CSS
  useEffect(() => {
    document.body.classList.toggle('cat-open', panel === 'cat');
    document.body.classList.toggle('search-open', panel === 'search');
    if (panel === 'search') setTimeout(() => searchRef.current?.focus(), 80);
  }, [panel]);

  // lock page scroll while the modal is open — handled inside Modal
  const refetch = useCallback(async () => {
    setBusy(true);
    try { await fetch('/api/refresh', { method: 'POST' }); } catch { /* offline — still reload */ }
    // the refresh route awaits the full pull (maxDuration 60s)
    await load();
    setBusy(false);
  }, [load]);

  const closeItem = useCallback(() => setOpenItem(null), []);

  const isMobile = width <= 640;
  const isDockCapable = width > 880;

  // measure the sticky navbar's real height into --dock-top so the
  // strips stick FLUSH to its bottom edge — the old hard-coded 44px
  // fallback left a ~5px gap under the slim mobile navbar
  useEffect(() => {
    const header = document.querySelector('.masthead');
    if (!header) return undefined;
    const sync = () => document.documentElement.style.setProperty('--dock-top', `${header.offsetHeight}px`);
    sync();
    if (document.fonts?.ready) document.fonts.ready.then(sync);
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [isMobile, docked]);

  const tabState = { active: activeCat, onSelect: (cat) => setActiveCat(cat) };

  // filtering mirrors the old client: category + search over title/snippet/content
  let items = news.items || [];
  if (activeCat !== 'all') items = items.filter((i) => i.category === activeCat);
  if (query) {
    const q = query.toLowerCase();
    items = items.filter((i) =>
      i.title.toLowerCase().includes(q) ||
      (i.snippet || '').toLowerCase().includes(q) ||
      (i.content || '').toLowerCase().includes(q));
  }

  // day grouping of the non-hero items (lastSeen || published)
  const byDay = new Map();
  for (const it of items.slice(1)) {
    const k = (it.lastSeen || it.published).slice(0, 10);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(it);
  }
  const todayKey = new Date().toISOString().slice(0, 10);
  const yestKey = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const controls = (
    <>
      <Tabs {...tabState} />
      <SearchRow query={query} onQuery={setQuery} />
    </>
  );

  // the wire refreshes once a day (Vercel cron, 05:00 UTC) — the fetch
  // arrow only appears when that pull is overdue or has never happened
  const WIRE_STALE_MS = 26 * 60 * 60 * 1000; // 26h — a day plus slack
  const wireAge = news.lastFetch ? Date.now() - new Date(news.lastFetch) : Infinity;
  const wireStale = !news.lastFetch || wireAge > WIRE_STALE_MS;

  return (
    <>
      <header className={`masthead${docked ? ' docked' : ''}`}>
        <div className="mast-inner">
          <a className="brand" href="/" aria-label="Pulse home">
            <Logo width={34} height={24} />
            <span className="wordmark">Pulse</span>
          </a>
          <p className="dateline">{today}</p>

          {/* scrolled desktop: controls move INSIDE the navbar, between
              the logo and the theme button */}
          {!isMobile && isDockCapable && docked ? (
            <div className="mast-dock" id="mast-dock">{controls}</div>
          ) : null}

          {/* mobile: single-line navbar with collapsible panel icons */}
          {isMobile ? (
            <div className="mast-icons" id="mast-icons">
              <button
                id="cat-toggle"
                className={`icon-btn${panel === 'cat' ? ' active' : ''}`}
                title="Categories"
                aria-label="Categories"
                aria-expanded={panel === 'cat'}
                onClick={() => setPanel(panel === 'cat' ? null : 'cat')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1.6" />
                    <rect x="14" y="3" width="7" height="7" rx="1.6" />
                    <rect x="3" y="14" width="7" height="7" rx="1.6" />
                    <rect x="14" y="14" width="7" height="7" rx="1.6" />
                  </g>
                </svg>
              </button>
              <button
                id="search-toggle"
                className={`icon-btn${panel === 'search' ? ' active' : ''}`}
                title="Search"
                aria-label="Search"
                aria-expanded={panel === 'search'}
                onClick={() => setPanel(panel === 'search' ? null : 'search')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20.5 20.5 16 16" />
                  </g>
                </svg>
              </button>
            </div>
          ) : null}

          {/* fetch arrow + theme — pinned to the navbar's right corner
              on every breakpoint; the arrow vanishes once the wire is fresh */}
          <div className="mast-actions">
            {wireStale ? <FetchButton busy={busy} onClick={refetch} /> : null}
            <ThemeButton />
          </div>
        </div>
      </header>

      {/* flow strip — desktop/tablet: before scroll it lives in the page;
          641–880 it also stay sticky-docked under the masthead via CSS */}
      {!isMobile && !(isDockCapable && docked) ? (
        <div className="navstrip">
          <div className="subnav">{controls}</div>
        </div>
      ) : null}

      {/* mobile collapsible panel — below the one-line navbar */}
      {isMobile && panel ? (
        <div className="navstrip">
          <div className="subnav">
            {panel === 'cat'
              ? <Tabs {...tabState} />
              : <SearchRow query={query} onQuery={setQuery} />}
          </div>
        </div>
      ) : null}

      <main>
        <div id="last-fetch-line" className="fetch-line">
          {fetchError
            ? 'Could not reach the server.'
            : news.lastFetch
              ? `${items.length} unique stories · wire updated ${relTime(news.lastFetch)}`
              : 'never fetched — the ↻ arrow in the top bar pulls the wire'}
        </div>

        <section id="hero">
          {items.length ? <Card item={items[0]} isHero onOpen={setOpenItem} /> : null}
        </section>

        <div id="days">
          {[...byDay.entries()].map(([day, list]) => {
            const d = new Date(day + 'T00:00:00');
            const label =
              day === todayKey ? 'Today'
              : day === yestKey ? 'Yesterday'
              : `${DAYS_NAMES[d.getDay()]}, ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
            return (
              <div key={day}>
                <div className="day-head">
                  <h2>{label}</h2>
                  <span className="count">{list.length} stories</span>
                  <span className="line" />
                </div>
                <div className="grid">
                  {list.map((it) => <Card key={it.id} item={it} onOpen={setOpenItem} />)}
                </div>
              </div>
            );
          })}
        </div>

        {!items.length && !fetchError ? (
          <div id="empty" className="empty">
            {query ? `No match for “${query}”.` : 'No stories yet — the ↻ arrow in the top bar pulls the wire.'}
          </div>
        ) : null}
      </main>

      <footer>
        <div className="foot-rule" />
        <p className="foot-brand">
          <Logo cls="foot-logo" width={24} height={17} />
          Pulse
        </p>
        <p>
          Tech, hacking, software, politics &amp; world news — aggregated from
          TechCrunch, The Verge, Ars Technica, Wired, GitHub Blog, dev.to, InfoQ,
          Stack Overflow Blog, The Hacker News, BleepingComputer, Krebs on Security,
          CSO, BBC, NPR, Al Jazeera &amp; Hacker News.
        </p>
        <p className="foot-note">⚠ X/Twitter posts are marked ⚠ UNVERIFIED — social claims are not fact-checked and can be misleading.</p>
        <p className="foot-note">Every headline appears exactly once — zero clutter, zero duplicates.</p>
      </footer>

      <Modal item={openItem} onClose={closeItem} />
    </>
  );
}

function ThemeButton() {
  const [theme, setTheme] = useState(null);
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  }, []);
  const toggle = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('pulse-theme', next); } catch { /* private mode */ }
    setTheme(next);
  };
  return (
    <button id="theme-btn" title="Toggle light / dark theme" aria-label="Toggle theme" onClick={toggle}>
      <span className="icon-sun" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" strokeWidth="2" />
          <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3 6.8 6.8M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5" />
        </svg>
      </span>
      <span className="icon-moon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
