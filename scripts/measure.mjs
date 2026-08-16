/**
 * Spacepixel critic probe — inspects the actual running browser.
 * Usage: node scripts/measure.mjs [--url http://localhost:5173] [--fps-seconds 5] [--screenshot path.png]
 */
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const args = process.argv.slice(2);
function argVal(flag, dflt) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
}
const URL = argVal('--url', 'http://localhost:5173');
const FPS_SECONDS = Number(argVal('--fps-seconds', '4'));
const SHOT = argVal('--screenshot', null);
const WAIT_SECONDS = Number(argVal('--wait', '3'));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });

const consoleIssues = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') consoleIssues.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => consoleIssues.push(`[pageerror] ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(WAIT_SECONDS * 1000);

const fps = await page.evaluate(async (seconds) => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'no canvas found' };
  const deltas = [];
  let last = performance.now();
  const start = last;
  await new Promise((resolve) => {
    function tick(now) {
      deltas.push(now - last);
      last = now;
      if (now - start < seconds * 1000) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
  deltas.sort((a, b) => a - b);
  const avg = deltas.reduce((s, d) => s + d, 0) / deltas.length;
  const p99 = deltas[Math.floor(deltas.length * 0.99)] ?? avg;
  const spikes = deltas.filter((d) => d > 22).length;
  const probe = window.__SPACEPIXEL__ || window.__STARHOLD__ || null;
  return {
    avgFrameMs: Math.round(avg * 100) / 100,
    fps: Math.round(1000 / avg),
    p99FrameMs: Math.round(p99 * 100) / 100,
    framesWorseThan45fps: spikes,
    probe,
  };
}, FPS_SECONDS);

const shotBuf = await page.screenshot();
const png = PNG.sync.read(shotBuf);
const data = png.data;
const counts = new Map();
for (let i = 0; i < data.length; i += 4) {
  const r = data[i] >> 4,
    g = data[i + 1] >> 4,
    b = data[i + 2] >> 4;
  const key = (r << 8) | (g << 4) | b;
  counts.set(key, (counts.get(key) || 0) + 1);
}
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
const total = sorted.reduce((s, e) => s + e[1], 0);
let lumSum = 0,
  lumMin = 255,
  lumMax = 0,
  n = 0,
  nonBlack = 0;
for (let i = 0; i < data.length; i += 4) {
  const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  lumSum += l;
  lumMin = Math.min(lumMin, l);
  lumMax = Math.max(lumMax, l);
  n++;
  if (l > 10) nonBlack++;
}
const topColors = sorted.slice(0, 8).map(([k, c]) => ({
  hex:
    '#' +
    [
      ((k >> 8) * 17).toString(16).padStart(2, '0'),
      (((k >> 4) & 15) * 17).toString(16).padStart(2, '0'),
      ((k & 15) * 17).toString(16).padStart(2, '0'),
    ].join(''),
  share: Math.round((c / total) * 1000) / 10,
}));
const palette = {
  distinctQuantizedColors: sorted.length,
  topColors,
  avgLuminance: Math.round(lumSum / n),
  luminanceRange: [Math.round(lumMin), Math.round(lumMax)],
  nonBlackPixelShare: Math.round((nonBlack / n) * 10000) / 100,
};

const result = { url: URL, fps, palette, consoleIssues };
if (SHOT) {
  await page.screenshot({ path: SHOT });
  result.screenshot = SHOT;
}
console.log(JSON.stringify(result, null, 2));
await browser.close();
