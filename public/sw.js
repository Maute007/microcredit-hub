// Cache apenas assets estáticos do próprio domínio.
// NUNCA cachear API/auth — isso causa "default" intermitente e configs antigas.
const CACHE_NAME = "microcredit-hub-v3";
const CORE_ASSETS = ["/", "/manifest.webmanifest", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  // Em dev (localhost), um SW antigo pode quebrar o Vite (HMR/WebSocket) e servir
  // assets antigos. Auto-desregistrar para evitar loops e erros de preamble.
  if (self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1") {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        await self.registration.unregister();
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        clients.forEach((c) => c.navigate(c.url));
      })(),
    );
    return;
  }

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Só cacheamos pedidos do mesmo origin (evita cache acidental do backend em dev).
  if (url.origin !== self.location.origin) return;

  // Nunca cachear API/auth (JSON/configs/tokens).
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  // Nunca cachear endpoints do Vite/React Refresh.
  if (url.pathname.startsWith("/@vite/") || url.pathname.startsWith("/@react-refresh")) return;

  // Navegação: network-first para evitar HTML antigo; fallback para "/" em offline.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/")),
    );
    return;
  }

  // Assets: cache-first.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Só guardar respostas válidas.
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    }),
  );
});
