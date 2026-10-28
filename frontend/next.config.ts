import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // One id per deployment: names the service worker caches and lets open tabs detect updates.
    NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? String(Date.now()),
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
