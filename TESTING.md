# Testing & Quality

## 📋 Acceptance Criteria
- [ ] Lighthouse PWA score > 90.
- [ ] App is installable on Chrome (Android/Desktop) and Safari (iOS).
- [ ] App shell loads with "airplane mode" on.
- [ ] LocalStorage persistence works across sessions.

## 🛠️ Verification Commands
1. **Linting**: `npx eslint .`
2. **PWA Check**: Use Chrome DevTools -> Lighthouse -> PWA.
3. **SW Debugging**: Chrome DevTools -> Application -> Service Workers.

## 📉 QualityScore Formula
`QualityScore = (LighthousePWA * 0.4) + (OfflineReady * 0.3) + (A11yScore * 0.2) + (PerformanceScore * 0.1)`
Goal: > 85/100.