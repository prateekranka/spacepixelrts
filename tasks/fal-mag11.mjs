import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 1024 } });
await page.goto('http://127.0.0.1:5179/tools/forge-art/index.html?mesh=0&combat=1', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__FORGE_ART_QA__?.ready === true, null, { timeout: 15000 });
// magenta bbox in canvas coordinates
const info = await page.evaluate(() => {
  const c = document.querySelector('[data-fal-canvas="baseline"]');
  const img = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let minX=1e9,minY=1e9,maxX=-1,maxY=-1,n=0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (x + y * c.width) * 4;
    if (img[i]===255&&img[i+1]===0&&img[i+2]===255) {
      n++; minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y);
    }
  }
  return { n, box:[minX,minY,maxX,maxY], w:c.width, h:c.height };
});
console.log(info);
await browser.close();
