// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // IMPORTANT: do NOT use `output: "export"` for this app
  // (Dashboard + API routes need a server runtime)
  reactStrictMode: true,
};

export default nextConfig;