/*
 * Service worker mínimo de Tallerista: existe para que el celular ofrezca
 * instalarla como app. A propósito NO guarda nada en caché: cada pedido va a
 * la red como siempre, así nunca queda una versión vieja del sistema pegada.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Sin respondWith: el navegador resuelve el pedido normalmente.
});
