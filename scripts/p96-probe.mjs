/**
 * P96 — elevation cliff probes + screenshots.
 * Usage: node scripts/p96-probe.mjs [--url URL]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://127.0.0.1:5173';

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: [
    '--disable-frame-rate-limit',
    '--disable-gpu-vsync',
    '--disable-background-timer-throttling',
  ],
});

mkdirSync('critic/out', { recursive: true });

async function measureFps(page) {
  return page.evaluate(async () => {
    const deltas = [];
    let last = performance.now();
    const start = last;
    await new Promise((resolve) => {
      function tick(now) {
        deltas.push(now - last);
        last = now;
        if (now - start < 2000) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
    deltas.sort((a, b) => a - b);
    const avg = deltas.reduce((s, d) => s + d, 0) / deltas.length;
    const p99 = deltas[Math.floor(deltas.length * 0.99)] ?? avg;
    return Math.round(p99 * 100) / 100;
  });
}

function heightProbe(w) {
  const MAP = w.map ?? 72;
  const hist = [0, 0, 0, 0];
  let blocked = 0;
  let rock = 0;
  let padMax = 0;
  let maxTile = { x: 0, z: 0, h: 0 };
  const icx = (MAP * 0.5) | 0;
  const icz = (MAP * 0.52) | 0;
  for (let z = 0; z < MAP; z++) {
    for (let x = 0; x < MAP; x++) {
      const i = x + z * MAP;
      const h = w.height[i];
      hist[h] = (hist[h] ?? 0) + 1;
      if (w.block[i]) blocked++;
      if (w.tiles[i] === 2) rock++;
      if (
        x >= icx - 14 &&
        x <= icx + 13 &&
        z >= icz - 10 &&
        z <= icz + 9
      ) {
        padMax = Math.max(padMax, h);
      }
      if (h > maxTile.h) maxTile = { x, z, h };
    }
  }
  const path = w.pathfind(10, 10, MAP - 11, MAP - 11);
  return {
    hist,
    blocked,
    rock,
    padMax,
    maxTile,
    pathLen: path ? path.length >> 1 : 0,
    pathOk: !!path,
  };
}

const out = { base: BASE, judgedAt: new Date().toISOString() };

// Opening screenshot + probe
{
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  out.opening = await page.evaluate(() => {
    const w = window.__STARHOLD_WORLD__;
    const p = window.__STARHOLD__;
    return {
      version: p.version,
      tick: w.tick,
    };
  });
  const probe = await page.evaluate(() => {
    const w = window.__STARHOLD_WORLD__;
    const MAP = 72;
    const hist = [0, 0, 0, 0];
    let blocked = 0;
    let rock = 0;
    let padMax = 0;
    let maxTile = { x: 0, z: 0, h: 0 };
    const icx = (MAP * 0.5) | 0;
    const icz = (MAP * 0.52) | 0;
    for (let z = 0; z < MAP; z++) {
      for (let x = 0; x < MAP; x++) {
        const i = x + z * MAP;
        const h = w.height[i];
        hist[h]++;
        if (w.block[i]) blocked++;
        if (w.tiles[i] === 2) rock++;
        if (
          x >= icx - 14 &&
          x <= icx + 13 &&
          z >= icz - 10 &&
          z <= icz + 9
        ) {
          padMax = Math.max(padMax, h);
        }
        if (h > maxTile.h) maxTile = { x, z, h };
      }
    }
    const path = w.pathfind(10, 10, 61, 61);
    return {
      hist,
      blocked,
      rock,
      padMax,
      maxTile,
      pathLen: path ? path.length >> 1 : 0,
      pathOk: !!path,
    };
  });
  out.probe = probe;
  out.opening.p99FrameMs = await measureFps(page);
  await page.screenshot({ path: 'critic/out/p96.png' });
  await page.close();
}

// Ridge pan screenshot
{
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const ridge = await page.evaluate(() => {
    const w = window.__STARHOLD_WORLD__;
    const MAP = 72;
    let maxTile = { x: 0, z: 0, h: 0 };
    for (let z = 0; z < MAP; z++) {
      for (let x = 0; x < MAP; x++) {
        const h = w.height[x + z * MAP];
        if (h > maxTile.h) maxTile = { x, z, h };
      }
    }
    const input = window.__STARHOLD_INPUT__;
    input.pan.x = maxTile.x + 0.5;
    input.pan.z = maxTile.z + 0.5;
    input.halfH = 8;
    return maxTile;
  });
  out.ridgePan = ridge;
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'critic/out/p96-ridge.png' });
  await page.close();
}

await browser.close();

out.pass =
  out.opening?.version === '0.9.3-iso' &&
  out.probe?.blocked > 0 &&
  out.probe?.rock > 0 &&
  out.probe?.padMax === 0 &&
  out.probe?.pathOk &&
  out.probe?.hist?.[1] > 100 &&
  out.opening?.p99FrameMs < 8;

writeFileSync('critic/out/p96-probe.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
