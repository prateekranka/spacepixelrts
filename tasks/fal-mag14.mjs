import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 1024 } });
await page.goto('http://127.0.0.1:5179/tools/forge-art/index.html?mesh=0&combat=1', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__FORGE_ART_QA__?.ready === true, null, { timeout: 15000 });
// Check whether the block is the anchor marker: sample around cell px 45..47, 29..31 at fit=4 -> canvas 180..191,116..127
// The magenta block is at canvas 197..209, 127..139 => cell px 49.25..52.25, 31.75..34.75
// Compare: baseline.cell(key) for dir0-pose0... check what key is selected and its magenta bbox in the CELL image:
const info = await page.evaluate(async () => {
  const res = await fetch('./baselines/sunweaver-lumen-guard/baseline.png');
  const blob = await res.blob();
  const bmp = await createImageBitmap(blob);
  const cv = document.createElement('canvas');
  cv.width = bmp.width; cv.height = bmp.height;
  const ctx = cv.getContext('2d');
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, cv.width, cv.height).data;
  let minX=1e9,minY=1e9,maxX=-1,maxY=-1,n=0;
  for (let y=0;y<cv.height;y++) for (let x=0;x<cv.width;x++){
    const i=(x+y*cv.width)*4;
    if(img[i]===255&&img[i+1]===0&&img[i+2]===255){n++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  }
  return { pngW: cv.width, pngH: cv.height, n, box:[minX,minY,maxX,maxY] };
});
console.log(info);
await browser.close();
