// Server-side data bootstrap.
//
// On Vercel the filesystem is read-only except /tmp, and each serverless
// instance gets its own empty one. On the first request of an instance we
// copy the bundled seed JSON (data/news.json, data/seen.json from the repo
// at build time) into the instance's data dir, so /api/news always answers
// with at least the last deploy's snapshot. refreshAll() then keeps that
// instance's copy hot — refreshes write to /tmp only (not-shared, by
// design on serverless).
import fs from 'node:fs';
import { DATA_DIR, NEWS_FILE, SEEN_FILE } from '../src/fetcher.js';
import seedNews from '../data/news.json';
import seedSeen from '../data/seen.json';

let bootstrapped = false;

export function bootstrapData() {
  if (bootstrapped) return;
  bootstrapped = true;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(NEWS_FILE)) {
      fs.writeFileSync(NEWS_FILE, JSON.stringify(seedNews));
    }
    if (!fs.existsSync(SEEN_FILE)) {
      fs.writeFileSync(SEEN_FILE, JSON.stringify(seedSeen));
    }
  } catch (e) {
    console.error('data bootstrap failed:', e.message);
  }
}
