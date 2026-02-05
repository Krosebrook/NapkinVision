# Observability

## 📊 Performance Metrics
- **LCP (Largest Contentful Paint)**: Target < 2.5s.
- **FID (First Input Delay)**: Target < 100ms.
- **CLS (Cumulative Layout Shift)**: Target < 0.1.

## 🚨 Error Reporting
- Errors in `handleGenerate` are caught and displayed via a custom Toast UI.
- Critical API failures (429/500/503) are mapped to user-friendly messages in `App.tsx`.

## 📈 Release Tracking
- Monitor Service Worker registration rates in analytics to ensure PWA adoption.