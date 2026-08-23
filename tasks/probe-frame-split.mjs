import { spawn } from 'node:child_process';
import net from 'node:net';
import { chromium } from 'playwright';
const REPO_ROOT = '/home/bobbyranka/workspace/spacepixelrts';
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { res(s.address().port); s.close(); }); });
const vite = spawn(REPO_ROOT + '/node_modules/.bin/vite', ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: REPO_ROOT });
await new Promise(r => setTimeout(r, 3000));
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 1024 } })).newPage();
await page.goto(`http://127.0.0.1:${port}/?qa=opening&qa-run=1`, { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Playing', null, { timeout: 30000 });
const out = await page.evaluate(async () => {
  const world = globalThis.__STARHOLD_WORLD__;
  for (let i = 0; i < 120; i++) world.step();
  let t0 = performance.now();
  for (let i = 0; i < 600; i++) world.step();
  const stepMs = (performance.now() - t0) / 600;
  const samples = [];
  for (let i = 0; i < 60; i++) { t0 = performance.now(); await new Promise(r => requestAnimationFrame(r)); samples.push(performance.now() - t0); }
  samples.sort((a, b) => a - b);
  let gl = 'unknown';
  try { const c = document.createElement('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); const d = g.getExtension('WEBGL_debug_renderer_info'); gl = d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a'; } catch (e) { gl = 'err'; }
  return { stepMs, rafMedian: Math.round(samples[30] * 100) / 100, gl };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
vite.kill();
process.exit(0);
