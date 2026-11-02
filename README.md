# Pulse — Tech, Hacking & Software Daily

Personal news aggregator: 100+ sources (RSS/Atom feeds, GitHub releases,
Hacker News, optional X via official API), fetched, deduplicated and shown
in a single editorial page — built with **Next.js (App Router)** so it can
be deployed straight to Vercel with server-side API routes.

## Pages & routes

- `/` — the site (client component); polls `/api/news` every 60 s
- `GET /api/news` — aggregated + deduplicated feed data
- `POST /api/refresh` — the site's own "Fetch feeds" button; pulls all feeds
- `GET /api/refresh` — same endpoint; Vercel Cron (see `vercel.json`) hits it daily

## How it works

- `src/fetcher.js` — zero-dependency fetching/parse/dedupe/persistence
- `src/sources.js` — all feed URLs + configs (edit here to add channels)
- `lib/data.js` — server-side data bootstrap (Vercel `/tmp` seeding)
- `data/*.json` — built-in seed snapshot, committed to the repo

## Layout (responsive)

- Desktop ≥881px: scrolling docks the tabs + fetch + search INSIDE the
  navbar, between the logo and the theme button
- Tablet ≤880px: the strip sticky-docks under the navbar
- Mobile ≤640px: one-line navbar — grid icon (categories) and magnifier
  (search) toggle collapsible panels
- Light / full-black dark themes, manual toggle

## Dev

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
npm run fetch    # one manual pull without the server
```

## Deploy (Vercel)

Import the repo in Vercel — no env vars required. Note: on serverless the
filesystem is read-only, so live data lives in `/tmp` per instance; the repo
snapshot is the cold-start fallback and a daily Cron refreshes instances.
For a persistent instance with a real background refresher, run
`node server.js`-style plain Node on Render/Railway/Fly instead.
