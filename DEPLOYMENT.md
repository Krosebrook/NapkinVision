# Deployment Guide

## ☁️ Vercel (Recommended)
1. Link GitHub repo.
2. Set "Build Command" to: `none`.
3. Set "Output Directory" to: `.`.
4. Add `API_KEY` to Environment Variables.

## ⚡ Cloudflare Pages
1. Select "Framework Preset": `None`.
2. Build command: (leave empty).
3. Root directory: `/`.
4. Configure `API_KEY` in the dashboard.

## 🚀 Firebase Hosting
1. `firebase init hosting`.
2. Set public directory to `.`.
3. Configure `firebase.json` to handle clean URLs for the PWA.