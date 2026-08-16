/**
 * P60 viewport-cull probes — opening tableau, off-screen horde, on-screen horde.
 * Usage: node scripts/p60-probe.mjs [--url URL]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://127.0.0.1:5174';

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: [
    '--disable-frame-rate-limit',
    '--disable-gpu-vsync',
    '--disable-background-timer-throttling',
  ],
});

const out = { url: URL, judgedAt: new Date().toISOString() };

async function measureFps(page, ms = 3000, stepSim = false) {
  return page.evaluate(
    async ({ ms, stepSim }) => {
      const deltas = [];
      let last = performance.now();
      const start = last;
      const w = window.__STARHOLD_WORLD__;
      let steps = 0;
      await new Promise((resolve) => {
        function frame(now) {
          deltas.push(now - last);
          last = now;
          if (stepSim && steps++ % 2 === 0) w.step();
          if (now - start < ms) requestAnimationFrame(frame);
          else resolve();
        }
        requestAnimationFrame(frame);
      });
      deltas.sort((a, b) => a - b);
      const avg = deltas.reduce((s, d) => s + d, 0) / deltas.length;
      const p99 = deltas[Math.floor(deltas.length * 0.99)] ?? avg;
      const p = window.__STARHOLD__;
      return {
        avgFrameMs: Math.round(avg * 100) / 100,
        p99FrameMs: Math.round(p99 * 100) / 100,
        framesWorseThan45fps: deltas.filter((d) => d > 22).length,
        ents: p.ents,
        rendererInfo: p.rendererInfo,
      };
    },
    { ms, stepSim },
  );
}

function spawnHorde(cx, cz, count = 180) {
  return `(() => {
    const w = window.__STARHOLD_WORLD__;
    const Kind = { Fighter: 2 };
    let spawned = 0;
    for (let ring = 0; ring < 20 && spawned < ${count}; ring++) {
      for (let a = 0; a < 24 && spawned < ${count}; a++) {
        const ang = (a / 24) * Math.PI * 2;
        const x = ${cx} + Math.cos(ang) * (0.5 + ring * 0.35);
        const z = ${cz} + Math.sin(ang) * (0.5 + ring * 0.35);
        const team = spawned % 2;
        const e = w.spawn(Kind.Fighter, w.civ[team], team, x, z);
        if (e) {
          e.alive = true;
          e.hp = e.maxHp;
          e.vis = true;
          spawned++;
        }
      }
    }
    let alive = 0;
    for (const e of w.ents) if (e.alive) alive++;
    return { spawned, alive, drawn: window.__STARHOLD__.rendererInfo?.drawn ?? null };
  })()`;
}

const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

const opening = await page.evaluate(() => {
  const w = window.__STARHOLD_WORLD__;
  const p = window.__STARHOLD__;
  let helionLiving = 0,
    kryosLiving = 0,
    sparks = 0;
  for (const e of w.ents) {
    if (!e.alive) continue;
    if (e.team === 0 && e.kind === 2) helionLiving++;
    if (e.team === 1 && e.kind === 2) kryosLiving++;
  }
  for (const s of w.sparks || []) if (s.active) sparks++;
  return {
    tick: w.tick,
    version: p.version,
    ents: p.ents,
    helionLiving,
    kryosLiving,
    sparks,
    drawn: p.rendererInfo?.drawn ?? null,
    rendererInfo: p.rendererInfo,
  };
});
out.opening = opening;

const openingFps = await measureFps(page, 3000, false);
out.openingFps = openingFps;

// Off-screen horde at NW corner; camera stays on opening look-at
const offScreen = await page.evaluate(spawnHorde(4, 4));
await page.waitForTimeout(500);
const offScreenAfter = await page.evaluate(() => {
  const p = window.__STARHOLD__;
  return {
    ents: p.ents,
    drawn: p.rendererInfo?.drawn ?? null,
    rendererInfo: p.rendererInfo,
    pan: { x: window.__STARHOLD_INPUT__.pan.x, z: window.__STARHOLD_INPUT__.pan.z },
  };
});
out.offScreenHorde = { spawn: offScreen, after: offScreenAfter };
out.offScreenFps = await measureFps(page, 3000, true);

// Fresh page for on-screen horde (same count, centered on look-at)
await page.close();
const page2 = await browser.newPage({ viewport: { width: 1180, height: 820 } });
await page2.goto(URL, { waitUntil: 'networkidle' });
await page2.waitForTimeout(2500);

const openingDrawn2 = await page2.evaluate(() => window.__STARHOLD__.rendererInfo?.drawn ?? null);
const pan = await page2.evaluate(() => ({
  x: window.__STARHOLD_INPUT__.pan.x,
  z: window.__STARHOLD_INPUT__.pan.z,
}));
const onScreen = await page2.evaluate(spawnHorde(pan.x, pan.z));
await page2.waitForTimeout(500);
const onScreenAfter = await page2.evaluate(() => ({
  ents: window.__STARHOLD__.ents,
  alive: window.__STARHOLD__.ents,
  drawn: window.__STARHOLD__.rendererInfo?.drawn ?? null,
  rendererInfo: window.__STARHOLD__.rendererInfo,
}));
out.onScreenHorde = {
  openingDrawn: openingDrawn2,
  spawn: onScreen,
  after: onScreenAfter,
};
out.onScreenFps = await measureFps(page2, 3000, true);

// Pass/fail heuristics
out.verdict = {
  openingTableau:
    opening.helionLiving >= 6 &&
    opening.kryosLiving >= 2 &&
    opening.sparks >= 2 &&
    (opening.drawn ?? 0) > 20,
  openingP99: openingFps.p99FrameMs < 22,
  drawnExposed: typeof opening.rendererInfo?.drawn === 'number',
  offScreenCulled:
    offScreenAfter.drawn != null &&
    opening.drawn != null &&
    offScreenAfter.drawn <= opening.drawn + 30,
  onScreenRises:
    onScreenAfter.drawn != null &&
    openingDrawn2 != null &&
    onScreenAfter.drawn > openingDrawn2 + 80,
  offScreenP99Flat: out.offScreenFps.p99FrameMs < 22,
};

await page2.close();
await browser.close();

mkdirSync('critic/out', { recursive: true });
const path = 'critic/out/p60-probe.json';
writeFileSync(path, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log('\nWrote', path);

const v = out.verdict;
const pass = Object.values(v).every(Boolean);
process.exitCode = pass ? 0 : 1;
console.log(pass ? '\nP60 probe PASS' : '\nP60 probe FAIL', v);
