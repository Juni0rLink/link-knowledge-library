// LINK Knowledge Library — Service Worker
// Cache các file tĩnh để dùng offline

var CACHE_NAME = 'lkl-v1.3';
var STATIC_FILES = [
  '/link-knowledge-library/',
  '/link-knowledge-library/index.html',
  '/link-knowledge-library/app.js',
  '/link-knowledge-library/style.css',
  '/link-knowledge-library/logo.jpg',
  '/link-knowledge-library/search-index.json',
  '/link-knowledge-library/manifest.json'
];

// Cài đặt: cache tất cả file tĩnh
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_FILES);
    })
  );
  self.skipWaiting();
});

// Kích hoạt: xóa cache cũ
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Cache First cho file tĩnh, Network First cho Firebase
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Firebase & API → luôn lấy từ network
  if (url.includes('firebasedatabase') ||
      url.includes('identitytoolkit') ||
      url.includes('cloudinary') ||
      url.includes('api.anthropic') ||
      url.includes('officeapps.live')) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // File tĩnh → Cache First, fallback network
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(response) {
        // Cache các file mới tải về
        if (response.ok && e.request.method === 'GET') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Offline fallback
        return caches.match('/link-knowledge-library/index.html');
      });
    })
  );
});
