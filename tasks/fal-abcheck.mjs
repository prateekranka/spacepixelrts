import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 1024 } });
await page.goto('http://127.0.0.1:5179/tools/forge-art/index.html?mesh=0&combat=1', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__FORGE_ART_QA__?.ready === true, null, { timeout: 15000 });
// Is the wipe at 50%? In split mode the candidate canvas is clipped to show right half;
// left half should show baseline canvas. Both are identical now (no changes), so visually
// indistinguishable — but verify both canvases are painted (non-empty).
const res = await page.evaluate(() => {
  const read = (sel) => {
    const c = document.querySelector(sel);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i+3] > 0 && (d[i] > 20 || d[i+1] > 20 || d[i+2] > 20)) lit++;
    return { w: c.width, h: c.height, lit };
  };
  return { baseline: read('[data-fal-canvas="baseline"]'), candidate: read('[data-fal-canvas="candidate"]'), clip: getComputedStyle(document.querySelector('.zoom-wrap')).clipPath };
});
console.log(JSON.stringify(res));
await browser.close();
