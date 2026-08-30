import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 1024 } });
await page.goto('http://127.0.0.1:5179/tools/forge-art/index.html?mesh=0&combat=1', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__FORGE_ART_QA__?.ready === true, null, { timeout: 15000 });
// What does the baseline canvas actually contain — the selected cell or the whole sheet?
const info = await page.evaluate(() => {
  const c = document.querySelector('[data-fal-canvas="baseline"]');
  return { w: c.width, h: c.height, mode: document.getElementById('fal-stage-box').dataset.mode };
});
console.log(info);
await browser.close();
