import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 1024 } });
await page.goto('http://127.0.0.1:5179/tools/forge-art/index.html?mesh=0&combat=1', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__FORGE_ART_QA__?.ready === true, null, { timeout: 15000 });
// Which frame is selected, and does the baseline cell contain MAG?
const info = await page.evaluate(() => {
  const qa = globalThis.__FORGE_ART_QA__;
  const c = document.querySelector('[data-fal-canvas="baseline"]');
  const ctx = c.getContext('2d');
  const img = ctx.getImageData(0, 0, c.width, c.height);
  let mag = [];
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (x + y * c.width) * 4;
    if (img.data[i]===255 && img.data[i+1]===0 && img.data[i+2]===255) mag.push([x,y]);
  }
  return { frame: qa.state.frame, facing: qa.state.facing, magCount: mag.length, sample: mag.slice(0,6) };
});
console.log(JSON.stringify(info));
await browser.close();
