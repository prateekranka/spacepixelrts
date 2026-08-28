import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const page = await browser.newPage();
page.on('response', (r) => { if (r.status() === 404) console.log('404:', r.url()); });
await page.goto('http://127.0.0.1:5179/tools/forge-art/index.html', { waitUntil: "load", timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2500);
await browser.close();
