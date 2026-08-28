import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 1024 } });
await page.goto('http://127.0.0.1:5179/tools/forge-art/index.html?mesh=0&combat=1', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__FORGE_ART_QA__?.ready === true, null, { timeout: 15000 });
// scan all canvases for magenta
const report = await page.evaluate(() => {
  const out = [];
  let idx = 0;
  for (const c of document.querySelectorAll('canvas')) {
    const ctx = c.getContext('2d');
    if (!ctx || !c.width) { idx++; continue; }
    try {
      const img = ctx.getImageData(0, 0, c.width, c.height);
      let mag = 0;
      for (let i = 0; i < img.data.length; i += 4) {
        if (img.data[i] === 255 && img.data[i+1] === 0 && img.data[i+2] === 255) mag++;
      }
      out.push({ idx, id: c.id || c.getAttribute('data-fal-canvas'), w: c.width, h: c.height, mag });
    } catch (e) { out.push({ idx, err: String(e) }); }
    idx++;
  }
  return out;
});
console.log(JSON.stringify(report.filter(r => r.mag > 0), null, 2));
await browser.close();
