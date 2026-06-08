// Cache version — update this string on every deploy to bust all caches
// GitHub Pages serves this file fresh (no-cache headers), so any change here
// triggers a new SW installation and clears all old caches automatically.
var CACHE = 'lkl-20260608-007';

// Files that should ALWAYS be fresh from network (core app)
var NETWORK_FIRST = [
  '/link-knowledge-library/',
  '/link-knowledge-library/index.html',
  '/link-knowledge-library/app.js',
  '/link-knowledge-library/style.css',
];

// Files that can be cached (large static docs, rarely change)
var CACHE_FIRST = [
  '/link-knowledge-library/logo.jpg',
  '/link-knowledge-library/search-index.json',
  '/link-knowledge-library/content/GSC Software structure.pptx',
  '/link-knowledge-library/content/GSC Module Phase concept.pptx',
  '/link-knowledge-library/content/GSC Module Safety.pptx',
  '/link-knowledge-library/content/GSC Module SAS.pptx',
  '/link-knowledge-library/content/GSC Module User sequence.pptx',
  '/link-knowledge-library/content/GSC Type management.pptx',
  '/link-knowledge-library/content/MAN_00101_Manual_Cover.docx',
  '/link-knowledge-library/content/MAN_00201_Manual_General.docx',
  '/link-knowledge-library/content/MAN_00301_Manual_LINE.docx',
  '/link-knowledge-library/content/MAN_00401_Manual_PLC.docx',
  '/link-knowledge-library/content/MAN_00501_Manual_SG01.docx',
  '/link-knowledge-library/content/MAN_00601_Manual_SG02.docx',
  '/link-knowledge-library/content/MAN_00602_Manual_SG04.docx',
  '/link-knowledge-library/content/MAN_00603_Manual_SG06.docx',
  '/link-knowledge-library/content/MAN_00701_Manual_SG03.docx',
  '/link-knowledge-library/content/MAN_00702_Manual_SG05.docx',
  '/link-knowledge-library/content/MAN_00703_Manual_SG07.docx',
  '/link-knowledge-library/content/MAN_00801_Manual_SG08.docx',
  '/link-knowledge-library/content/MAN_00901_Manual_SG09.docx',
  '/link-knowledge-library/content/MAN_01001_Manual_SG10.docx',
  '/link-knowledge-library/content/MAN_01101_Manual_SG11.docx',
  '/link-knowledge-library/content/MAN_01201_Manual_SG12.docx',
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(CACHE_FIRST);
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    // Delete ALL old caches
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  if (e.request.method !== 'GET') return;

  // Skip Firebase, Cloudinary, external APIs
  if (url.includes('firebasedatabase.app') || url.includes('cloudinary.com') ||
      url.includes('identitytoolkit') || url.includes('officeapps.live.com') ||
      url.includes('openrouter.ai') || url.includes('anthropic.com') ||
      url.includes('openai.com') || url.includes('googleapis.com/v1beta')) return;

  // NETWORK-FIRST for HTML, JS, CSS — always get latest
  var isNetworkFirst = NETWORK_FIRST.some(function(p) { return url.includes(p); });
  if (isNetworkFirst) {
    e.respondWith(
      fetch(e.request).then(function(res) {
        if (res && res.status === 200) {
          var clone = res.clone();
          caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
        }
        return res;
      }).catch(function() {
        // Offline fallback: serve from cache
        return caches.match(e.request).then(function(cached) {
          return cached || caches.match('/link-knowledge-library/index.html');
        });
      })
    );
    return;
  }

  // CACHE-FIRST for static docs — serve from cache, refresh in background
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var networkFetch = fetch(e.request).then(function(res) {
        if (res && res.status === 200) {
          var clone = res.clone();
          caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
        }
        return res;
      }).catch(function() {});
      return cached || networkFetch;
    })
  );
});
