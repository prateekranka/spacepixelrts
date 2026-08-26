#!/usr/bin/env node
// FRD acceptance E2E — docs/FORGE_REVIEW_DECK.md 'Acceptance E2E'.
//
// 1. start the real game (vite dev server)
// 2. open the workbench path (forge control injected on game pages)
// 3. assert exactly one live game canvas
// 4. select deterministic route + seed 424242
// 5. confirm actual runtime seed is 424242
// 6. change camera mode; change perspective
// 7. freeze; step the frozen simulation; tick advances by the requested amount
// 8. enable at least one overlay
// 9. produce a capture
// 10. zero console/page errors
// 11. exit with zero leaked vite/chromium/helper processes
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { launchBrowser } from '../tools/forge-review/lib/browser.mjs';
import { startDevServer, stopDevServer } from '../tools/forge-review/lib/server.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = 424242;
const ROUTE = 'opening';
const STEP_TICKS = 37;
const NAV_TIMEOUT_MS = 30000;
const PROBE_TIMEOUT_MS = 20000;

const results = [];
const consoleLog = [];
let failed = false;

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  if (!pass) failed = true;
  console.log(`qa-forge-review: ${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(message) {
  console.error(`qa-forge-review: ${message}`);
  process.exit(1);
}

function resolveOut(raw) {
  const abs = path.resolve(String(raw));
  const rel = path.relative(REPO_ROOT, abs);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    fail('--out must be outside the repository');
  }
  return abs;
}

function parseArgs(argv) {
  const opts = { out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith('--')) continue;
    const eq = raw.indexOf('=');
    const key = eq === -1 ? raw.slice(2) : raw.slice(2, eq);
    opts[key] = eq !== -1 ? raw.slice(eq + 1) : true;
  }
  return opts;
}

async function settle(page, frames = 2) {
  await page.evaluate(
    (n) =>
      new Promise((resolve) => {
        let left = n;
        const tick = () => (left-- <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    frames,
  );
}

async function snapshot(page) {
  return page.evaluate(() => {
    const c = globalThis.__STARHAVEN_FORGE__;
    if (!c) return null;
    return JSON.parse(JSON.stringify(c.snapshot()));
  });
}

function countGameCanvases(page) {
  return page.evaluate(() => document.querySelectorAll('canvas#game').length);
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const outDir = argv.out ? resolveOut(argv.out) : fs.mkdtempSync(path.join(os.tmpdir(), 'frd-qa-'));
  fs.mkdirSync(outDir, { recursive: true });

  let server = null;
  let browser = null;
  try {
    server = await startDevServer({ quiet: true });
    browser = await launchBrowser();
    const context = await browser.newContext({ viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 1 });
    const errors = [];
    const page = await context.newPage();
    page.on('console', (msg) => {
      const line = `[${msg.type()}] ${msg.text()}`;
      consoleLog.push(line);
      if (msg.type() === 'error') errors.push(line);
    });
    page.on('pageerror', (err) => {
      const line = `[pageerror] ${err?.message ?? String(err)}`;
      consoleLog.push(line);
      errors.push(line);
    });

    // workbench path: forge=1 turns the injected dev panel on; qa route loads the real game
    const url = `${server.url}/?qa=${ROUTE}&qa-seed=${SEED}&orientation=landscape-left&forge=1`;
    await page.setViewportSize({ width: 1366, height: 1024 });
    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(() => Boolean(globalThis.__STARHAVEN_QA__), null, { timeout: PROBE_TIMEOUT_MS });

    // 1. one live game view
    record('single live game canvas', (await countGameCanvases(page)) === 1);

    // 2. deterministic route selected
    let snap = await snapshot(page);
    record('forge control installed', Boolean(snap), snap ? '' : '__STARHAVEN_FORGE__ missing');
    if (!snap) throw new Error('forge control unavailable — cannot continue acceptance');
    record('deterministic route selected', snap.scenario === ROUTE, `scenario=${snap.scenario}`);

    // 3. seed propagation
    record('requested seed recorded', snap.requestedSeed === SEED, `requested=${snap.requestedSeed}`);
    record('actual runtime seed matches', snap.actualSeed === SEED, `actual=${snap.actualSeed}`);

    // 4. camera mode change without reload
    const urlBeforeCamera = page.url();
    await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.setCameraMode('tactical-close'));
    await settle(page, 3);
    snap = await snapshot(page);
    record('camera mode applied', snap.cameraMode === 'tactical-close' && Math.abs(snap.camera.halfH - 5) < 0.01,
      `mode=${snap.cameraMode} halfH=${snap.camera.halfH}`);
    record('camera change did not reload', page.url() === urlBeforeCamera);

    // 5. perspective change without reload, display-only
    await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.setPerspective('rival'));
    await settle(page, 3);
    snap = await snapshot(page);
    record('perspective applied', snap.perspective === 'rival', `perspective=${snap.perspective}`);
    record('perspective did not reload', page.url() === urlBeforeCamera);

    // 6. freeze + step determinism
    await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.setFrozen(true));
    const beforeStep = await snapshot(page);
    await page.evaluate((n) => globalThis.__STARHAVEN_FORGE__.step(n), STEP_TICKS);
    await settle(page, 2);
    const afterStep = await snapshot(page);
    record('frozen flag set', afterStep.frozen === true);
    record('tick advanced by requested amount',
      afterStep.tick - beforeStep.tick === STEP_TICKS,
      `before=${beforeStep.tick} after=${afterStep.tick} delta=${afterStep.tick - beforeStep.tick}`);

    // 7. overlay toggle
    await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.setOverlay('entity-ids', true));
    await settle(page, 3);
    snap = await snapshot(page);
    record('overlay enabled', snap.overlays['entity-ids'] === true);

    // 8. capture
    const shotPath = path.join(outDir, 'acceptance.png');
    await page.screenshot({ path: shotPath, type: 'png' });
    const png = PNG.sync.read(fs.readFileSync(shotPath));
    record('capture exists at exact viewport', png.width === 1366 && png.height === 1024, `${png.width}x${png.height}`);
    let maxLuma = 0;
    for (let i = 0; i < png.data.length; i += 4 * 13) {
      const lum = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      if (lum > maxLuma) maxLuma = lum;
    }
    record('capture not black', maxLuma > 6, `maxLuma=${Math.round(maxLuma)}`);

    // 9. metrics fields distinct
    const metrics = await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.metrics());
    record('metrics expose both p99 fields separately',
      typeof metrics.gameWorkP99Ms === 'number' && typeof metrics.rafP99Ms === 'number'
        && !(metrics.gameWorkP99Ms === metrics.rafP99Ms && metrics.gameWorkP99Ms !== 0),
      JSON.stringify(metrics));

    // 10. zero console/page errors across the whole session
    record('zero console/page errors', errors.length === 0, errors.slice(0, 4).join(' | '));

    await page.close();
    await context.close();
  } catch (err) {
    failed = true;
    record('acceptance run completed', false, err?.stack ?? String(err));
  } finally {
    try { if (browser) await browser.close(); } catch {}
    try { if (server) await stopDevServer(server); } catch {}
  }

  // 11. process-leak check: no vite/chromium/helper processes may remain that we spawned.
  // We detect leaks as chromium/vite processes whose command line references our repo and
  // which are not this test's own process tree (our children were reaped in finally).
  await new Promise((resolve) => setTimeout(resolve, 800));
  let leakOutput = '';
  try {
    const { execFileSync } = await import('node:child_process');
    leakOutput = execFileSync('pgrep', ['-af', 'chromium|vite'], { encoding: 'utf8' });
  } catch {
    leakOutput = '';
  }
  const leaked = leakOutput
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    // Only THIS working tree counts: other checkouts (e.g. a separate
    // spacepixelrts-forge-art-lab worktree) are someone else's processes.
    .filter((line) => line.includes('/workspace/spacepixelrts/') || /vite --host 127\.0\.0\.1 --port \d+ .*spacepixelrts(?!-)/.test(line))
    .filter((line) => !/pgrep/.test(line));
  record('no leaked vite/chromium processes', leaked.length === 0, leaked.join(' ; ').slice(0, 300));

  fs.writeFileSync(path.join(outDir, 'console.txt'), consoleLog.join('\n'));
  const summary = { ok: !failed, results };
  fs.writeFileSync(path.join(outDir, 'qa-forge-review.json'), JSON.stringify(summary, null, 2));
  console.log(`--- qa-forge-review summary ---`);
  console.log(`ok=${summary.ok} passed=${results.filter((r) => r.pass).length}/${results.length}`);
  console.log(`artifacts=${outDir}`);
  if (!summary.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`qa-forge-review: fatal: ${err?.stack ?? err}`);
  process.exitCode = 1;
});
