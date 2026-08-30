import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 1024 } });
await page.goto('http://127.0.0.1:5179/tools/forge-art/index.html?mesh=0&combat=1', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__FORGE_ART_QA__?.ready === true, null, { timeout: 15000 });
// count magenta in the baseline canvas BEFORE any screenshot; then after a rAF
const before = await page.evaluate(() => {
  const c = document.querySelector('[data-fal-canvas="baseline"]');
  const img = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let n = 0;
  for (let i = 0; i < img.length; i += 4) if (img[i]===255&&img[i+1]===0&&img[i+2]===255) n++;
  return n;
});
await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const after = await page.evaluate(() => {
  const c = document.querySelector('[data-fal-canvas="baseline"]');
  const img = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let n = 0;
  for (let i = 0; i < img.length; i += 4) if (img[i]===255&&img[i+1]===0&&img[i+2]===255) n++;
  return n;
});
console.log({before, after});
await browser.close();
