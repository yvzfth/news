// entry point duplicate of refreshAll for manual CLI use: `npm run fetch`
import { refreshAll } from './src/fetcher.js';

try {
  const res = await refreshAll();
  console.log(`✔ Fetched ${res.fresh} new stories (${res.total} total).`);
  process.exit(0);
} catch (e) {
  console.error('✖ Fetch failed:', e);
  process.exit(1);
}
