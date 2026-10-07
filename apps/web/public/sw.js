const SHELL = "lifesync-shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(["/offline", "/icons/icon.svg", "/manifest.webmanifest"])),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith("lifesync-shell-") && key !== SHELL).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/offline")));
    return;
  }
  if (/\.(js|css|woff2|png|svg)$/.test(url.pathname))
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok && response.type === "basic") {
              const copy = response.clone();
              void caches.open(SHELL).then((cache) => cache.put(event.request, copy));
            }
            return response;
          }),
      ),
    );
});
self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data?.json();
  } catch {
    data = {};
  }
  const url =
    typeof data?.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//")
      ? data.url
      : "/notifications";
  event.waitUntil(
    self.registration.showNotification("LifeSync", {
      body: "LifeSync",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data?.id,
      data: { url },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || "/notifications"));
});
