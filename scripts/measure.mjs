/**
 * Spacepixel critic probe — inspects the actual running browser.
 * Usage: node scripts/measure.mjs [--url http://localhost:5173] [--fps-seconds 5] [--screenshot path.png]
 */
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
function argVal(flag, dflt) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
}
const URL = argVal('--url', 'http://localhost:5173');
const FPS_SECONDS = Number(argVal('--fps-seconds', '4'));
const SHOT = argVal('--screenshot', null);
const WAIT_SECONDS = Number(argVal('--wait', '3'));
const EXPECTED_STATE = argVal('--state', null);
const JSON_OUT = argVal('--out', null);
const VIEWPORT = {
  width: Number(argVal('--width', '1366')),
  height: Number(argVal('--height', '1024')),
};

const browserArgs = [
  '--disable-frame-rate-limit',
  '--disable-gpu-vsync',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
];
let browserEngine = 'chrome';
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--disable-dev-shm-usage'], args: browserArgs });
} catch {
  browserEngine = 'playwright-chromium';
  browser = await chromium.launch({ headless: true, ignoreDefaultArgs: ['--disable-dev-shm-usage'], args: browserArgs });
}
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });

const consoleIssues = [];
const requestIssues = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') consoleIssues.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => consoleIssues.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (request) => requestIssues.push(`${request.url()} — ${request.failure()?.errorText || 'unknown'}`));
page.on('response', (response) => {
  if (response.status() >= 400) requestIssues.push(`${response.status()} ${response.url()}`);
});

await page.goto(URL, { waitUntil: 'networkidle' });
if (EXPECTED_STATE) {
  await page.waitForFunction((expected) => globalThis.__STARHAVEN_QA__?.state === expected, EXPECTED_STATE, { timeout: 30000 });
}
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

const renderer = await page.evaluate(() => {
  try {
    const existing = document.querySelector('canvas#game, canvas');
    const canvas = existing instanceof HTMLCanvasElement ? existing : document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { renderer: 'none', vendor: 'none', webglVersion: 'none', softwareGl: false };
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererName = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : 'masked';
    const vendorName = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)) : 'masked';
    return {
      renderer: rendererName,
      vendor: vendorName,
      webglVersion: gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl',
      softwareGl: /swiftshader|llvmpipe|software|mesa/i.test(rendererName),
    };
  } catch (error) {
    return { renderer: 'error', vendor: 'error', webglVersion: 'error', softwareGl: false, error: String(error) };
  }
});

const published = await page.evaluate(() => {
  const qa = globalThis.__STARHAVEN_QA__ || null;
  const legacy = globalThis.__SPACEPIXEL__ || globalThis.__STARHOLD__ || null;
  return {
    state: qa?.state || null,
    tick: qa?.tick ?? null,
    publishedWorkP99FrameMs: qa?.p99FrameMs ?? null,
    draws: qa?.draws ?? legacy?.rendererInfo?.drawn ?? null,
    entities: qa?.entities ?? legacy?.ents ?? null,
    fps: qa?.fps ?? legacy?.fps ?? null,
  };
});

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

const result = {
  url: URL,
  browserEngine,
  viewport: VIEWPORT,
  renderer,
  softwareGl: renderer.softwareGl,
  fps,
  published,
  palette,
  consoleIssues,
  requestIssues,
  judgedAt: new Date().toISOString(),
};
if (SHOT) {
  mkdirSync(dirname(SHOT), { recursive: true });
  await page.screenshot({ path: SHOT });
  result.screenshot = SHOT;
}
const jsonPath = JSON_OUT || 'critic/out/latest.json';
mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
result.json = jsonPath;
console.log(JSON.stringify(result, null, 2));
await browser.close();
