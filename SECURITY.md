# Security Guidelines

## 🛡️ Content Security Policy (CSP)
Current app relies on several CDNs. Recommended CSP:
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://aistudiocdn.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: https:;
connect-src 'self' https://generativelanguage.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
frame-src 'self' blob:;
```

## 🔑 Secret Handling
- `API_KEY` is injected via `process.env`.
- NEVER commit the key to version control.
- Use scoped keys with "Generative Language API" restrictions only.

## 🧱 Sandbox Boundaries
- Previewed apps run inside an `<iframe>` with `sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"`. 
- This prevents the generated code from accessing the parent's `localStorage` or `process.env`.