// Pulse News — zero-dependency server.
// Serves the static frontend plus JSON APIs, and refreshes feeds in the
// background every `RefreshMinutes`.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { refreshAll, readNews } from './src/fetcher.js';
import { RefreshMinutes } from './src/sources.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ensure fresh data on boot, then schedule background refetch
let fetching = false;
const maybeRefresh = async () => {
  if (fetching) return;
  fetching = true;
  try {
    await refreshAll();
    console.log(`[${new Date().toISOString()}] data refreshed`);
  } catch (e) {
    console.error('refresh failed:', e.message);
  } finally {
    fetching = false;
  }
};

await maybeRefresh();
setInterval(maybeRefresh, RefreshMinutes * 60 * 1000);

const sendJson = (res, code, body) => {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
};

const serveStatic = (res, file) => {
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(full)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(full).pipe(res);
};

const server = http.createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url, 'http://x');

  if (pathname === '/api/news') {
    const category = searchParams.get('category');
    const news = readNews();
    const items = category
      ? news.items.filter((i) => i.category === category)
      : news.items;
    return sendJson(res, 200, { lastFetch: news.lastFetch, items });
  }

  if (pathname === '/api/refresh' && (req.method === 'POST' || req.method === 'GET')) {
    if (fetching) return sendJson(res, 202, { status: 'already running' });
    maybeRefresh(); // respond immediately, refresh happens in background
    return sendJson(res, 202, { status: 'refresh started' });
  }

  if (pathname === '/' || pathname === '/index.html') return serveStatic(res, 'index.html');
  if (pathname.startsWith('/assets/')) return serveStatic(res, pathname.slice(1));

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Pulse News running → http://localhost:${PORT}`);
});
