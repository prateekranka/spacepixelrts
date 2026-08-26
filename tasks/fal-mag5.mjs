import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1366, height: 1024 } });
await page.goto('http://127.0.0.1:5179/tools/forge-art/index.html?mesh=0&combat=1', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__FORGE_ART_QA__?.ready === true, null, { timeout: 15000 });
const info = await page.evaluate(() => {
  const out = [];
  for (const el of document.elementsFromPoint(372, 95)) out.push(`${el.tagName}#${el.id}.${el.className}`);
  return out;
});
console.log(info);
await browser.close();
