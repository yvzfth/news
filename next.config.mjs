/** @type {import('next').NextConfig} */
const nextConfig = {
  // data persistence: on Vercel the filesystem is read-only except /tmp —
  // the seed JSON files get copied there on first request (see lib/data.js).
};

export default nextConfig;
