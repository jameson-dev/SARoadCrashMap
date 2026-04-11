/**
 * Performance Optimization Module
 * Provides utilities for caching, performance monitoring, and optimization
 */

import { TIMEOUTS, CACHE_CONFIG } from './config.js';

// ============================================================================
// LRU CACHE IMPLEMENTATION
// ============================================================================

/**
 * Least Recently Used (LRU) Cache
 * Automatically evicts least recently used items when limit is reached
 */
export class LRUCache {
    constructor(limit) {
        this.limit = limit;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) return undefined;
        const value = this.cache.get(key);
        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.limit) {
            // Remove least recently used (first item)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    has(key) {
        return this.cache.has(key);
    }

    clear() {
        this.cache.clear();
    }

    get size() {
        return this.cache.size;
    }
}

// ============================================================================
// INDEXEDDB CACHING
// ============================================================================

/**
 * IndexedDB wrapper for caching large datasets
 */
class IndexedDBCache {
    constructor(dbName = 'CrashMapCache', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
    }

    /**
     * Open or create the IndexedDB database
     */
    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores if they don't exist
                if (!db.objectStoreNames.contains('crashData')) {
                    db.createObjectStore('crashData');
                }
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata');
                }
            };
        });
    }

    /**
     * Get data from cache
     */
    async get(storeName, key) {
        if (!this.db) await this.open();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Put data into cache
     */
    async put(storeName, key, value) {
        if (!this.db) await this.open();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(value, key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Check if cache is fresh (less than maxAge milliseconds old)
     */
    async isFresh(key, maxAge = 7 * 24 * 60 * 60 * 1000) { // Default: 7 days
        const metadata = await this.get('metadata', key);
        if (!metadata) return false;

        return Date.now() - metadata.timestamp < maxAge;
    }

    /**
     * Get cached data if fresh, otherwise return null
     */
    async getFresh(storeName, key, maxAge) {
        const isFresh = await this.isFresh(key, maxAge);
        if (!isFresh) return null;

        return await this.get(storeName, key);
    }

    /**
     * Clear all data from cache
     */
    async clear() {
        if (!this.db) await this.open();

        const storeNames = ['crashData', 'metadata'];

        for (const storeName of storeNames) {
            await new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }
}

// Create singleton instance
export const dbCache = new IndexedDBCache();

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Performance measurement utility
 */
export class PerformanceMonitor {
    constructor() {
        this.measurements = new Map();
        this.enabled = true; // Can be toggled in production
    }

    /**
     * Start measuring performance for a label
     */
    start(label) {
        if (!this.enabled) return;
        this.measurements.set(label, performance.now());
    }

    /**
     * End measurement and log result
     */
    end(label, silent = false) {
        if (!this.enabled) return 0;

        const start = this.measurements.get(label);
        if (!start) {
            console.warn(`No start measurement found for: ${label}`);
            return 0;
        }

        const duration = performance.now() - start;
        this.measurements.delete(label);

        if (!silent) {
            console.log(`⚡ ${label}: ${duration.toFixed(2)}ms`);
        }

        return duration;
    }

    /**
     * Measure a synchronous function
     */
    measure(label, fn) {
        if (!this.enabled) return fn();

        this.start(label);
        const result = fn();
        this.end(label);
        return result;
    }

    /**
     * Measure an async function
     */
    async measureAsync(label, fn) {
        if (!this.enabled) return await fn();

        this.start(label);
        const result = await fn();
        this.end(label);
        return result;
    }

    /**
     * Get memory usage (if available)
     */
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
                total: Math.round(performance.memory.totalJSHeapSize / 1048576), // MB
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) // MB
            };
        }
        return null;
    }

    /**
     * Log memory usage
     */
    logMemory(label = 'Memory Usage') {
        const memory = this.getMemoryUsage();
        if (memory) {
            console.log(`💾 ${label}: ${memory.used}MB / ${memory.total}MB (limit: ${memory.limit}MB)`);
        }
    }
}

// Create singleton instance
export const perfMonitor = new PerformanceMonitor();

// ============================================================================
// DEBOUNCE OPTIMIZATION
// ============================================================================

/**
 * Optimized debounce implementation
 * Creates a single timeout-based debounced function
 */
export function debounce(func, wait = TIMEOUTS.DEBOUNCE_DEFAULT) {
    let timeoutId;

    const debounced = function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), wait);
    };

    // Add cancel method to clear pending timeout
    debounced.cancel = () => {
        clearTimeout(timeoutId);
    };

    return debounced;
}

/**
 * Throttle function - ensures function is called at most once per interval
 */
