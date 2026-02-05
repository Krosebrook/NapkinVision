/**
 * Production Service Worker
 * Strategy: 
 * - App Shell: Stale-While-Revalidate
 * - CDNs (React, Tailwind, PDF.js): Cache-First (Long-lived)
 * - Fonts: Cache-First
 */

importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
  const { registerRoute } = workbox.routing;
  const { StaleWhileRevalidate, CacheFirst } = workbox.strategies;
  const { ExpirationPlugin } = workbox.expiration;
  const { CacheableResponsePlugin } = workbox.cacheableResponse;

  // Cache the App Shell (HTML, TSX, CSS)
  registerRoute(
    ({ request }) => request.destination === 'document' || 
                     request.destination === 'script' || 
                     request.destination === 'style',
    new StaleWhileRevalidate({
      cacheName: 'app-shell',
    })
  );

  // Cache CDN Dependencies (React, Heroicons, Tailwind, PDF.js)
  registerRoute(
    ({ url }) => url.origin === 'https://aistudiocdn.com' || 
                 url.origin === 'https://cdn.tailwindcss.com' ||
                 url.origin === 'https://cdnjs.cloudflare.com',
    new CacheFirst({
      cacheName: 'cdn-deps',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }), // 30 Days
      ],
    })
  );

  // Cache Google Fonts
  registerRoute(
    ({ url }) => url.origin === 'https://fonts.googleapis.com' || 
                 url.origin === 'https://fonts.gstatic.com',
    new CacheFirst({
      cacheName: 'google-fonts',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 }),
      ],
    })
  );

  // Skip waiting and claim clients for immediate updates
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', () => self.clients.claim());
}