# ⚡ Pulse — Daily Tech & Hack News

A zero-dependency Node.js news site with an editorial front page. It pulls
fresh stories from around the world — **tech, hacking/cybersecurity,
software, politics, world news** — with images and a click-through detail
view. Every story appears **exactly once, ever**: automatic deduplication
means nothing is repeated day after day.

## What it pulls

| Category | Sources |
|---|---|
| Tech | TechCrunch, The Verge, Ars Technica, Wired, Hacker News front page |
| Security | The Hacker News, BleepingComputer, Krebs on Security, CSO Online |
| Software | GitHub Blog, dev.to, Stack Overflow Blog, InfoQ |
| Hacker News | 25 top stories, own tab |
| Politics | BBC Politics, NPR Politics |
| World | BBC World, Al Jazeera |
| X (Twitter) — optional | Official API v2 only: @TheHackersNews, @BBCBreaking, @LiveSquawk, @POLITICO, @WSJ |
| Releases | GitHub latest releases (node, cpython, go, rust, TypeScript, VS Code, Bun, git) + Chrome Release channels blog |

Images: feeds that carry media (BBC, The Verge, Ars Technica…) use it
directly; items without a feed image are enriched by reading the article
page's `og:image` / `twitter:image` meta tag (≈95% image coverage).
Items with no available image fall back to an elegant category-colored
placeholder.

### X / Twitter (optional, official API)

Public mirrors are permanently blocked by X's anti-bot systems, so social
pulling uses the **official X API v2** and is strictly opt-in:

1. Create an app at https://developer.x.com (read access — paid tier).
2. Start the server with a token: `X_BEARER_TOKEN=your_token npm start`
   (Windows PowerShell: `$env:X_BEARER_TOKEN="your_token"` then `npm start`).
3. Edit the followed accounts in `XFollowing` (`src/sources.js`).

⚠ **Sources on X can be misleading** — that's why every tweet pulled into
the site is explicitly labeled with a `⚠ X · Unverified` badge on cards,
an amber warning box in the detail view, and a disclaimer in the footer.
Social items are signals, not news, and never fact-checked. Without a
token the feature simply stays off and the site works normally.

## Features

- **Editorial design** — serif masthead & headlines (Fraunces + Inter),
  hero story of the day, day-grouped story grid, automatic light/dark theme
  matching your OS.
- **Detail view** — click any card for its full pulled summary in a reading
  modal, with image, source and a link to the original.
- **Refresh** — feeds re-pull every **30 minutes** in the background, the
  frontend polls every 60 s, and a manual "Refresh feeds" button hits
  `POST /api/refresh`.
- **Search** across titles and article text.

## How deduplication works

Every headline gets a deterministic key:

```
hash( normalized lowercase title[:120] + source domain )
```

That key is written to `data/seen.json` the first time the story is shown.
On every later run (today, tomorrow, next week) the fetcher drops anything
whose key is already there — so an article published once never appears
again, regardless of the day. The homepage groups the story grid by day;
"Today / Yesterday / …", all unique. Seen keys are pruned after 365 days
(configurable) so the store never grows forever.

## Run it

```bash
npm start           # starts on http://localhost:3000
```

- On boot (first run) all feeds are fetched immediately.
- Background refresh every **30 minutes**.

Manual one-off fetch (e.g. via Task Scheduler / cron):

```bash
npm run fetch
```

## API

| Endpoint | Description |
|---|---|
| `GET /api/news?category=tech\|security\|software\|politics\|world` | Stored unique stories |
| `POST /api/refresh` | Trigger a background feed refresh |

## Files

```
server.js            # HTTP server, static files, APIs, background refresh
src/sources.js       # ← all feed URLs / categories / intervals — edit freely
src/fetcher.js       # fetch, RSS/Atom parser, dedupe, image enrichment
public/              # frontend (vanilla HTML/CSS/JS)
data/
  news.json          # current unique story list (last 7 days window)
  seen.json          # every story key ever shown (the dedupe memory)
```

## Customizing

Add a feed to `src/sources.js`:

```js
{ url: 'https://example.com/rss', category: 'tech' },
```

Tune `ShowDays` (history window shown on site), `RefreshMinutes` and
`SeenMaxAgeDays` in the same file. No dependencies, no build step, no API keys.

> Note: a couple of feeds can occasionally fail or be slow — the fetcher
> isolates failures with `Promise.allSettled`, so one bad source never
> blocks the others.
