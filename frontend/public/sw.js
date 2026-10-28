/* HoloLedger service worker: offline app shell + last known API answers. */

// Registered as /sw.js?v=<deployment id>: a new deployment installs a new worker and
// the activate step below drops the previous deployment's caches.
const VERSION = new URL(self.location.href).searchParams.get("v") || "v1";
const SHELL_CACHE = `holoLedger-shell-${VERSION}`;
const STATIC_CACHE = `holoLedger-static-${VERSION}`;
const API_CACHE = "holoLedger-api"; // also cleared by the app on logout

const SHELL_PAGES = [
  "/",
  "/login",
  "/dashboard",
  "/transactions",
  "/transactions/new",
  "/reports",
  "/more",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_PAGES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, STATIC_CACHE, API_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = (await cache.match(request)) || (fallbackUrl && (await caches.match(fallbackUrl)));
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(STATIC_CACHE)).put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // writes are queued by the app itself
  const url = new URL(request.url);

  if (url.pathname.includes("/api/")) {
    if (url.pathname.includes("/export/")) return;
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Dynamic routes (e.g. /transactions/<id>/edit) fall back to the app entry point.
    event.respondWith(networkFirst(request, SHELL_CACHE, "/"));
  } else if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});
