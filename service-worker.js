// Service Worker for SA Crash Data Map
// Implements caching strategies for offline support and performance

// Version can be injected during build: npm run build will replace __VERSION__
// If not replaced, falls back to timestamp-based version
const BUILD_VERSION = '__VERSION__'; // Will be replaced by build script
const VERSION = BUILD_VERSION !== '__VERSION__' ? BUILD_VERSION :
                `dev-${new Date().toISOString().split('T')[0]}`; // Fallback for dev
const CACHE_NAME = `crash-map-static-v${VERSION}`;
// Data cache uses stable name to persist across service worker updates
const DATA_CACHE_NAME = 'crash-map-data-stable';
const RUNTIME_CACHE_NAME = `crash-map-runtime-v${VERSION}`;

// Critical shell assets to cache on install (minimal set for fast first load)
const CRITICAL_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './manifest.json'
];

// Non-critical static assets to cache lazily (after initial load)
const STATIC_ASSETS = [
    './saroadcrashmap-icon.svg',
    './saroadcrashmap-logo.svg',
    './LICENSE',
    './src/js/main.js',
    './src/js/analytics.js',
    './src/js/config.js',
    './src/js/data-loader.js',
    './src/js/filters.js',
    './src/js/filter-worker.js',
    './src/js/map-renderer.js',
    './src/js/state.js',
    './src/js/ui.js',
    './src/js/utils.js',
    './src/js/performance.js',
    './src/js/pdf-generator.js',
    './src/js/error-handler.js',
    './src/js/modals-content.js',
    './src/js/inline-handlers.js'
];

// CDN resources to cache lazily (only essential core libraries)
// Note: Reduced list - only cache libraries critical for offline functionality
// Other CDN resources will be cached on-demand via stale-while-revalidate strategy
const CDN_ASSETS = [
    // Core mapping (essential for app to function)
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    // Data decompression (essential for loading data)
    'https://unpkg.com/pako@2.1.0/dist/pako.min.js',
    // Coordinate conversion (essential for map display)
    'https://unpkg.com/proj4@2.9.0/dist/proj4.js',
    // URL compression (essential for sharing filters)
    'https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js'
    // Other libraries are cached on-demand when first used
];

// Install event - cache only critical shell assets for fast first load
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Use Promise.allSettled to make installation resilient to individual failures
            return Promise.allSettled(
                CRITICAL_ASSETS.map(url =>
                    cache.add(url).catch(err => {
                        console.warn('[Service Worker] Failed to cache critical asset:', url, err);
                        // Re-throw for truly critical assets
                        if (url === './index.html' || url === './') {
                            throw err;
                        }
                    })
                )
            );
        }).then(() => {
            // Notify clients about installation progress
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SW_INSTALLED',
                        version: VERSION
                    });
                });
            });
            // Don't skip waiting - let the user decide when to update
            // This prevents interrupting active sessions
        })
    );
});

// Activate event - clean up old caches and start lazy caching
self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => {
                            // Delete old versioned caches, but keep stable data cache
                            return cacheName.startsWith('crash-map-') &&
                                   cacheName !== CACHE_NAME &&
                                   cacheName !== DATA_CACHE_NAME && // Keep stable data cache
                                   cacheName !== RUNTIME_CACHE_NAME &&
                                   !cacheName.includes('data-stable'); // Extra safety
                        })
                        .map(cacheName => {
                            return caches.delete(cacheName);
                        })
                );
            }),
            // Take control of all pages immediately
            self.clients.claim()
        ]).then(() => {
            // Start lazy-loading non-critical assets in the background
            lazyLoadAssets();
            // Clean old data cache entries if needed
            cleanDataCache();
        })
    );
});

// Clean old data cache entries (keep cache size manageable)
async function cleanDataCache() {
    try {
        const cache = await caches.open(DATA_CACHE_NAME);
        const requests = await cache.keys();

        // If data cache has more than 100 entries, remove oldest ones
        const MAX_DATA_CACHE_SIZE = 100;

        if (requests.length > MAX_DATA_CACHE_SIZE) {
            // Get all entries with their dates
            const entries = await Promise.all(
                requests.map(async request => {
                    const response = await cache.match(request);
                    const date = response?.headers.get('date');
                    return {
                        request,
                        date: date ? new Date(date) : new Date(0)
                    };
                })
            );

            // Sort by date (oldest first)
            entries.sort((a, b) => a.date - b.date);

            // Delete oldest entries
            const toDelete = entries.slice(0, requests.length - MAX_DATA_CACHE_SIZE);
            await Promise.all(
                toDelete.map(entry => cache.delete(entry.request))
            );
        }
    } catch (err) {
        console.warn('[Service Worker] Failed to clean data cache:', err);
    }
}

