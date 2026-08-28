import { chromium } from 'playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 1024 } });
await page.goto('http://127.0.0.1:5179/tools/forge-art/index.html?mesh=0&combat=1', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__FORGE_ART_QA__?.ready === true, null, { timeout: 15000 });
const colors = await page.evaluate(() => {
  const c = document.querySelectorAll('[data-fal-canvas]')[1]; // candidate canvas (topmost)
  const ctx = c.getContext('2d');
  const rect = c.getBoundingClientRect();
  const sx = Math.floor((367 - rect.left) / rect.width * c.width);
  const sy = Math.floor((90 - rect.top) / rect.height * c.height);
  const img = ctx.getImageData(sx, sy, 14, 10);
  const found = new Set();
  for (let i = 0; i < img.data.length; i += 4) {
    found.add(`${img.data[i]},${img.data[i+1]},${img.data[i+2]},${img.data[i+3]}`);
  }
  return { rect: [rect.left, rect.top, rect.width, rect.height], colors: [...found].slice(0, 20), id: c.getAttribute('data-fal-canvas') };
});
console.log(JSON.stringify(colors, null, 2));
await browser.close();
