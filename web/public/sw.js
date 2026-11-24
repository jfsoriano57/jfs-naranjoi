// Service Worker básico para PWA y soporte offline de activos estáticos
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Manejo de peticiones de red
});
