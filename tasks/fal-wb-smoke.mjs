// Workbench live smoke — drive the running Art Lab with Playwright and report.
import { chromium } from 'playwright';

const URL = process.env.FAL_URL ?? 'http://127.0.0.1:5179/tools/forge-art/index.html';

const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(URL + '?mesh=0&combat=1', { waitUntil: 'load' });
try {
  await page.waitForFunction(() => globalThis.__FORGE_ART_QA__?.ready === true, null, { timeout: 15000 });
} catch {}
const probe = await page.evaluate(() => {
  const qa = globalThis.__FORGE_ART_QA__;
  return qa ? JSON.parse(JSON.stringify(qa)) : null;
});
console.log('probe:', probe ? { ready: probe.ready, gl: probe.gl, catalog: probe.catalog?.entries?.length, selection: probe.selection?.assetId ?? probe.state?.assetId } : null);
console.log('data-fal-ready=', await page.getAttribute('body', 'data-fal-ready'));
console.log('status chip:', await page.getAttribute('[data-fal-status]', 'data-fal-status').catch(() => null) ?? (await page.textContent('[data-fal-status]').catch(() => null)));
console.log('catalog items:', await page.locator('[data-fal-asset]').count());
console.log('canvases:', await page.locator('[data-fal-canvas]').count());
if (errors.length) console.log('ERRORS:\n' + errors.slice(0, 6).join('\n'));
else console.log('zero console/page errors');
await page.screenshot({ path: '/tmp/fal-workbench-smoke.png', type: 'png' });
await browser.close();
