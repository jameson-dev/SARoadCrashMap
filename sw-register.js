// Service Worker Registration and Update Management
// This file handles registering the SW and notifying users of updates

(function() {
    'use strict';

    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
        console.log('Service Workers not supported in this browser');
        return;
    }

    let hasUpdate = false;
    let contentUpdated = false;

    // Register service worker when page loads
    window.addEventListener('load', () => {
        registerServiceWorker();
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', event => {
        const { type, data } = event.data;

        switch (type) {
            case 'CACHE_PROGRESS':
                updateCacheProgress(event.data.percentage, event.data.cached, event.data.total);
                break;

            case 'CACHE_COMPLETE':
                hideCacheProgress();
                console.log('✓ All assets cached for offline use');
                break;

            case 'CONTENT_UPDATED':
                // Content was updated in the background
                contentUpdated = true;
                if (hasUpdate) {
                    showUpdateAvailableBadge();
                }
                break;

            case 'SW_INSTALLED':
                console.log('Service Worker installed:', event.data.version);
                break;
        }
    });

    async function registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('./service-worker.js', {
                scope: './'
            });

            console.log('Service Worker registered successfully:', registration.scope);

            // Check for updates only on page load (not periodically)
            // This prevents interrupting users mid-session
            registration.update();

            // Handle updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('New Service Worker found, installing...');

                newWorker.addEventListener('statechange', () => {
                    console.log('Service Worker state:', newWorker.state);

                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New service worker installed
                        hasUpdate = true;
                        showGentleUpdateNotification(newWorker);
                    }
                });
            });

            // Get current version
            if (registration.active) {
                const messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = (event) => {
                    console.log('Service Worker version:', event.data.version);
                };
                registration.active.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);
            }

        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }

    // Show gentle update notification (non-intrusive)
    function showGentleUpdateNotification(worker) {
        console.log('New version ready. User can refresh when convenient.');

        // Remove any existing notification
        const existing = document.getElementById('sw-update-badge');
        if (existing) existing.remove();

        // Create gentle notification badge
        const badge = document.createElement('div');
        badge.id = 'sw-update-badge';
        badge.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 18px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10001;
                font-size: 13px;
                font-family: 'Segoe UI', sans-serif;
                animation: slideInRight 0.4s ease-out;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 10px;
                max-width: 300px;
            ">
                <span style="font-size: 16px;">✨</span>
                <div>
                    <div style="font-weight: 600; margin-bottom: 4px;">Update Available</div>
                    <div style="font-size: 11px; opacity: 0.9;">Refresh when ready to see the latest version</div>
                </div>
            </div>
            <style>
                @keyframes slideInRight {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            </style>
        `;

        document.body.appendChild(badge);

        // Click to refresh
        badge.addEventListener('click', () => {
            console.log('User chose to update now');
            worker.postMessage({ type: 'SKIP_WAITING' });
            // Show loading message
            badge.innerHTML = `
                <div style="
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 12px 18px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-family: 'Segoe UI', sans-serif;
                ">
                    Updating...
                </div>
            `;
            // Reload after a brief delay to allow service worker to activate
            setTimeout(() => {
                window.location.reload();
            }, 500);
        });

        // Auto-fade after 10 seconds
        setTimeout(() => {
            badge.style.transition = 'opacity 0.5s';
            badge.style.opacity = '0.7';
        }, 10000);
    }

    // Show update available badge (for background content updates)
    function showUpdateAvailableBadge() {
        const existing = document.getElementById('sw-update-badge');
        if (existing) {
            // Already showing, just pulse it
            existing.style.animation = 'pulse 0.5s';
            setTimeout(() => {
                existing.style.animation = '';
            }, 500);
        }
    }

    // Cache progress indicator
    function updateCacheProgress(percentage, cached, total) {
        let indicator = document.getElementById('cache-progress-indicator');

        if (!indicator) {
            // Create progress indicator
            indicator = document.createElement('div');
            indicator.id = 'cache-progress-indicator';
            indicator.innerHTML = `
                <div style="
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: white;
                    color: #333;
                    padding: 12px 16px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    z-index: 9999;
                    font-size: 12px;
                    font-family: 'Segoe UI', sans-serif;
                    min-width: 200px;
                    animation: slideUp 0.3s ease-out;
                ">
                    <div style="margin-bottom: 6px; font-weight: 600;">Caching for offline use</div>
                    <div style="background: #e0e0e0; height: 4px; border-radius: 2px; overflow: hidden;">
                        <div id="cache-progress-bar" style="
                            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                            height: 100%;
                            width: 0%;
                            transition: width 0.3s ease;
                        "></div>
                    </div>
                    <div id="cache-progress-text" style="margin-top: 4px; font-size: 11px; color: #666;"></div>
                </div>
                <style>
                    @keyframes slideUp {
                        from {
                            transform: translateY(100px);
                            opacity: 0;
                        }
                        to {
                            transform: translateY(0);
                            opacity: 1;
                        }
                    }
                </style>
            `;
            document.body.appendChild(indicator);
        }

        // Update progress
        const progressBar = document.getElementById('cache-progress-bar');
        const progressText = document.getElementById('cache-progress-text');

        if (progressBar) {
            progressBar.style.width = percentage + '%';
        }

        if (progressText) {
            progressText.textContent = `${cached} of ${total} files (${percentage}%)`;
        }
    }

    function hideCacheProgress() {
        const indicator = document.getElementById('cache-progress-indicator');
        if (indicator) {
            indicator.style.transition = 'opacity 0.3s';
            indicator.style.opacity = '0';
            setTimeout(() => {
                indicator.remove();
            }, 300);
        }
    }

    // Expose cache management functions globally
    window.serviceWorkerUtils = {
        // Clear all caches
        clearCache: async function() {
            if (!navigator.serviceWorker.controller) {
                console.warn('No active service worker');
                return false;
            }

            const messageChannel = new MessageChannel();

            return new Promise((resolve) => {
                messageChannel.port1.onmessage = (event) => {
                    resolve(event.data.success);
                };

                navigator.serviceWorker.controller.postMessage(
                    { type: 'CLEAR_CACHE' },
                    [messageChannel.port2]
                );
            });
        },

        // Get cache status
        getCacheStatus: async function() {
            if (!('caches' in window)) {
                return { supported: false };
            }

            const cacheNames = await caches.keys();
            const status = {
                supported: true,
                caches: cacheNames,
                count: cacheNames.length
            };

            // Get total cache size (approximation)
            let totalSize = 0;
            for (const cacheName of cacheNames) {
                const cache = await caches.open(cacheName);
                const requests = await cache.keys();

                for (const request of requests) {
                    const response = await cache.match(request);
                    if (response) {
                        const blob = await response.blob();
                        totalSize += blob.size;
                    }
                }
            }

            status.totalSize = totalSize;
            status.totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

            return status;
        },

        // Check if online
        isOnline: function() {
            return navigator.onLine;
        }
    };

    // Log online/offline status
    window.addEventListener('online', () => {
        console.log('✅ Back online');
        showOnlineStatus(true);
    });

    window.addEventListener('offline', () => {
        console.log('⚠️ Offline mode');
        showOnlineStatus(false);
    });

    function showOnlineStatus(isOnline) {
        // Remove existing status
        const existing = document.getElementById('online-status');
        if (existing) existing.remove();

        // Create status indicator
        const status = document.createElement('div');
        status.id = 'online-status';
        status.style.cssText = `
            position: fixed;
            bottom: 60px;
            right: 20px;
            background: ${isOnline ? '#4caf50' : '#ff9800'};
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        status.textContent = isOnline ? '✓ Online' : '⚠ Offline';

        document.body.appendChild(status);

        // Auto-hide after 3 seconds
        setTimeout(() => {
            status.style.transition = 'opacity 0.3s';
            status.style.opacity = '0';
            setTimeout(() => status.remove(), 300);
        }, 3000);
    }

    console.log('Service Worker registration module loaded');

})();
