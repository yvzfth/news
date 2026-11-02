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
      ) : null}
      <span className="ph-letter">{(item.source || item.category || '•').charAt(0).toUpperCase()}</span>
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

function SearchRow({ query, onQuery, busy, refetch }) {
  return (
    <div className="search-row">
      <button
        id="fetch-btn"
        className={busy ? 'busy' : ''}
        title="Fetch feeds now"
        aria-label="Fetch feeds"
        onClick={refetch}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 13v8l-4-4m4 4l4-4" />
            <path d="M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284" />
          </g>
        </svg>
      </button>
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

function Modal({ item, onClose }) {
  const [dateStr, setDateStr] = useState('');
  useEffect(() => {
    if (!item) return undefined;
    setDateStr(
      `${DAYS_NAMES[new Date(item.published).getDay()]}, ` +
      `${new Date(item.published).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    );
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [item, onClose]);

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
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <article className="modal" role="dialog" aria-modal="true">
        <button className="modal-close" aria-label="Close" onClick={onClose}>✕</button>
        {item.image ? (
          <figure className="modal-hero">
            <img src={item.image} referrerPolicy="no-referrer" alt={item.title || ''} />
          </figure>
        ) : null}
        <div className="modal-body">
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

  const isMobile = width <= 640;
  const isDockCapable = width > 880;

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
      <SearchRow query={query} onQuery={setQuery} busy={busy} refetch={refetch} />
    </>
  );

  return (
    <>
      <header className={`masthead${docked ? ' docked' : ''}`}>
        <div className="mast-inner">
          <a className="brand" href="/" aria-label="Pulse home">
            <Logo width={34} height={24} />
            <span className="wordmark">Pulse</span>
          </a>
          <p className="dateline" style={{ display: 'block' }}>{today}</p>

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

          <ThemeButton />
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
              : <SearchRow query={query} onQuery={setQuery} busy={busy} refetch={refetch} />}
          </div>
        </div>
      ) : null}

      <main>
        <div id="last-fetch-line" className="fetch-line">
          {fetchError
            ? 'Could not reach the server.'
            : news.lastFetch
              ? `${items.length} unique stories · wire updated ${relTime(news.lastFetch)}`
              : 'never fetched — press “Fetch feeds”'}
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
            {query ? `No match for “${query}”.` : 'No stories yet — hit “Fetch feeds” to pull the wire.'}
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

      <Modal item={openItem} onClose={() => setOpenItem(null)} />
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
