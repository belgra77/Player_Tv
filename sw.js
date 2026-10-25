// sw.js - Player_Tv service worker
const CACHE_NAME = "player-tv-v3";
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.json", "./default.m3u", "./default_es_free.m3u", "./default_iptvorg.m3u", "./default_vk.m3u", "./default_free_global.m3u", "./default_coderfast.m3u", "./default_jromero.m3u", "./default_plutoes.m3u", "./default_mx.m3u", "./default_plutomx.m3u", "./default_free_mx.m3u", "./default_free_ar.m3u", "./default_free_chile.m3u", "./default_free_peru.m3u", "./default_free_venezuela.m3u", "./default_jr_hn.m3u", "./default_plutocl.m3u", "./default_plutoar.m3u", "./default_tdt_radio.m3u", "./default_iptvorg_global.m3u"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // network-first for version check page
  if (url.pathname.endsWith("Player_Tv.html")) {
    event.respondWith(
      fetch(req, { cache: "no-store" }).catch(() => caches.match(req))
    );
    return;
  }
  // cache-first for static assets
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached);
    })
  );
});
