/* PHC37 PWA — Service Worker (PHC37-PWA-1.5.0)
 * - ไฟล์ของแอพ: ดึงจากเน็ตก่อนและตรวจกับเซิร์ฟเวอร์ทุกครั้ง (ได้เวอร์ชันล่าสุดเสมอ) ถ้าออฟไลน์ใช้ของที่เก็บไว้
 * - ฟอนต์ Google: ใช้ของที่เก็บไว้ก่อน
 * - API (script.google.com) และข้อมูลอื่น: ไม่เก็บเลย
 */
var CACHE = 'phc37-shell-v1.5.0';
var FONT_CACHE = 'phc37-fonts-v1';
var SHELL = [
  './', './index.html', './styles.css', './app.js', './admin.js', './public.js', './config.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== FONT_CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; });
      });
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // cache: 'no-cache' = ถามเซิร์ฟเวอร์ทุกครั้งว่าไฟล์เปลี่ยนไหม (ไม่ใช้ไฟล์เก่าที่เบราว์เซอร์จำไว้ 10 นาทีของ GitHub Pages)
  e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
    if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) {
      return hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
    });
  }));
});
