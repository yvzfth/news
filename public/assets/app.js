// Pulse News — frontend. Loads /api/news, renders hero + day-grouped grid,
// opens a detail modal on card click. Polls every 60 s.

const DAYS_NAMES = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday',
};

let activeCat = 'all';
let query = '';
let currentItems = [];

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

const $hero = document.getElementById('hero');
const $days = document.getElementById('days');
const $empty = document.getElementById('empty');
const $fetchLine = document.getElementById('last-fetch-line');
const $dateline = document.getElementById('dateline');
const $refresh = document.getElementById('fetch-btn');
const $overlay = document.getElementById('overlay');

$dateline.style.display = 'block';
$dateline.textContent = new Date().toLocaleDateString('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

// ---------- theme (manual toggle, remembers choice, defaults to OS) ----------

const THEME_KEY = 'pulse-theme';
const applyTheme = (t) => document.documentElement.dataset.theme = t;
const savedTheme = localStorage.getItem(THEME_KEY) ||
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
applyTheme(savedTheme);

document.getElementById('theme-btn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

const relTime = (iso) => {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

// build a figure (image or colored placeholder). Returns { node, img }
function makeFigure(item, cls) {
  const fig = document.createElement('div');
  fig.className = cls;
  fig.style.setProperty('--cat-color', CAT_COLORS[item.category] || CAT_COLORS.all);
  const letter = document.createElement('span');
  letter.className = 'ph-letter';
  letter.textContent = (item.source || item.category || '•').charAt(0).toUpperCase();
  fig.append(letter);
  if (item.image) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.alt = item.title || 'article image';
    img.addEventListener('load', () => letter.remove());
    img.addEventListener('error', () => img.remove()); // falls back to placeholder
    img.src = item.image;
    fig.prepend(img);
  }
  return fig;
}

// ---------- card rendering (DOM built with textContent — no HTML injection) ----------

function makeCard(item, isHero = false) {
  const card = document.createElement('article');
  card.className = isHero ? 'hero-card' : 'card';
  card.addEventListener('click', () => openModal(item, card));

  const chip = document.createElement('span');
  chip.className = `chip ${item.category}`;
  chip.textContent = item.category;

  const chipRow = document.createElement('span');
  chipRow.style.display = 'inline';
  chipRow.append(chip);
  if (item.social) {
    const warn = document.createElement('span');
    warn.className = 'badge-social';
    warn.title = 'Unverified social post — may be misleading';
    warn.textContent = '⚠ X · Unverified';
    chipRow.append(warn);
  }

  const title = document.createElement(isHero ? 'h2' : 'h3');
  title.className = isHero ? 'hero-title' : 'card-title';
  title.textContent = item.title;

  const snipText = (item.snippet || item.content || '').slice(0, isHero ? 240 : 160);
  const snip = document.createElement('p');
  snip.className = isHero ? 'hero-snip' : 'card-snip';
  if (snipText) snip.textContent = snipText + (snipText.length >= 160 ? '…' : '');

  const meta = document.createElement('div');
  meta.className = isHero ? 'modal-meta' : 'card-meta';
  const src = document.createElement('span');
  src.className = 'src';
  src.textContent = item.source;
  const dot = document.createElement('span');
  dot.className = 'dot';
  const time = document.createElement('span');
  time.textContent = relTime(item.published);
  meta.append(src, dot, time);

  if (isHero) {
    card.append(makeFigure(item, 'figure'));
    const body = document.createElement('div');
    body.className = 'hero-body';
    body.append(chipRow, title, snip, meta);
    card.append(body);
  } else {
    card.append(makeFigure(item, 'figure'));
    const body = document.createElement('div');
    body.className = 'card-body';
    body.append(chipRow, title, snip, meta);
    card.append(body);
  }
  return card;
}

function renderNews(items) {
  $hero.innerHTML = '';
  $days.innerHTML = '';

  if (!items.length) {
    $empty.hidden = false;
    $empty.textContent = query
      ? `No match for “${query}”.`
      : 'No stories yet — hit “Fetch feeds” to pull the wire.';
    return;
  }
  $empty.hidden = true;

  currentItems = items;
  const [hero, ...rest] = items;
  $hero.append(makeCard(hero, true));

  // group remaining items strictly by day
  const byDay = new Map();
  for (const it of rest) {
    const k = (it.lastSeen || it.published).slice(0, 10);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(it);
  }

  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  for (const [day, list] of byDay) {
    const d = new Date(day + 'T00:00:00');
    const label =
      day === today ? 'Today'
      : day === yest ? 'Yesterday'
      : `${DAYS_NAMES[d.getDay()]}, ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;

    const head = document.createElement('div');
    head.className = 'day-head';
    const h = document.createElement('h2');
    h.textContent = label;
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = `${list.length} stories`;
    const line = document.createElement('span');
    line.className = 'line';
    head.append(h, count, line);
    $days.append(head);

    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const it of list) grid.append(makeCard(it));
    $days.append(grid);
  }
}

// ---------- detail modal ----------

function openModal(item) {
  const $fig = $overlay.querySelector('.modal-hero');
  const $meta = $overlay.querySelector('.modal-meta');
  const $title = $overlay.querySelector('.modal-title');
  const $content = $overlay.querySelector('.modal-content');
  const $link = $overlay.querySelector('.modal-link');

  $fig.hidden = !item.image;
  $fig.innerHTML = '';
  if (item.image) {
    const img = document.createElement('img');
    img.referrerPolicy = 'no-referrer';
    img.alt = item.title || '';
    img.src = item.image;
    $fig.append(img);
  }

  $meta.innerHTML = '';
  const chip = document.createElement('span');
  chip.className = `chip ${item.category}`;
  chip.textContent = item.category;
  $meta.append(chip);
  if (item.social) {
    const warn = document.createElement('span');
    warn.className = 'badge-social';
    warn.textContent = '⚠ X · Unverified';
    $meta.append(warn);
  }
  const src = document.createElement('span');
  src.className = 'src';
  src.textContent = item.source;
  const dot = document.createElement('span');
  dot.className = 'dot';
  const time = document.createElement('span');
  time.textContent =
    `${DAYS_NAMES[new Date(item.published).getDay()]}, ` +
    `${new Date(item.published).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${relTime(item.published)}`;
  $meta.append(src, dot, time);

  $overlay.querySelector('.modal-warning').hidden = !item.social;

  $title.textContent = item.title;

  // paragraphs: split long content into readable blocks
  $content.innerHTML = '';
  const full = (item.content || item.snippet || '').trim();
  if (full) {
    for (const para of full.split(/(?<=\.)\s+(?=[A-Z„“"])/).reduce((acc, p, i) => {
      // group every ~2 sentences into a paragraph
      const gi = Math.floor(i / 2);
      (acc[gi] = acc[gi] || []).push(p);
      return acc;
    }, []).map((g) => g.join(' '))) {
      const p = document.createElement('p');
      p.textContent = para;
      $content.append(p);
    }
  } else {
    const p = document.createElement('p');
    p.textContent = 'Full detail is available at the original source.';
    $content.append(p);
  }

  $link.href = item.url;

  $overlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $overlay.hidden = true;
  document.body.style.overflow = '';
}

$overlay.addEventListener('click', (e) => {
  if (e.target === $overlay || e.target.closest('.modal-close')) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$overlay.hidden) closeModal();
});

// ---------- dock: tabs + search dock into the navbar on scroll ----------
// Wide screens: #tabs and .search-row are moved INTO the masthead grid
// (between the logo and the theme button). ≤880px: the navstrip itself
// is sticky and docks to the masthead's bottom edge (CSS fallback).
// --dock-top feeds the sticky offset there.
const $masthead = document.querySelector('header.masthead');
const $navstrip = document.querySelector('.navstrip');
const $subnav = document.querySelector('.subnav');
const $sentinel = document.getElementById('dock-sentinel');
const $tabs = document.getElementById('tabs');
const $searchRow = document.querySelector('.search-row');
const $mastDock = document.getElementById('mast-dock');
const $catToggle = document.getElementById('cat-toggle');
const $searchToggle = document.getElementById('search-toggle');

// ---------- mobile collapsible panels (grid + magnifier icons) ----------

const syncPanelIcons = () => {
  const catOpen = document.body.classList.contains('cat-open');
  const searchOpen = document.body.classList.contains('search-open');
  $catToggle.classList.toggle('active', catOpen);
  $searchToggle.classList.toggle('active', searchOpen);
  $catToggle.setAttribute('aria-expanded', catOpen);
  $searchToggle.setAttribute('aria-expanded', searchOpen);
};

// only one panel open at a time; opening search focuses the input
const togglePanel = (cls) => {
  const nowOpen = document.body.classList.toggle(cls);
  for (const other of ['cat-open', 'search-open']) {
    if (other !== cls) document.body.classList.remove(other);
  }
  if (cls === 'search-open' && nowOpen) {
    setTimeout(() => document.getElementById('search').focus(), 80);
  }
  syncPanelIcons();
  queueDock(); // the strip's visibility is part of the dock state on mobile
  return nowOpen;
};

$catToggle.addEventListener('click', () => togglePanel('cat-open'));
$searchToggle.addEventListener('click', () => togglePanel('search-open'));

// picking a category collapses its panel again
document.getElementById('tabs').addEventListener('click', () => {
  if (document.body.classList.contains('cat-open')) {
    document.body.classList.remove('cat-open');
    syncPanelIcons();
    queueDock();
  }
});

// put the detached pieces back in their flow order
const restoreFlow = () => {
  if (!$subnav.contains($tabs)) {
    $subnav.append($tabs, $searchRow); // tabs first, search after (source order)
  }
};

let dockQueued = false;
const dockTick = () => {
  dockQueued = false;
  const mastBottom = Math.max(0, $masthead.getBoundingClientRect().bottom);
  document.documentElement.style.setProperty('--dock-top', `${mastBottom}px`);
  // sentinel sits right above the navstrip; crossed = scrolled past dock point
  const crossed = $sentinel.getBoundingClientRect().bottom < mastBottom - 2;
  const intoMast = crossed && innerWidth > 880; // keep in sync with the CSS breakpoint

  $masthead.classList.toggle('docked', crossed);
  // ≤880px fallback: the strip itself shows the docked edge styling
  $navstrip.classList.toggle('docked', crossed && !intoMast);

  if (intoMast) {
    if (!$mastDock.contains($tabs)) $mastDock.append($tabs, $searchRow);
    $navstrip.hidden = true; // collapse the emptied flow bar
  } else if (innerWidth <= 640) {
    // mobile: the strip is a collapsible panel — visible only while open
    restoreFlow();
    const open =
      document.body.classList.contains('cat-open') ||
      document.body.classList.contains('search-open');
    $navstrip.hidden = !open;
  } else {
    restoreFlow();
    $navstrip.hidden = false;
  }
};

const queueDock = () => {
  if (!dockQueued) {
    dockQueued = true;
    requestAnimationFrame(dockTick);
  }
};

addEventListener('scroll', queueDock, { passive: true });
addEventListener('resize', queueDock);
dockTick();

// ---------- data ----------

async function load() {
  try {
    const res = await fetch('/api/news');
    const news = await res.json();
    let items = news.items || [];
    if (activeCat !== 'all') items = items.filter((i) => i.category === activeCat);
    if (query) {
      const q = query.toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.snippet || '').toLowerCase().includes(q) ||
          (i.content || '').toLowerCase().includes(q)
      );
    }
    $fetchLine.textContent = news.lastFetch
      ? `${items.length} unique stories · wire updated ${relTime(news.lastFetch)}`
      : 'never fetched — press “Fetch feeds”';
    renderNews(items);
  } catch {
    $empty.hidden = false;
    $empty.textContent = 'Could not reach the server.';
  }
}

document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  activeCat = btn.dataset.cat;
  load();
});

document.getElementById('search').addEventListener('input', (e) => {
  query = e.target.value.trim();
  load();
});

$refresh.addEventListener('click', async () => {
  $refresh.classList.add('busy');
  try {
    await fetch('/api/refresh', { method: 'POST' });
    await new Promise((r) => setTimeout(r, 5000));
  } finally {
    $refresh.classList.remove('busy');
    load();
  }
});

load();
setInterval(load, 60000);
