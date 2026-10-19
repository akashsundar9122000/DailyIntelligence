/*
 * The service worker. It does two things and nothing else: show a
 * notification the server pushed, and open the page it points to when it is
 * tapped. No caching, no offline copy: a cached edition is yesterday's news
 * presented as today's, and this paper never does that.
 *
 * The payload is our own JSON: { title, body, url, tag }. A url that does not
 * resolve to this site is ignored, so a forged push could not send a reader
 * elsewhere.
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" ? data.title : "Daily news update";
  // Resolved and compared by origin: a prefix test passes "/\\elsewhere.example", which a browser reads as another site.
  let url = "/app";
  try {
    const resolved = typeof data.url === "string" ? new URL(data.url, self.location.origin) : null;
    if (resolved && resolved.origin === self.location.origin) url = resolved.pathname + resolved.search;
  } catch {
    url = "/app";
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      icon: "/brand/icon-192-v1.png",
      badge: "/brand/icon-192-v1.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : "/app", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
