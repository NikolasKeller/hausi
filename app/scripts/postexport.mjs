// Expo's "single" web output ignores app/+html.tsx, so the PWA wiring
// (manifest, iOS add-to-home-screen meta, service worker registration, dark
// shell background) is injected into the exported index.html here. Run right
// after `expo export --platform web`; `npm run export:web` does both.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../dist/index.html', import.meta.url));
let html = readFileSync(file, 'utf8');

if (html.includes('rel="manifest"')) {
  console.log('postexport: index.html already processed');
  process.exit(0);
}

// viewport-fit=cover lets the installed app extend under the notch; the CSS
// below pads the shell back out of it.
html = html.replace(
  'width=device-width, initial-scale=1, shrink-to-fit=no',
  'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover'
);

const headTags = `
    <meta name="description" content="Parties with friends — invites, RSVPs and the Party Wall." />
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Hausi" />
    <style>
      html, body { background-color: #0E0B16; }
      body { overscroll-behavior-y: none; }
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