export function throttle(func, limit = TIMEOUTS.THROTTLE_DEFAULT) {
    let inThrottle;

    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ============================================================================
// DOM UTILITIES
// ============================================================================

/**
 * DOM reference cache
 * Stores frequently accessed DOM elements to avoid repeated getElementById calls
 */
export class DOMCache {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Get element by ID (cached)
     */
    get(id) {
        if (!this.cache.has(id)) {
            const element = document.getElementById(id);
            if (element) {
                this.cache.set(id, element);
            }
            return element;
        }
        return this.cache.get(id);
    }

    /**
     * Clear cache (useful after DOM changes)
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Remove specific element from cache
     */
    remove(id) {
        this.cache.delete(id);
    }
}

// Create singleton instance
export const domCache = new DOMCache();

/**
 * Batch DOM updates using DocumentFragment
 */
export function batchDOMUpdate(container, elements) {
    const fragment = document.createDocumentFragment();

    elements.forEach(element => {
        if (typeof element === 'string') {
            const temp = document.createElement('div');
            temp.innerHTML = element;
            fragment.appendChild(temp.firstChild);
        } else {
            fragment.appendChild(element);
        }
    });

    container.innerHTML = '';
    container.appendChild(fragment);
}

// ============================================================================
// REQUEST IDLE CALLBACK POLYFILL & UTILITIES
// ============================================================================

/**
 * RequestIdleCallback polyfill for browsers that don't support it
 */
export const requestIdleCallback = window.requestIdleCallback || function(cb) {
    const start = Date.now();
    return setTimeout(() => {
        cb({
            didTimeout: false,
            timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
        });
    }, 1);
};

export const cancelIdleCallback = window.cancelIdleCallback || function(id) {
    clearTimeout(id);
};

/**
 * Process array in chunks during idle time
 */
export function processInIdle(array, processFn, onComplete, chunkSize = 100) {
    let index = 0;

    function processChunk(deadline) {
        while (deadline.timeRemaining() > 0 && index < array.length) {
            const endIndex = Math.min(index + chunkSize, array.length);

            for (let i = index; i < endIndex; i++) {
                processFn(array[i], i);
            }

            index = endIndex;
        }

        if (index < array.length) {
            requestIdleCallback(processChunk);
        } else if (onComplete) {
            onComplete();
        }
    }

    requestIdleCallback(processChunk);
}

// ============================================================================
// FILTER CACHE
// ============================================================================

/**
 * Filter results cache with LRU eviction and IndexedDB persistence
 */
export class FilterCache {
    constructor(limit = CACHE_CONFIG.FILTER_CACHE_SIZE) {
        this.cache = new LRUCache(limit);
        this.dbName = 'CrashMapFilterCache';
        this.storeName = 'filters';
        this.db = null;
        this.initDB();
    }

    /**
     * Initialize IndexedDB for persistent filter cache
     */
    async initDB() {
        try {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, 1);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    this.db = request.result;
                    resolve(this.db);
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        const store = db.createObjectStore(this.storeName);
                        store.createIndex('timestamp', 'timestamp', { unique: false });
                    }
                };
            });
        } catch (error) {
            console.warn('Failed to init filter cache DB:', error);
        }
    }

    /**
     * Generate cache key from filter values
     */
    generateKey(filters) {
        // Build a canonical object: keys sorted alphabetically, array values sorted
        // so that logically identical filters always produce the same key regardless
        // of insertion order or multi-select ordering.
        const sorted = {};
        for (const key of Object.keys(filters).sort()) {
            const val = filters[key];
            sorted[key] = Array.isArray(val) ? [...val].sort() : val;
        }
        return JSON.stringify(sorted);
    }

    /**
     * Get cached filter results (checks memory first, then IndexedDB)
     */
    async get(filters) {
        const key = this.generateKey(filters);

        // Check memory cache first (fast)
        const memoryResult = this.cache.get(key);
        if (memoryResult) {
            return memoryResult;
        }

        // Check persistent cache (slower)
        try {
            if (!this.db) await this.initDB();
            if (!this.db) return undefined;

            return new Promise((resolve) => {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(key);

                request.onsuccess = () => {
                    const cached = request.result;
                    if (cached) {
                        const age = Date.now() - cached.timestamp;
                        if (age < CACHE_CONFIG.FILTER_CACHE_MAX_AGE) {
                            // Restore to memory cache for fast access
                            this.cache.set(key, cached.results);
                            resolve(cached.results);
                        } else {
                            // Expired
                            resolve(undefined);
                        }
                    } else {
                        resolve(undefined);
                    }
                };

                request.onerror = () => resolve(undefined);
            });
        } catch (error) {
            console.warn('Filter cache get error:', error);
            return undefined;
        }
    }

    /**
     * Cache filter results (both memory and IndexedDB)
     */
    async set(filters, results) {
        const key = this.generateKey(filters);

        // Store in memory cache (fast access)
        this.cache.set(key, results);

        // Store in persistent cache (survives page reloads)
        try {
            if (!this.db) await this.initDB();
            if (!this.db) return;

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            store.put({
                results: results,
                timestamp: Date.now()
            }, key);
        } catch (error) {
            console.warn('Filter cache set error:', error);
        }
    }

    /**
     * Check if filters are cached (memory only for speed)
     */
    has(filters) {
        const key = this.generateKey(filters);
        return this.cache.has(key);
    }

    /**
     * Clear both memory and persistent cache
     */
    async clear() {
        this.cache.clear();

        try {
            if (!this.db) await this.initDB();
            if (!this.db) return;

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            store.clear();
        } catch (error) {
            console.warn('Filter cache clear error:', error);
        }
    }
}

// Create singleton instance
export const filterCache = new FilterCache();

// ============================================================================
// PARALLEL FETCH WITH PROGRESS
// ============================================================================

/**
 * Fetch with progress tracking
 */
export async function fetchWithProgress(url, onProgress) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentLength = +response.headers.get('Content-Length');
    const reader = response.body.getReader();

    let receivedLength = 0;
    const chunks = [];

    while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        if (onProgress && contentLength) {
            const percent = Math.round((receivedLength / contentLength) * 100);
            onProgress(percent, receivedLength, contentLength);
        }
    }

    // Concatenate chunks into single Uint8Array
    const allChunks = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
    }

    return allChunks;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    LRUCache,
    dbCache,
    perfMonitor,
    debounce,
    throttle,
    domCache,
    batchDOMUpdate,
    requestIdleCallback,
    cancelIdleCallback,
    processInIdle,
    filterCache,
    fetchWithProgress
};
