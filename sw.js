/* Life Dashboard – Service Worker: App-Dateien offline verfügbar, Briefing immer frisch */
const CACHE = "ld-v1.0.2";
const SHELL = ["./", "index.html", "manifest.json", "config.js", "core.js", "charts.js", "connect.js", "settings.js", "view-today.js", "view-uni.js", "view-money.js", "view-train.js", "view-body.js", "main.js", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("news.json")) return;
  // Netz zuerst, damit Updates sofort ankommen; ohne Netz aus dem Cache
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
