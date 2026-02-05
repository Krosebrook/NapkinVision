/**
 * Bring Anything to Life - Smoke Check
 * Verifies critical build artifacts and security boundaries.
 */

const fs = require('fs');
const path = require('path');

const FAIL = (msg) => { console.error(`❌ [SMOKE CHECK] ${msg}`); process.exit(1); };
const PASS = (msg) => { console.log(`✅ [SMOKE CHECK] ${msg}`); };

console.log('--- Starting Smoke Check ---');

// 1. Verify Entry Files
['index.html', 'index.tsx', 'sw.js', 'manifest.json'].forEach(file => {
  if (!fs.existsSync(path.join(process.cwd(), file))) FAIL(`Missing critical file: ${file}`);
});
PASS('Essential entry files exist.');

// 2. Check Security - Iframe Sandbox
const livePreviewPath = path.join(process.cwd(), 'components/LivePreview.tsx');
if (fs.existsSync(livePreviewPath)) {
    const content = fs.readFileSync(livePreviewPath, 'utf8');
    if (!content.includes('sandbox="')) FAIL('LivePreview missing iframe sandbox attributes.');
    if (content.includes('allow-top-navigation')) FAIL('Security Risk: allow-top-navigation found in iframe sandbox.');
}
PASS('Iframe sandbox security verified.');

// 3. Verify PWA Assets
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
if (!manifest.start_url || !manifest.icons) FAIL('Manifest invalid for PWA installability.');
PASS('PWA Manifest structure verified.');

console.log('--- All checks passed! ---');
process.exit(0);
