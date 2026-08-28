import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 1024 } });
await page.goto('http://127.0.0.1:5179/tools/forge-art/index.html?mesh=0&combat=1', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__FORGE_ART_QA__?.ready === true, null, { timeout: 15000 });
// Sample the exact colors in the 'G' region (200,120) — is the sprite even drawn there?
const colors = await page.evaluate(() => {
  const c = document.querySelector('[data-fal-canvas="baseline"]');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const counts = {};
  for (let i = 0; i < d.length; i += 4) {
    const k = `${d[i]},${d[i+1]},${d[i+2]}`;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,12);
});
console.log(colors);
await browser.close();
