import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 1024 } });
await page.goto('http://127.0.0.1:5179/tools/forge-art/index.html?mesh=0&combat=1', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__FORGE_ART_QA__?.ready === true, null, { timeout: 15000 });
// What is at canvas pixel (200, 130) in the baseline image BEFORE scaling? Extract
// the raw baseline cell bytes the workbench uses via its own cache — instead, sample
// the canvas around the block and check whether the block edges align to a 4px grid
// (fit scale) => source pixels.
const info = await page.evaluate(() => {
  const c = document.querySelector('[data-fal-canvas="baseline"]');
  const d = c.getContext('2d').getImageData(190, 120, 30, 30).data;
  // print a color map
  let rows = [];
  for (let y = 0; y < 30; y++) {
    let row = '';
    for (let x = 0; x < 30; x++) {
      const i = (x + y * 30) * 4;
      const r=d[i],g=d[i+1],b=d[i+2];
      row += (r===255&&g===0&&b===255) ? 'M' : (r>200&&g>180) ? 'G' : (r<60) ? '.' : '?';
    }
    rows.push(row);
  }
  return rows.join('\n');
});
console.log(info);
await browser.close();
