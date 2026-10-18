const CACHE_NAME = "maalamati-shell-v6";
const APP_SHELL = ["/", "/offline.html", "/manifest.webmanifest", "/favicon.ico", "/manus-storage/maalamati-care-icon-192_6fc97013.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => (await caches.match("/")) || (await caches.match("/offline.html")))
    );
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() ?? { title: "معاملاتي كير", body: "لديك تحديث جديد." };
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/manus-storage/maalamati-care-icon-192_6fc97013.png",
    badge: "/manus-storage/maalamati-care-icon-64_24a83194.png",
    data: { url: payload.url || "/dashboard" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/dashboard"));
});
