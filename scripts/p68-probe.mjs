/**
 * P68 — civ picker + Nihiline on canvas probes.
 * Usage: node scripts/p68-probe.mjs [--url URL]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.argv.includes('--url')
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

const out = { base: BASE, judgedAt: new Date().toISOString() };

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

async function openingProbe(page) {
  return page.evaluate(() => {
    const w = window.__STARHOLD_WORLD__;
    const p = window.__STARHOLD__;
    let helionLiving = 0;
    let kryosLiving = 0;
    let shadeLiving = 0;
    let sparks = 0;
    for (const e of w.ents) {
      if (!e.alive) continue;
      if (e.team === 0 && e.kind === 2) helionLiving++;
      if (e.team === 1 && e.kind === 2) kryosLiving++;
      if (e.kind === 6 && e.hp > 0) shadeLiving++;
    }
    for (const s of w.sparks || []) if (s.active) sparks++;
    return {
      version: p.version,
      civ: p.civ,
      tick: w.tick,
      helionLiving,
      kryosLiving,
      shadeLiving,
      sparks,
      hitSfx: p.hitSfx ?? 0,
      civPickerTiles: document.querySelectorAll('#civpick .civ-tile').length,
    };
  });
}

// --- Default boot (bare URL) ---
{
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  out.default = await openingProbe(page);
  out.default.p99FrameMs = await measureFps(page);
  out.default.pass =
    out.default.version === '0.6.0-wave5' &&
    out.default.civ[0] === 'vespari' &&
    out.default.civ[1] === 'aurion' &&
    out.default.helionLiving >= 8 &&
    out.default.kryosLiving >= 2 &&
    out.default.civPickerTiles === 3 &&
    out.default.p99FrameMs < 22;
  await page.screenshot({ path: 'critic/out/p68-default.png' });
  await page.close();
}

// --- URL probe ?civ=voidmarked ---
{
  const url = `${BASE}${BASE.includes('?') ? '&' : '?'}civ=voidmarked`;
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  out.voidmarkedUrl = await openingProbe(page);
  out.voidmarkedUrl.p99FrameMs = await measureFps(page);
  out.voidmarkedUrl.pass =
    out.voidmarkedUrl.civ.includes('voidmarked') &&
    out.voidmarkedUrl.shadeLiving >= 1 &&
    out.voidmarkedUrl.p99FrameMs < 22;
  await page.screenshot({ path: 'critic/out/p68-voidmarked.png' });
  await page.close();
}

// --- Picker click Nihiline on default boot ---
{
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.click('#civpick button[data-civ="voidmarked"]');
  await page.waitForTimeout(2500);
  out.pickerVoidmarked = await openingProbe(page);
  out.pickerVoidmarked.pass =
    out.pickerVoidmarked.civ.includes('voidmarked') &&
    out.pickerVoidmarked.shadeLiving >= 1;
  await page.close();
}

await browser.close();

out.allPass =
  out.default?.pass &&
  out.voidmarkedUrl?.pass &&
  out.pickerVoidmarked?.pass;

mkdirSync('critic/out', { recursive: true });
writeFileSync('critic/out/p68-probe.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(out.allPass ? 0 : 1);
