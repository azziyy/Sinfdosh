/* ============================================================
   SERVICE WORKER — Kesh strategiyasi
   ------------------------------------------------------------
   MAQSAD:
   1) Statik fayllar (HTML struktura, CSS, JS, rasmlar) KESHLANADI
      → ilova tez ochiladi va internetsiz ham ishlaydi.
   2) Google Sheets MA'LUMOTLARI HECH QACHON keshlanmaydi (network-only)
      → yangi qo'shilgan ma'lumot bir refresh bilan darhol ko'rinadi.
   3) Kod (css/js/html) o'zgarsa → CACHE_NAME (versiya) o'zgaradi →
      eski kesh o'chiriladi → saytga qayta kirilganda YANGI versiya ko'rinadi.

   MUHIM: Kod o'zgartirilganda quyidagi CACHE_VERSION ni oshiring
   (yoki index.html / config.js dagi APP_VERSION bilan bir xil tuting).
   ============================================================ */

const CACHE_VERSION = '2.0.0';
const CACHE_NAME = `jamoa-static-${CACHE_VERSION}`;

// Oldindan keshlanadigan asosiy fayllar (ilova qobig'i / app shell)
const PRECACHE_URLS = [
  './',
  './index.html',
  './css/style.css?v=2.0.0',
  './js/config.js?v=2.0.0',
  './js/data.js?v=2.0.0',
  './js/app.js?v=2.0.0',
  './manifest.json'
];

// ====== O'RNATISH (install) ======
self.addEventListener('install', (event) => {
  // Yangi SW darhol kutmasdan faollashsin
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Ba'zi fayllar yuklanmasa ham o'rnatish buzilmasin
      Promise.allSettled(PRECACHE_URLS.map((u) => cache.add(u)))
    )
  );
});

// ====== FAOLLASHTIRISH (activate) ======
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Eski versiyali keshlarni o'chiramiz
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('jamoa-static-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      // Barcha ochiq sahifalarni darhol boshqarishni boshlaymiz
      await self.clients.claim();
    })()
  );
});

// Google Sheets (gviz) so'rovimi? — bu ma'lumot, hech qachon keshlanmaydi
function isSheetRequest(url) {
  return (
    url.hostname.includes('docs.google.com') ||
    url.pathname.includes('/gviz/tq') ||
    url.hostname.includes('googleusercontent.com')
  );
}

// ====== SO'ROVLARNI USHLASH (fetch) ======
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Faqat GET so'rovlari bilan ishlaymiz
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }

  // 1) GOOGLE SHEETS MA'LUMOTLARI → NETWORK-ONLY (hech qachon keshlanmaydi)
  //    Shu sababli yangi qo'shilgan ma'lumot doim yangi keladi.
  if (isSheetRequest(url)) {
    event.respondWith(
      fetch(req).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // 2) HTML / NAVIGATSIYA so'rovlari → NETWORK-FIRST
  //    Shunda kod o'zgarganda saytga kirilganda eng yangi HTML olinadi.
  //    Internet bo'lmasa — keshdagi nusxa ko'rsatiladi (offline ishlaydi).
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy));
          return resp;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // 3) STATIK FAYLLAR (css, js, rasm, shrift) → STALE-WHILE-REVALIDATE
  //    Keshdagi nusxa DARHOL ko'rsatiladi (tez), fonda yangisi yuklab olinadi.
  //    Shunday qilib struktura/rasmlar keshlanadi, lekin keyingi kirishda yangilanadi.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type !== 'opaque') {
            cache.put(req, resp.clone());
          }
          return resp;
        })
        .catch(() => null);
      return cached || network || new Response('', { status: 504 });
    })
  );
});

// Sahifadan kelgan "darhol yangilan" xabari (ixtiyoriy)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
