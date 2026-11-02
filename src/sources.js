// News source configuration.
// Add or remove RSS/Atom feeds here — the fetcher picks them up automatically.

// ---- GitHub releases for the "Releases" tab ----
// Fetched via each repo's unthrottled releases.atom feed — no REST API
// call, no GITHUB_TOKEN needed, returns the newest 10 releases per repo.
export const ReleaseRepos = [
  // Every repo here was verified live in November 2026 via its
  // releases.atom feed (which the fetcher uses — no REST API, no quota).
  // Repos that publish no releases just 404 and are skipped silently.

  // languages & runtimes
  { repo: 'nodejs/node', category: 'releases' },
  { repo: 'python/cpython', category: 'releases' },
  { repo: 'golang/go', category: 'releases' },
  { repo: 'rust-lang/rust', category: 'releases' },
  { repo: 'microsoft/TypeScript', category: 'releases' },
  { repo: 'denoland/deno', category: 'releases' },
  { repo: 'oven-sh/bun', category: 'releases' },
  { repo: 'dart-lang/sdk', category: 'releases' },
  { repo: 'git/git', category: 'releases' },
  { repo: 'gcc-mirror/gcc', category: 'releases' },
  { repo: 'ziglang/zig', category: 'releases' },
  { repo: 'curl/curl', category: 'releases' },
  { repo: 'dotnet/runtime', category: 'releases' },

  // web frameworks & libraries
  { repo: 'facebook/react', category: 'releases' },
  { repo: 'vuejs/core', category: 'releases' },
  { repo: 'sveltejs/kit', category: 'releases' },
  { repo: 'solidjs/solid', category: 'releases' },
  { repo: 'withastro/astro', category: 'releases' },
  { repo: 'vercel/next.js', category: 'releases' },
  { repo: 'nestjs/nest', category: 'releases' },
  { repo: 'expo/expo', category: 'releases' },
  { repo: 'django/django', category: 'releases' },
  { repo: 'bigskysoftware/htmx', category: 'releases' },
  { repo: 'tailwindlabs/tailwindcss', category: 'releases' },
  { repo: 'twbs/bootstrap', category: 'releases' },
  { repo: 'evanw/esbuild', category: 'releases' },
  { repo: 'swc-project/swc', category: 'releases' },
  { repo: 'vitejs/vite', category: 'releases' },
  { repo: 'vitest-dev/vitest', category: 'releases' },

  // editors, shells & desktop tools
  { repo: 'microsoft/vscode', category: 'releases' },
  { repo: 'neovim/neovim', category: 'releases' },
  { repo: 'alacritty/alacritty', category: 'releases' },
  { repo: 'fish-shell/fish-shell', category: 'releases' },
  { repo: 'microsoft/PowerToys', category: 'releases' },
  { repo: 'obsproject/obs-studio', category: 'releases' },
  { repo: 'audacity/audacity', category: 'releases' },
  { repo: 'immich-app/immich', category: 'releases' },

  // desktop / server software
  { repo: 'nextcloud/server', category: 'releases' },
  { repo: 'jellyfin/jellyfin', category: 'releases' },
  { repo: 'home-assistant/core', category: 'releases' },
  { repo: 'keepassxreboot/keepassxc', category: 'releases' },
  { repo: 'bitwarden/clients', category: 'releases' },
  { repo: 'syncthing/syncthing', category: 'releases' },
  { repo: 'rclone/rclone', category: 'releases' },
  { repo: 'yt-dlp/yt-dlp', category: 'releases' },
  { repo: 'ollama/ollama', category: 'releases' },
  { repo: 'n8n-io/n8n', category: 'releases' },
  { repo: 'opencv/opencv', category: 'releases' },
  { repo: 'tesseract-ocr/tesseract', category: 'releases' },

  // AI / ML
  { repo: 'tensorflow/tensorflow', category: 'releases' },
  { repo: 'langchain-ai/langchain', category: 'releases' },
  { repo: 'gradio-app/gradio', category: 'releases', limit: 2 },
  { repo: 'anthropics/claude-code', category: 'releases', limit: 1 },
  { repo: 'openai/codex', category: 'releases', limit: 1 },

  // package managers & linters
  { repo: 'pnpm/pnpm', category: 'releases' },
  { repo: 'astral-sh/uv', category: 'releases' },
  { repo: 'npm/cli', category: 'releases' },
  { repo: 'eslint/eslint', category: 'releases' },
  { repo: 'prettier/prettier', category: 'releases' },

  // mobile & cross-platform
  { repo: 'flutter/flutter', category: 'releases' },
  { repo: 'godotengine/godot', category: 'releases' },
  { repo: 'tauri-apps/tauri', category: 'releases' },
  { repo: 'electron/electron', category: 'releases' },

  // infra, containers & databases
  { repo: 'redis/redis', category: 'releases' },
  { repo: 'prometheus/prometheus', category: 'releases' },
  { repo: 'containerd/containerd', category: 'releases' },
  { repo: 'moby/moby', category: 'releases' },
  { repo: 'kubernetes/kubernetes', category: 'releases' },
  { repo: 'k3s-io/k3s', category: 'releases' },
  { repo: 'helm/helm', category: 'releases' },
  { repo: 'argoproj/argo-cd', category: 'releases' },
  { repo: 'hashicorp/terraform', category: 'releases' },
  { repo: 'hashicorp/vault', category: 'releases' },
  { repo: 'hashicorp/consul', category: 'releases' },
  { repo: 'NixOS/nix', category: 'releases' },

  // security & networking
  { repo: 'caddyserver/caddy', category: 'releases' },
  { repo: 'traefik/traefik', category: 'releases' },
  { repo: 'grafana/grafana', category: 'releases' },
  { repo: 'juanfont/headscale', category: 'releases' },
];

