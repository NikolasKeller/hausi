// Expo's "single" web output ignores app/+html.tsx, so the PWA wiring
// (manifest, iOS add-to-home-screen meta, service worker registration, dark
// shell background) is injected into the exported index.html here. Run right
// after `expo export --platform web`; `npm run export:web` does both.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
let html = readFileSync(file, 'utf8');

if (html.includes('rel="manifest"')) {
  console.log('postexport: index.html already processed');
  process.exit(0);
}

// viewport-fit=cover lets the installed app extend under the notch; the CSS
// below pads the shell back out of it. maximum-scale=1 + user-scalable=no stop
// iOS Safari from auto-zooming into a focused input (which would push the
// screen title out of view) — this is an app-like PWA, not a scrollable doc.
html = html.replace(
  'width=device-width, initial-scale=1, shrink-to-fit=no',
  'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no, viewport-fit=cover'
);

const headTags = `
    <meta name="description" content="Parties with friends - invites, RSVPs and the Party Wall." />
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="iykyk" />
    <style>
      html, body { background-color: #111111; }
      /* App shell: only inner ScrollViews scroll. Pinning the body stops iOS
         Safari from panning the whole page sideways (keyboard focus scroll,
         horizontal-scroller rubber-banding) and leaving it stuck out of
         bounds on the right. */
      html {
        overflow: hidden;
        height: 100%;
        overscroll-behavior: none;
      }
      body {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        overscroll-behavior: none;
      }
      #root {
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
      }
    </style>
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js').catch(function () {});
        });
      }
    </script>
  `;

if (!html.includes('</head>')) {
  console.error('postexport: no </head> in dist/index.html — template changed?');
  process.exit(1);
}
html = html.replace('</head>', `${headTags}</head>`);

writeFileSync(file, html);
console.log('postexport: injected PWA tags into dist/index.html');

// Pin the service worker cache to this build. sw.js ships with a
// `iykyk-__BUILD_ID__` placeholder; replace it with a hash of the exported JS
// so every code change yields a new cache name (see public/sw.js for why a
// static name would strand installed PWAs on stale bundles). Redeploying
// identical code keeps the same id, so users aren't churned needlessly.
const distDir = fileURLToPath(new URL('../dist', import.meta.url));
const swFile = `${distDir}/sw.js`;

function collectJs(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = `${dir}/${name}`;
    if (statSync(full).isDirectory()) out.push(...collectJs(full));
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

const hash = createHash('sha256');
let hashedAny = false;
try {
  for (const js of collectJs(`${distDir}/_expo`)) {
    hash.update(readFileSync(js));
    hashedAny = true;
  }
} catch {
  // _expo layout changed — fall through to hashing the shell instead.
}
if (!hashedAny) hash.update(html);
const buildId = hash.digest('hex').slice(0, 12);

let sw;
try {
  sw = readFileSync(swFile, 'utf8');
} catch {
  console.error('postexport: no dist/sw.js — public/ not copied by export?');
  process.exit(1);
}
const marker = "const CACHE = 'iykyk-__BUILD_ID__';";
if (!sw.includes(marker)) {
  console.error('postexport: sw.js CACHE placeholder missing — already stamped or template changed?');
  process.exit(1);
}
writeFileSync(swFile, sw.replace(marker, `const CACHE = 'iykyk-${buildId}';`));
console.log(`postexport: pinned service worker cache to iykyk-${buildId}`);
