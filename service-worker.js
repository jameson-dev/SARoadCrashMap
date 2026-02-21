// Service Worker for SA Crash Data Map
// Implements caching strategies for offline support and performance

const VERSION = '1.0.49';
const CACHE_NAME = `crash-map-static-v${VERSION}`;
const DATA_CACHE_NAME = `crash-map-data-v${VERSION}`;
const RUNTIME_CACHE_NAME = `crash-map-runtime-v${VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
    './',
    './index.html',
    './app.js',
    './styles.css',
    './manifest.json',
    './saroadcrashmap-icon.svg',
    './saroadcrashmap-logo.svg',
    './LICENSE'
];

// CDN resources to cache
const CDN_ASSETS = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
    'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js',
    'https://unpkg.com/nouislider@15.7.1/dist/nouislider.min.css',
    'https://unpkg.com/nouislider@15.7.1/dist/nouislider.min.js',
    'https://unpkg.com/papaparse@5.4.1/papaparse.min.js',
    'https://unpkg.com/proj4@2.9.0/dist/proj4.js',
    'https://unpkg.com/@turf/turf@6.5.0/turf.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing version:', VERSION);

    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(CACHE_NAME).then(cache => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            }),
            // Cache CDN resources
            caches.open(CACHE_NAME).then(cache => {
                console.log('[Service Worker] Caching CDN resources');
                return Promise.allSettled(
                    CDN_ASSETS.map(url =>
                        cache.add(url).catch(err => {
                            console.warn('[Service Worker] Failed to cache:', url, err);
                        })
                    )
                );
            })
        ]).then(() => {
            console.log('[Service Worker] Installation complete');
            // Force the waiting service worker to become active
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating version:', VERSION);

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(cacheName => {
                        // Delete old caches
                        return cacheName.startsWith('crash-map-') &&
                               cacheName !== CACHE_NAME &&
                               cacheName !== DATA_CACHE_NAME &&
                               cacheName !== RUNTIME_CACHE_NAME;
                    })
                    .map(cacheName => {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
            );
        }).then(() => {
            console.log('[Service Worker] Activation complete');
            // Take control of all pages immediately
            return self.clients.claim();
        })
    );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle HTTP/HTTPS requests (ignore chrome-extension://, data:, blob:, etc.)
    if (!request.url.startsWith('http')) {
        return;
    }

    // Strategy 1: Data files - Cache First (with network fallback)
    // Browser automatically decompresses gzip when served with correct headers
    if (url.pathname.includes('/data/')) {
        event.respondWith(cacheFirstStrategy(request, DATA_CACHE_NAME));
        return;
    }

    // Strategy 2: Static assets - Cache First (with network fallback)
    // HTML, CSS, JS files
    if (url.pathname.match(/\.(html|css|js)$/)) {
        event.respondWith(cacheFirstStrategy(request, CACHE_NAME));
        return;
    }

    // Strategy 3: CDN resources - Cache First (with network fallback)
    // External libraries from unpkg/jsdelivr
    if (url.hostname.includes('unpkg.com') || url.hostname.includes('jsdelivr.net')) {
        event.respondWith(cacheFirstStrategy(request, CACHE_NAME));
        return;
    }

    // Strategy 4: OpenStreetMap tiles - Cache First (with expiry)
    // Map tiles change rarely
    if (url.hostname.includes('openstreetmap.org') ||
        url.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(cacheFirstStrategy(request, RUNTIME_CACHE_NAME, 7 * 24 * 60 * 60 * 1000)); // 7 days
        return;
    }

    // Strategy 5: Everything else - Network First (with cache fallback)
    // For dynamic content and API calls
    event.respondWith(networkFirstStrategy(request, RUNTIME_CACHE_NAME));
});

// Cache First Strategy - Try cache, fall back to network
async function cacheFirstStrategy(request, cacheName, maxAge = null) {
    try {
        // Try to get from cache
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            // Check if cache is too old (if maxAge specified)
            if (maxAge) {
                const cachedDate = new Date(cachedResponse.headers.get('date'));
                const now = new Date();
                const age = now - cachedDate;

                if (age > maxAge) {
                    console.log('[Service Worker] Cache expired, fetching fresh:', request.url);
                    // Cache expired, fetch fresh and update cache
                    return fetchAndCache(request, cacheName);
                }
            }

            console.log('[Service Worker] Serving from cache:', request.url);
            return cachedResponse;
        }

        // Not in cache, fetch from network
        console.log('[Service Worker] Not in cache, fetching:', request.url);
        return fetchAndCache(request, cacheName);

    } catch (error) {
        console.error('[Service Worker] Cache First error:', error);
        // If both cache and network fail, return offline page
        return new Response('Offline - Resource not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
                'Content-Type': 'text/plain'
            })
        });
    }
}

// Network First Strategy - Try network, fall back to cache
async function networkFirstStrategy(request, cacheName) {
    try {
        // Try network first
        const networkResponse = await fetch(request);

        // Only cache GET requests with successful responses
        if (networkResponse &&
            networkResponse.status === 200 &&
            request.method === 'GET') {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;

    } catch (error) {
        console.log('[Service Worker] Network failed, trying cache:', request.url);

        // Network failed, try cache
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            console.log('[Service Worker] Serving stale from cache:', request.url);
            return cachedResponse;
        }

        // Both failed
        return new Response('Offline - Resource not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
                'Content-Type': 'text/plain'
            })
        });
    }
}

// Helper: Fetch from network and cache the response
async function fetchAndCache(request, cacheName) {
    try {
        const networkResponse = await fetch(request);

        // Only cache successful HTTP/HTTPS GET requests
        // Avoid caching opaque, error, or redirected responses
        if (networkResponse &&
            networkResponse.ok &&
            !networkResponse.redirected &&
            networkResponse.type !== 'opaque' &&
            networkResponse.type !== 'error' &&
            request.method === 'GET' &&
            request.url.startsWith('http')) {
            try {
                const cache = await caches.open(cacheName);
                // Clone the response because it can only be consumed once
                await cache.put(request, networkResponse.clone());
                console.log('[Service Worker] Cached:', request.url);
            } catch (cacheError) {
                // Cache.put() can fail for various reasons - log but don't crash
                console.warn('[Service Worker] Failed to cache:', request.url, {
                    error: cacheError.message,
                    status: networkResponse.status,
                    type: networkResponse.type,
                    redirected: networkResponse.redirected,
                    headers: Object.fromEntries([...networkResponse.headers.entries()].slice(0, 5))
                });
            }
        } else if (networkResponse && request.url.includes('/data/')) {
            // Log why data files weren't cached
            console.log('[Service Worker] Skipping cache for:', request.url, {
                ok: networkResponse.ok,
                status: networkResponse.status,
                type: networkResponse.type,
                redirected: networkResponse.redirected
            });
        }

        return networkResponse;

    } catch (error) {
        console.error('[Service Worker] Fetch failed:', error);
        throw error;
    }
}

// Message event - handle messages from the client
self.addEventListener('message', event => {
    console.log('[Service Worker] Received message:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        console.log('[Service Worker] Clearing cache:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            }).then(() => {
                event.ports[0].postMessage({ success: true });
            })
        );
    }

    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: VERSION });
    }
});

// Handle updates
self.addEventListener('controllerchange', () => {
    console.log('[Service Worker] Controller changed');
});

console.log('[Service Worker] Loaded, version:', VERSION);
