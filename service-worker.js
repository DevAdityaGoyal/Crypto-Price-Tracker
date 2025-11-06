<<<<<<< HEAD
/* PWA Service Worker
 * - CacheFirst for static assets
 * - Stale-While-Revalidate for API with short TTL
 * - Offline banner is handled by app (listens to online/offline)
 */
const STATIC_CACHE = 'static-v1';
const RUNTIME_CACHE = 'runtime-v1';
const API_TTL_MS = 2 * 60 * 1000; // 2 minutes

const STATIC_ASSETS = [
  './',
  './index.html',
  './styles/base.css',
  './styles/theme.css',
  './styles/table.css',
  './styles/components.css',
  './js/main.js',
  './js/api.js',
  './js/utils.js',
  './js/state.js',
  './js/ui-table.js',
  './js/ui-detail.js',
  './js/ui-toasts.js',
  './js/charts.js',
  './js/pwa.js',
  './assets/logo.svg',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k)).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only GET
  if(event.request.method !== 'GET') return;

  // API runtime cache with SWR
  if(url.origin === 'https://api.coingecko.com'){
    event.respondWith(apiSWR(event.request));
    return;
  }

  // Static assets cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(res => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then(cache => cache.put(event.request, copy));
        return res;
      }).catch(()=> cached); // offline fallback
    })
  );
});

async function apiSWR(request){
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const now = Date.now();

  if(cached){
    const ts = Number(cached.headers.get('x-sw-ts') || 0);
    // serve cached immediately
    const resp = cached;
    // revalidate in background if stale
    if(now - ts > API_TTL_MS){
      revalidate(request, cache);
    }
    return resp;
  } else {
    try{
      const res = await fetch(request);
      const wrapped = await withTimestamp(res);
      cache.put(request, wrapped.clone());
      return wrapped;
    }catch(e){
      // offline and no cache: return a synthetic empty response
      return new Response(JSON.stringify([]), { headers: { 'content-type':'application/json' }, status: 200 });
    }
  }
}

function revalidate(request, cache){
  fetch(request).then(res => withTimestamp(res)).then(resp => cache.put(request, resp)).catch(()=>{});
}

async function withTimestamp(res){
  const body = await res.clone().arrayBuffer();
  const headers = new Headers(res.headers);
  headers.set('x-sw-ts', String(Date.now()));
  return new Response(body, { status: res.status, statusText: res.statusText, headers });
}
=======
/* PWA Service Worker
 * - CacheFirst for static assets
 * - Stale-While-Revalidate for API with short TTL
 * - Offline banner is handled by app (listens to online/offline)
 */
const STATIC_CACHE = 'static-v1';
const RUNTIME_CACHE = 'runtime-v1';
const API_TTL_MS = 2 * 60 * 1000; // 2 minutes

const STATIC_ASSETS = [
  './',
  './index.html',
  './styles/base.css',
  './styles/theme.css',
  './styles/table.css',
  './styles/components.css',
  './js/main.js',
  './js/api.js',
  './js/utils.js',
  './js/state.js',
  './js/ui-table.js',
  './js/ui-detail.js',
  './js/ui-toasts.js',
  './js/charts.js',
  './js/pwa.js',
  './assets/logo.svg',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k)).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only GET
  if(event.request.method !== 'GET') return;

  // API runtime cache with SWR
  if(url.origin === 'https://api.coingecko.com'){
    event.respondWith(apiSWR(event.request));
    return;
  }

  // Static assets cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(res => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then(cache => cache.put(event.request, copy));
        return res;
      }).catch(()=> cached); // offline fallback
    })
  );
});

async function apiSWR(request){
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const now = Date.now();

  if(cached){
    const ts = Number(cached.headers.get('x-sw-ts') || 0);
    // serve cached immediately
    const resp = cached;
    // revalidate in background if stale
    if(now - ts > API_TTL_MS){
      revalidate(request, cache);
    }
    return resp;
  } else {
    try{
      const res = await fetch(request);
      const wrapped = await withTimestamp(res);
      cache.put(request, wrapped.clone());
      return wrapped;
    }catch(e){
      // offline and no cache: return a synthetic empty response
      return new Response(JSON.stringify([]), { headers: { 'content-type':'application/json' }, status: 200 });
    }
  }
}

function revalidate(request, cache){
  fetch(request).then(res => withTimestamp(res)).then(resp => cache.put(request, resp)).catch(()=>{});
}

async function withTimestamp(res){
  const body = await res.clone().arrayBuffer();
  const headers = new Headers(res.headers);
  headers.set('x-sw-ts', String(Date.now()));
  return new Response(body, { status: res.status, statusText: res.statusText, headers });
}
>>>>>>> 530db5daaec23920649897806d4a51bfac202cc5
