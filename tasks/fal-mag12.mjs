import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 1024 } });
await page.goto('http://127.0.0.1:5179/tools/forge-art/index.html?mesh=0&combat=1', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__FORGE_ART_QA__?.ready === true, null, { timeout: 15000 });
// sample the exact colors in and around the 13x13 magenta block
const info = await page.evaluate(() => {
  const c = document.querySelector('[data-fal-canvas="baseline"]');
  const ctx = c.getContext('2d');
  const img = ctx.getImageData(195, 125, 20, 20).data;
  const colors = {};
  for (let i = 0; i < img.length; i += 4) {
    const k = `${img[i]},${img[i+1]},${img[i+2]}`;
    colors[k] = (colors[k] ?? 0) + 1;
  }
  return colors;
});
console.log(info);
await browser.close();
