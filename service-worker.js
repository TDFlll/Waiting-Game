const SW_VERSION = "2026.10.21-line-v1";
const ACTIVE_CACHE = `waiting-game-assets-${SW_VERSION}`;
const TEMP_CACHE = `waiting-game-temp-${SW_VERSION}`;
const CORE_URLS = [
  "./",
  "index.html",
  "offline.html",
  "offline-manager.js",
  "offline-manifest.json",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/maskable.svg"
];

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

function normalizeRequestUrl(input) {
  const url = new URL(input, self.location.href);
  url.hash = "";
  return url.href;
}

async function cacheAllAtomically(urls) {
  const unique = [...new Set(urls.map(normalizeRequestUrl))];
  await caches.delete(TEMP_CACHE);
  const freshTemp = await caches.open(TEMP_CACHE);
  let done = 0;

  for (const url of unique) {
    const response = await fetch(url, { cache: "reload", credentials: "same-origin" });
    if (!response.ok) {
      throw new Error(`${new URL(url).pathname} ${response.status}`);
    }
    await freshTemp.put(url, response.clone());
    done++;
    broadcast({ type: "CACHE_PROGRESS", done, total: unique.length, url });
  }

  const active = await caches.open(ACTIVE_CACHE);
  for (const url of unique) {
    const response = await freshTemp.match(url);
    if (!response) throw new Error(`${new URL(url).pathname} missing after download`);
    await active.put(url, response);
  }
  await caches.delete(TEMP_CACHE);
  return { done, total: unique.length };
}

async function broadcast(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  clients.forEach(client => client.postMessage(message));
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(ACTIVE_CACHE);
    await cache.addAll(CORE_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("waiting-game-temp-")).map(key => caches.delete(key)));
  })());
});

self.addEventListener("message", event => {
  const data = event.data || {};
  if (data.type === "CACHE_URLS") {
    event.waitUntil((async () => {
      try {
        const result = await cacheAllAtomically(data.urls || []);
        event.source && event.source.postMessage({ type: "CACHE_DONE", requestId: data.requestId, ...result });
      } catch (error) {
        await caches.delete(TEMP_CACHE);
        event.source && event.source.postMessage({ type: "CACHE_ERROR", requestId: data.requestId, message: error.message || String(error) });
      }
    })());
  }
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (!sameOrigin(url)) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(ACTIVE_CACHE);
        cache.put(request, response.clone());
        return response;
      } catch (error) {
        return (await caches.match(request)) ||
          (await caches.match("index.html")) ||
          (await caches.match("offline.html"));
      }
    })());
    return;
  }

  if (url.pathname.endsWith("/offline-manifest.json")) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: "no-store" });
        const cache = await caches.open(ACTIVE_CACHE);
        cache.put(request, response.clone());
        return response;
      } catch (error) {
        return (await caches.match(request)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(ACTIVE_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return (await caches.match("offline.html")) || Response.error();
    }
  })());
});
