# PWA Specification

## 📦 Installability
- **Manifest**: Located at `/manifest.json`.
- **Icons**: Uses high-resolution SVG icons.
- **Display**: `standalone` for a native app feel.

## ⚡ Caching Strategy (Workbox)
1. **App Shell**: `StaleWhileRevalidate`. Ensures immediate load while updating in background.
2. **CDN Assets**: `CacheFirst`. CDN assets are versioned; once cached, we stop hitting the network.
3. **API Responses**: **No caching**. AI generation results are volatile and large.
4. **LocalStorage**: Used as a persistence layer for `CreationHistory`.

## 📵 Offline Behavior
- The core app UI loads offline.
- History can be browsed offline.
- AI Generation requires an active network connection.

## 🔄 Update Strategy
Service worker uses `skipWaiting()` and `clients.claim()` to ensure that when a new version is pushed, the user gets it on the next reload without "ghosting" older versions.