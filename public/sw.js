/**
 * Balansa service worker (PWA).
 *
 * Konservativ strategiya — deploy'larni buzmaslik uchun:
 *  - Navigatsiya (HTML): DOIM tarmoqdan; tarmoq yo'q bo'lsa /offline sahifasi.
 *  - /_next/static (immutable, hash'langan): keshdan, bo'lmasa tarmoqdan keshga.
 *  - API va boshqa hamma narsa: service worker aralashmaydi.
 *
 * KESH_VERSIYA oshirilsa eski keshlar activate'da tozalanadi.
 */
const KESH_VERSIYA = "balansa-v1";
const OLDINDAN = ["/offline", "/favicon-256.png", "/logo-icon-512.png", "/favicon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(KESH_VERSIYA)
      .then((kesh) => kesh.addAll(OLDINDAN))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomlar) => Promise.all(nomlar.filter((n) => n !== KESH_VERSIYA).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const soralgan = e.request;
  if (soralgan.method !== "GET") return;

  const url = new URL(soralgan.url);
  if (url.origin !== self.location.origin) return;

  // API'ga hech qachon aralashmaymiz — moliyaviy ma'lumot doim yangi bo'lishi shart.
  if (url.pathname.startsWith("/api/")) return;

  // Sahifa navigatsiyasi: tarmoq birinchi, uzilganda offline sahifa.
  if (soralgan.mode === "navigate") {
    e.respondWith(
      fetch(soralgan).catch(() =>
        caches.match("/offline").then((c) => c ?? Response.error())
      )
    );
    return;
  }

  // Hash'langan statik fayllar va ikonkalar: kesh birinchi.
  const statik =
    url.pathname.startsWith("/_next/static/") ||
    OLDINDAN.includes(url.pathname);
  if (statik) {
    e.respondWith(
      caches.match(soralgan).then(
        (c) =>
          c ??
          fetch(soralgan).then((javob) => {
            if (javob.ok) {
              const nusxa = javob.clone();
              caches.open(KESH_VERSIYA).then((kesh) => kesh.put(soralgan, nusxa));
            }
            return javob;
          })
      )
    );
  }
});
