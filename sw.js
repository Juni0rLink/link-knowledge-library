var CACHE = 'lkl-v1';
var STATIC = [
  '/link-knowledge-library/',
  '/link-knowledge-library/index.html',
  '/link-knowledge-library/style.css',
  '/link-knowledge-library/app.js',
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
  '/link-knowledge-library/content/MAN_01201_Manual_SG12.docx'
];

// Install: cache all static assets
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(STATIC);
    }).then(function() { return self.skipWaiting(); })
  );
});

// Activate: delete old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

// Fetch: cache-first for static, network-first for Firebase/Cloudinary
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Skip non-GET and cross-origin API calls (Firebase, Cloudinary)
  if (e.request.method !== 'GET') return;
  if (url.includes('firebasedatabase.app') || url.includes('cloudinary.com') ||
      url.includes('identitytoolkit') || url.includes('officeapps.live.com')) return;

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) {
        // Serve from cache, refresh in background
        fetch(e.request).then(function(fresh) {
          caches.open(CACHE).then(function(cache){ cache.put(e.request, fresh); });
        }).catch(function(){});
        return cached;
      }
      // Not in cache: try network, cache on success
      return fetch(e.request).then(function(res) {
        if (res && res.status === 200) {
          var clone = res.clone();
          caches.open(CACHE).then(function(cache){ cache.put(e.request, clone); });
        }
        return res;
      }).catch(function() {
        // Offline fallback: return cached index.html for navigation
        if (e.request.mode === 'navigate') {
          return caches.match('/link-knowledge-library/index.html');
        }
      });
    })
  );
});