export const Feeds = [
  // ---- Tech ----
  { url: 'https://techcrunch.com/feed/', category: 'tech' },
  { url: 'https://www.theverge.com/rss/index.xml', category: 'tech' },
  { url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tech' },
  { url: 'https://www.wired.com/feed/rss', category: 'tech' },

  // ---- Security / Hacking ----
  { url: 'https://feeds.feedburner.com/TheHackersNews', category: 'security' },
  { url: 'https://www.bleepingcomputer.com/feed/', category: 'security' },
  { url: 'https://krebsonsecurity.com/feed/', category: 'security' },
  { url: 'https://www.csoonline.com/feed/', category: 'security' },

// ---- Software ----
  { url: 'https://github.blog/feed/', category: 'software' },
  { url: 'https://dev.to/feed/', category: 'software' },
  { url: 'https://stackoverflow.blog/feed/', category: 'software' },
  { url: 'https://feed.infoq.com/', category: 'software' },

  // ---- Releases / channel logs (limited per feed so one channel
  //      can't flood the section) ----
  // NOTE: all of these were live-verified in November 2026.
  // v8.dev has no RSS feed anymore (404 on /feed.xml, /rss.xml, /_rss.xml)
  // and firefox's old /en/firefox/feed/ path is 404 — replaced with the
  // category feed below.

  // browsers
  { url: 'https://chromereleases.googleblog.com/feeds/posts/default?alt=rss', category: 'releases', label: 'Chrome Releases', limit: 3 },
  { url: 'https://blog.mozilla.org/en/category/firefox/feed/', category: 'releases', label: 'Firefox', limit: 3 },
  { url: 'https://blogs.windows.com/msedgedev/feed/', category: 'releases', label: 'Edge Dev', limit: 3 },
  { url: 'https://webkit.org/feed/', category: 'releases', label: 'Safari / WebKit', limit: 3 },
  { url: 'https://blog.thunderbird.net/feed/', category: 'releases', label: 'Thunderbird', limit: 3 },

  // languages & runtimes
  { url: 'https://nodejs.org/en/feed/releases.xml', category: 'releases', label: 'Node.js Releases', limit: 3 },
  { url: 'https://pythoninsider.blogspot.com/feeds/posts/default?alt=rss', category: 'releases', label: 'Python Releases', limit: 3 },
  { url: 'https://go.dev/blog/feed.atom', category: 'releases', label: 'Go', limit: 3 },
  { url: 'https://blog.rust-lang.org/feed.xml', category: 'releases', label: 'Rust', limit: 3 },
  { url: 'https://devblogs.microsoft.com/dotnet/feed/', category: 'releases', label: '.NET Blog', limit: 3 },

  // web frameworks
  { url: 'https://react.dev/rss.xml', category: 'releases', label: 'React', limit: 3 },
  { url: 'https://vite.dev/blog.rss', category: 'releases', label: 'Vite', limit: 3 },
  { url: 'https://svelte.dev/blog/rss.xml', category: 'releases', label: 'Svelte', limit: 3 },
  { url: 'https://blog.angular.dev/feed', category: 'releases', label: 'Angular', limit: 3 },

  // platforms, infra & distros
  { url: 'https://github.blog/changelog/feed/', category: 'releases', label: 'GitHub Changelog', limit: 5 },
  { url: 'https://kubernetes.io/feed.xml', category: 'releases', label: 'Kubernetes', limit: 3 },
  { url: 'https://www.postgresql.org/news.rss', category: 'releases', label: 'PostgreSQL', limit: 3 },
  { url: 'https://www.docker.com/blog/feed/', category: 'releases', label: 'Docker', limit: 3 },
  { url: 'https://fedoramagazine.org/feed/', category: 'releases', label: 'Fedora', limit: 3 },
  { url: 'https://archlinux.org/feeds/news/', category: 'releases', label: 'Arch Linux', limit: 3 },

  // ---- New product launches ----
  { url: 'https://www.producthunt.com/feed', category: 'releases', label: 'Product Hunt', limit: 10 },
  { url: 'https://distrowatch.com/news/dw.xml', category: 'releases', label: 'DistroWatch', limit: 5 },

  // ---- Politics ----
  { url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', category: 'politics' },
  { url: 'https://feeds.npr.org/1014/rss.xml', category: 'politics' },

  // ---- World ----
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'world' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'world' },
];

// Hacker News front page (via API, no key required) — its own category tab
export const HN = {
  top: 'https://hacker-news.firebaseio.com/v0/topstories.json',
  item: 'https://hacker-news.firebaseio.com/v0/item',
  limit: 25,
  category: 'hn',
};

// ---------------------------------------------------------------------------
// Social (X / Twitter) — OFFICIAL API ONLY, and items are flagged UNVERIFIED.
//
// Reality check (Nov 2026): every public mirror is blocked by X's anti-bot
// systems — Nitter mirrors are dead/403/PoW-gated, RSSHub routes return 4xx.
// The only reliable route is the official X API v2:
//   1. create an app at https://developer.x.com (read access, paid tier)
//   2. start the server with  X_BEARER_TOKEN=<your token>  set as an env var
// No token → these feeds are skipped gracefully, everything else keeps flowing.
//
// ⚠ Heed the warning: tweets are unverified social posts and can be
// misleading — the UI labels them clearly and they are never "news".
// ---------------------------------------------------------------------------
export const XBearer = process.env.X_BEARER_TOKEN || '';

export const XFollowing = [
  { handle: 'TheHackersNews', category: 'security' },
  { handle: 'BBCBreaking', category: 'world' },
  { handle: 'LiveSquawk', category: 'world' },
  { handle: 'POLITICO', category: 'politics' },
  { handle: 'WSJ', category: 'world' },
];

// How long a "seen" story stays marked as duplicate (in days).
// Stories matched here are never re-shown, even on later days.
export const SeenMaxAgeDays = 365;

// How many days of news to show on the site.
export const ShowDays = 7;

// How long fetched/stale data is kept before a background refresh (minutes).
export const RefreshMinutes = 30;
