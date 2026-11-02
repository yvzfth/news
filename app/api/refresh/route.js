// POST /api/refresh — the site's own "Fetch feeds" button (client) and
// GET /api/refresh — Vercel Cron (vercel.json) both trigger a full fetch.
import { refreshAll } from '@/src/fetcher.js';
import { bootstrapData } from '@/lib/data.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds — the full pull takes ~20-60s

export async function POST() {
  bootstrapData();
  try {
    const result = await refreshAll();
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// Vercel Cron job sends GET
export const GET = POST;
