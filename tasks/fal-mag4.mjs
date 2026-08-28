import { chromium } from 'playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 1024 } });
await page.goto('http://127.0.0.1:5179/tools/forge-art/index.html?mesh=0&combat=1', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__FORGE_ART_QA__?.ready === true, null, { timeout: 15000 });
// read the canvas pixel data under the magenta bbox via getImageData
const colors = await page.evaluate(() => {
  const c = document.querySelector('[data-fal-canvas="baseline"]');
  const ctx = c.getContext('2d');
  // canvas may be scaled; map screen 367..379 x 90..98 into canvas space
  const rect = c.getBoundingClientRect();
  const sx = (367 - rect.left) / rect.width * c.width;
  const sy = (90 - rect.top) / rect.height * c.height;
  const img = ctx.getImageData(Math.floor(sx), Math.floor(sy), 14, 10);
  const found = new Set();
  for (let i = 0; i < img.data.length; i += 4) {
    found.add(`${img.data[i]},${img.data[i+1]},${img.data[i+2]},${img.data[i+3]}`);
  }
  return [...found].slice(0, 20);
});
console.log(colors);
await browser.close();
