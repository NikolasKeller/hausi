import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME = '/usr/local/bin/google-chrome';
const BASE = 'http://localhost:8081';
const OUT = '/workspace/screenshots';

const screens = [
  { name: 'explore', url: `${BASE}/explore`, wait: 8000 },
  { name: 'calendar', url: `${BASE}/calendar`, wait: 6000 },
  { name: 'profile', url: `${BASE}/profile`, wait: 6000 },
  { name: 'welcome', url: `${BASE}/welcome`, wait: 4000 },
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 430, height: 932, deviceScaleFactor: 2 },
  });

  for (const s of screens) {
    const page = await browser.newPage();
    await page.goto(s.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, s.wait));
    await page.screenshot({ path: path.join(OUT, `${s.name}.png`), fullPage: false });
    console.log(`Saved ${s.name}.png`);
    await page.close();
  }

  await browser.close();
})();
