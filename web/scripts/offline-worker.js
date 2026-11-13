const scope = new URL(self.registration.scope);
const cachePrefix = `qrmagic-release:${scope.pathname}:`;
const releaseCache = cachePrefix + RELEASE;
const index = new URL("index.html", scope);
const assets = new Map(ASSETS.map(([path, integrity]) => [new URL(path, scope).href, integrity]));

self.addEventListener("install", event => {
  // Cache one complete release. Integrity checks prevent a partial Pages
  // deployment or a stale HTTP cache from mixing files from different builds.
  const requests = [...assets].map(([url, integrity]) => new Request(url, { cache: "reload", integrity }));
  event.waitUntil(caches.open(releaseCache).then(cache => cache.addAll(requests)));
});

self.addEventListener("activate", event => {
  // Let the browser wait for the old app's clients to close before replacing
  // their release. They may still need lazy chunks from that version.
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== releaseCache)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin) return;
  const appNavigation = request.mode === "navigate" &&
    (url.pathname === scope.pathname || url.pathname === index.pathname);
  if (!appNavigation && !assets.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(releaseCache);
    // These are byte-verified static files. An asset cached without an Origin
    // header is also the right response for a module request with one.
    return await cache.match(appNavigation ? index.href : url.href, { ignoreVary: true }) ?? fetch(request);
  })());
});