// Lazy-load non-critical assets in the background
async function lazyLoadAssets() {
    const cache = await caches.open(CACHE_NAME);
    let cachedCount = 0;
    let totalAssets = STATIC_ASSETS.length + CDN_ASSETS.length;

    // Cache static assets
    for (const url of STATIC_ASSETS) {
        try {
            await cache.add(url);
            cachedCount++;
            notifyCacheProgress(cachedCount, totalAssets);
        } catch (err) {
            console.warn('[Service Worker] Failed to lazy-cache:', url, err);
        }
    }

    // Cache CDN assets
    for (const url of CDN_ASSETS) {
        try {
            await cache.add(url);
            cachedCount++;
            notifyCacheProgress(cachedCount, totalAssets);
        } catch (err) {
            console.warn('[Service Worker] Failed to lazy-cache CDN:', url, err);
        }
    }

    // Notify all clients that caching is done
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({
            type: 'CACHE_COMPLETE',
            version: VERSION
        });
    });
}

// Notify clients of cache progress
function notifyCacheProgress(cached, total) {
    const percentage = Math.round((cached / total) * 100);

    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({
                type: 'CACHE_PROGRESS',
                cached,
                total,
                percentage
            });
        });
    });
}

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle HTTP/HTTPS requests (ignore chrome-extension://, data:, blob:, etc.)
    if (!request.url.startsWith('http')) {
        return;
    }

    // Cache bypass for testing - add ?nocache to URL
    if (url.searchParams.has('nocache') || url.searchParams.has('bypass-cache')) {
        event.respondWith(fetch(request));
        return;
    }

    // Strategy 1: Data files - Cache First (with network fallback)
    // Browser automatically decompresses gzip when served with correct headers
    if (url.pathname.includes('/data/')) {
        event.respondWith(cacheFirstStrategy(request, DATA_CACHE_NAME));
        return;
    }

    // Strategy 2: Static assets - Stale-While-Revalidate
    // HTML, CSS, JS files - serve from cache but update in background
    if (url.pathname.match(/\.(html|css|js)$/) || url.pathname === '/' || url.pathname.endsWith('/')) {
        event.respondWith(staleWhileRevalidateStrategy(request, CACHE_NAME));
        return;
    }

    // Strategy 3: CDN resources - Stale-While-Revalidate (with longer tolerance)
    // External libraries from unpkg/jsdelivr
    if (url.hostname.includes('unpkg.com') || url.hostname.includes('jsdelivr.net')) {
        event.respondWith(staleWhileRevalidateStrategy(request, CACHE_NAME, 30 * 24 * 60 * 60 * 1000)); // 30 days
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
                    // Cache expired, fetch fresh and update cache
                    return fetchAndCache(request, cacheName);
                }
            }

            return cachedResponse;
        }

        // Not in cache, fetch from network
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
        // Network failed, try cache
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
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

// Stale-While-Revalidate Strategy - Serve from cache, update in background
async function staleWhileRevalidateStrategy(request, cacheName, maxAge = null) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    // Fetch fresh version in the background
    const fetchPromise = fetch(request).then(async networkResponse => {
        // Only cache successful responses
        if (networkResponse && networkResponse.ok && request.method === 'GET') {
            try {
                await cache.put(request, networkResponse.clone());

                // Notify clients that new content is available
                const clients = await self.clients.matchAll();
                clients.forEach(client => {
                    client.postMessage({
                        type: 'CONTENT_UPDATED',
                        url: request.url
                    });
                });
            } catch (err) {
                console.warn('[Service Worker] Failed to update cache:', request.url, err);
            }
        }
        return networkResponse;
    }).catch(() => {
        return null;
    });

    // If we have a cached response, check if it's still valid
    if (cachedResponse) {
        // Check age if maxAge is specified
        if (maxAge) {
            const dateHeader = cachedResponse.headers.get('date');
            if (dateHeader) {
                const cachedDate = new Date(dateHeader);
                const now = new Date();
                const age = now - cachedDate;

                if (age > maxAge) {
                    // Cache is too old, wait for network response
                    return fetchPromise.then(response => response || cachedResponse);
                }
            }
        }

        // Return cached version immediately, update happens in background
        return cachedResponse;
    }

    // No cached response, wait for network
    const networkResponse = await fetchPromise;

    if (networkResponse) {
        return networkResponse;
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
            } catch (cacheError) {
                // Cache.put() can fail for various reasons - log but don't crash
                console.warn('[Service Worker] Failed to cache:', request.url, {
                    error: cacheError.message,
                    status: networkResponse.status,
                    type: networkResponse.type,
                    redirected: networkResponse.redirected
                });
            }
        }

        return networkResponse;

    } catch (error) {
        console.error('[Service Worker] Fetch failed:', error);
        throw error;
    }
}

// Message event - handle messages from the client
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
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
    // Controller changed
});
