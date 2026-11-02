// GET /api/news — the aggregated, deduplicated feed data.
import { readNews, refreshAll } from '@/src/fetcher.js';
import { bootstrapData } from '@/lib/data.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  bootstrapData();
  const { searchParams } = new URL(req.url);

  // the very first request of a cold instance would otherwise be empty —
  // warm it up once in the background (fire-and-forget)
  const news = readNews();
  if (!news.items.length && typeof refreshAll === 'function' && !globalThis.__pulseWarming) {
    globalThis.__pulseWarming = true;
    refreshAll().catch(() => {});
  }

  const category = searchParams.get('category');
  const items = category
    ? news.items.filter((i) => i.category === category)
    : news.items;

  return Response.json({ lastFetch: news.lastFetch, items });
}
