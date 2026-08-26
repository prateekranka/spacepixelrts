import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 1024 } });
await page.goto('http://127.0.0.1:5179/tools/forge-art/index.html?mesh=0&combat=1', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__FORGE_ART_QA__?.ready === true, null, { timeout: 15000 });
// Sample a wide area of the canvas to find ALL magenta blocks and their bboxes;
// also check the canvas backing size vs displayed size and the transform.
const info = await page.evaluate(() => {
  const c = document.querySelector('[data-fal-canvas="baseline"]');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  // count distinct magenta blobs roughly by scanning rows
  let blocks = [];
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (x + y * c.width) * 4;
      if (d[i]===255&&d[i+1]===0&&d[i+2]===255) {
        if (!blocks.length || x - blocks[blocks.length-1].x > 4 || y - blocks[blocks.length-1].y > 4) {
          blocks.push({x,y});
        }
      }
    }
  }
  return { blocks: blocks.slice(0,10), total: blocks.length };
});
console.log(JSON.stringify(info));
await browser.close();
