// Service Worker Registration and Update Management
// This file handles registering the SW and notifying users of updates

(function() {
    'use strict';

    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
        console.log('Service Workers not supported in this browser');
        return;
    }

    let refreshing = false;

    // Reload page when new service worker takes control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        console.log('Service Worker updated, reloading page...');
        window.location.reload();
    });

    // Register service worker when page loads
    window.addEventListener('load', () => {
        registerServiceWorker();
    });

    async function registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/'
            });

            console.log('Service Worker registered successfully:', registration.scope);

            // Check for updates every hour
            setInterval(() => {
                registration.update();
            }, 60 * 60 * 1000);

            // Handle updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('New Service Worker found, installing...');

                newWorker.addEventListener('statechange', () => {
                    console.log('Service Worker state:', newWorker.state);

                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New service worker installed, show update notification
                        showUpdateNotification(newWorker);
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

    // Show update notification to user
    function showUpdateNotification(worker) {
        console.log('New version available! Showing update notification...');

        // Create update banner
        const banner = document.createElement('div');
        banner.id = 'sw-update-banner';
        banner.innerHTML = `
            <div style="
                position: fixed;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: #4a90e2;
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10001;
                display: flex;
                gap: 15px;
                align-items: center;
                font-size: 14px;
                font-family: 'Segoe UI', sans-serif;
                animation: slideDown 0.3s ease-out;
            ">
                <span>New version available!</span>
                <button id="sw-update-btn" style="
                    background: white;
                    color: #4a90e2;
                    border: none;
                    padding: 6px 16px;
                    border-radius: 4px;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 13px;
                ">Update Now</button>
                <button id="sw-dismiss-btn" style="
                    background: transparent;
                    color: white;
                    border: 1px solid white;
                    padding: 6px 16px;
                    border-radius: 4px;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 13px;
                ">Later</button>
            </div>
            <style>
                @keyframes slideDown {
                    from {
                        transform: translate(-50%, -100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(-50%);
                        opacity: 1;
                    }
                }
            </style>
        `;

        document.body.appendChild(banner);

        // Update now button
        document.getElementById('sw-update-btn').addEventListener('click', () => {
            console.log('User accepted update');
            worker.postMessage({ type: 'SKIP_WAITING' });
            banner.remove();
        });

        // Dismiss button
        document.getElementById('sw-dismiss-btn').addEventListener('click', () => {
            console.log('User dismissed update');
            banner.remove();
        });
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
