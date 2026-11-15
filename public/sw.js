// Service worker: shows reminders and announcements as phone notifications.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let a = { title: "Wedding update", body: "Open the guide for the latest." };
    try {
      const res = await fetch("/api/latest", { cache: "no-store" });
      if (res.ok) a = await res.json();
    } catch (e) {}
    await self.registration.showNotification(a.title, {
      body: a.body, icon: "/icon-192.png", badge: "/icon-192.png", tag: "wedding-" + (a.at || Date.now())
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow("/");
  })());
});
