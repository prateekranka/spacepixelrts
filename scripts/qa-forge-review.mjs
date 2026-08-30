#!/usr/bin/env node
// FRD acceptance E2E — docs/FORGE_REVIEW_DECK.md 'Acceptance E2E'.
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
const FORGE_WAIT_MS = 15000;

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

async function authorityFingerprint(page) {
  return page.evaluate(() => {
    const world = globalThis.__STARHOLD_WORLD__;
    if (!world) return null;
    const entities = [];
    for (let i = 0; i < world.ents.length; i += 1) {
      const ent = world.ents[i];
      if (!ent.alive) continue;
      entities.push([
        i,
        ent.kind,
        Math.round(ent.x * 1000) / 1000,
        Math.round(ent.z * 1000) / 1000,
        ent.team,
        ent.order,
        ent.tid,
        ent.tx,
        ent.tz,
        ent.hp,
      ]);
    }
    entities.sort((a, b) => a[0] - b[0]);
    return JSON.stringify({
      tick: world.tick,
      winner: world.winner,
      teams: world.teams.map((team) => ({
        ore: team.ore,
        gas: team.gas,
        chg: team.chg,
        pop: team.pop,
      })),
      visible: Array.from(world.visible),
      explored: Array.from(world.explored),
      entities,
    });
  });
}

async function waitForForge(page) {
  await page.waitForFunction(() => Boolean(globalThis.__STARHAVEN_FORGE__), null, {
    timeout: FORGE_WAIT_MS,
  });
}

async function waitForWarmMetrics(page, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const metrics = await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.metrics());
    if (metrics.rafSamples >= 120 && metrics.rafP99Ms > 0 && metrics.gameWorkP99Ms > 0) return metrics;
    await page.waitForTimeout(200);
  }
  return page.evaluate(() => globalThis.__STARHAVEN_FORGE__.metrics());
}

async function captureSteppedIdentity(page, serverUrl) {
  const routeUrl = `${serverUrl}/?qa=${ROUTE}&qa-seed=${SEED}&orientation=landscape-left&forge=1`;
  await page.goto(routeUrl, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
  await page.waitForFunction(() => Boolean(globalThis.__STARHAVEN_QA__), null, { timeout: PROBE_TIMEOUT_MS });
  await waitForForge(page);
  await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.setFrozen(true));
  await settle(page, 6);
  await page.evaluate((n) => globalThis.__STARHAVEN_FORGE__.step(n), STEP_TICKS);
  await settle(page, 2);
  return authorityFingerprint(page);
}

async function runDevAcceptance(page, serverUrl, errors, outDir) {
  const url = `${serverUrl}/?qa=${ROUTE}&qa-seed=${SEED}&orientation=landscape-left&forge=1`;
  await page.setViewportSize({ width: 1366, height: 1024 });
  await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
  await page.waitForFunction(() => Boolean(globalThis.__STARHAVEN_QA__), null, { timeout: PROBE_TIMEOUT_MS });
  await waitForForge(page);

  record('single live game canvas', (await countGameCanvases(page)) === 1);

  let snap = await snapshot(page);
  record('forge control installed', Boolean(snap));
  if (!snap) throw new Error('forge control unavailable — cannot continue acceptance');
  record('deterministic route selected', snap.scenario === ROUTE, `scenario=${snap.scenario}`);
  record('route starts frozen', snap.frozen === true, `frozen=${snap.frozen}`);
  record('requested seed recorded', snap.requestedSeed === SEED, `requested=${snap.requestedSeed}`);
  record('actual runtime seed matches', snap.actualSeed === SEED, `actual=${snap.actualSeed}`);

  const urlBeforeCamera = page.url();
  const authorityBeforeDisplay = await authorityFingerprint(page);
  const openingHalfH = snap.camera.halfH;
  await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.setCameraMode('tactical-close'));
  await settle(page, 3);
  snap = await snapshot(page);
  record(
    'camera mode applied',
    snap.cameraMode === 'tactical-close' && Math.abs(snap.camera.halfH - 5) < 0.01,
    `mode=${snap.cameraMode} halfH=${snap.camera.halfH}`,
  );
  record('camera change did not reload', page.url() === urlBeforeCamera);

  await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.setCameraMode('strategic-far'));
  await settle(page, 3);
  snap = await snapshot(page);
  record(
    'strategic-far camera applied',
    snap.cameraMode === 'strategic-far' && Math.abs(snap.camera.halfH - 18) < 0.01,
    `mode=${snap.cameraMode} halfH=${snap.camera.halfH}`,
  );

  await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.setCameraMode('normal'));
  await settle(page, 3);
  snap = await snapshot(page);
  record(
    'normal camera restores original halfH after close and far',
    snap.cameraMode === 'normal' && Math.abs(snap.camera.halfH - openingHalfH) < 0.01,
    `mode=${snap.cameraMode} halfH=${snap.camera.halfH} expected=${openingHalfH}`,
  );

  await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.setPerspective('rival'));
  await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.setReviewFog(false));
  await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.setUiVisible(false));
  await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.selectScout());
  await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.setOverlay('paths', true));
  await settle(page, 4);
  snap = await snapshot(page);
  record('perspective applied', snap.perspective === 'rival', `perspective=${snap.perspective}`);
  const authorityAfterDisplay = await authorityFingerprint(page);
  record(
    'display-only review state leaves authoritative world unchanged',
    authorityBeforeDisplay === authorityAfterDisplay,
    authorityBeforeDisplay === authorityAfterDisplay ? '' : 'authority fingerprint changed',
  );

  await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.setFrozen(true));
  const beforeFreezeHold = await snapshot(page);
  await page.waitForTimeout(600);
  const afterFreezeHold = await snapshot(page);
  record(
    'freeze holds across real time',
    afterFreezeHold.frozen === true && afterFreezeHold.tick === beforeFreezeHold.tick,
    `before=${beforeFreezeHold.tick} after=${afterFreezeHold.tick}`,
  );

  const beforeStep = await snapshot(page);
  await page.evaluate((n) => globalThis.__STARHAVEN_FORGE__.step(n), STEP_TICKS);
  await settle(page, 2);
  const afterStep = await snapshot(page);
  record('frozen flag set', afterStep.frozen === true);
  record(
    'tick advanced by requested amount',
    afterStep.tick - beforeStep.tick === STEP_TICKS,
    `before=${beforeStep.tick} after=${afterStep.tick} delta=${afterStep.tick - beforeStep.tick}`,
  );

  const tickBeforeInvalid = afterStep.tick;
  await page.evaluate(() => {
    globalThis.__STARHAVEN_FORGE__.step(0);
    globalThis.__STARHAVEN_FORGE__.step(-5);
    globalThis.__STARHAVEN_FORGE__.step(Number.NaN);
  });
  const afterInvalid = await snapshot(page);
  record(
    'invalid step counts do not advance tick',
    afterInvalid.tick === tickBeforeInvalid,
    `before=${tickBeforeInvalid} after=${afterInvalid.tick}`,
  );

  await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.setFrozen(false));
  const tickBeforeUnfreeze = afterStep.tick;
  await settle(page, 12);
  const afterUnfreeze = await snapshot(page);
  record(
    'unfreeze resumes normal advance',
    afterUnfreeze.frozen === false && afterUnfreeze.tick > tickBeforeUnfreeze,
    `before=${tickBeforeUnfreeze} after=${afterUnfreeze.tick}`,
  );

  const identityA = await captureSteppedIdentity(page, serverUrl);
  const identityB = await captureSteppedIdentity(page, serverUrl);
  record(
    'deterministic identity readback repeats for same seed/route/step',
    identityA === identityB,
    identityA === identityB ? '' : 'identity fingerprints diverged',
  );

  await page.goto(`${serverUrl}/?qa=${ROUTE}&qa-seed=${SEED}&orientation=landscape-left&forge=1`, {
    waitUntil: 'load',
    timeout: NAV_TIMEOUT_MS,
  });
  await page.waitForFunction(() => Boolean(globalThis.__STARHAVEN_QA__), null, { timeout: PROBE_TIMEOUT_MS });
  await waitForForge(page);

  await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.setOverlay('entity-ids', true));
  await settle(page, 3);
  snap = await snapshot(page);
  record('overlay enabled', snap.overlays['entity-ids'] === true);

  const warmedMetrics = await waitForWarmMetrics(page);
  record(
    'positive raf p99 after warm ring',
    warmedMetrics.rafP99Ms > 0 && warmedMetrics.gameWorkP99Ms > 0 && warmedMetrics.rafSamples >= 120,
    JSON.stringify(warmedMetrics),
  );

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

  const metrics = await page.evaluate(() => globalThis.__STARHAVEN_FORGE__.metrics());
  record(
    'metrics expose both p99 fields separately',
    typeof metrics.gameWorkP99Ms === 'number'
      && typeof metrics.rafP99Ms === 'number'
      && !(metrics.gameWorkP99Ms === metrics.rafP99Ms && metrics.gameWorkP99Ms !== 0),
    JSON.stringify(metrics),
  );

  record('zero console/page errors', errors.length === 0, errors.slice(0, 4).join(' | '));
}

async function runProductionIsolation(context, previewUrl) {
  const prodErrors = [];
  const page = await context.newPage();
  page.on('console', (msg) => {
    const line = `[prod ${msg.type()}] ${msg.text()}`;
    consoleLog.push(line);
    if (msg.type() === 'error') prodErrors.push(line);
  });
  page.on('pageerror', (err) => {
    const line = `[prod pageerror] ${err?.message ?? String(err)}`;
    consoleLog.push(line);
    prodErrors.push(line);
  });
  await page.goto(`${previewUrl}/?forge=1`, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
  await page.waitForFunction(() => Boolean(globalThis.__STARHAVEN_QA__), null, { timeout: PROBE_TIMEOUT_MS });
  await page.waitForTimeout(500);
  const prodState = await page.evaluate(() => ({
    hasForgeGlobal: Boolean(globalThis.__STARHAVEN_FORGE__),
    hasForgePanel: Boolean(document.querySelector('[data-forge-panel], .fr-panel, #forge-review-panel')),
    hasForgeTitle: document.body?.textContent?.includes('FORGE REVIEW') ?? false,
  }));
  record('production ?forge=1 has no forge global', prodState.hasForgeGlobal === false);
  record('production ?forge=1 has no forge panel', prodState.hasForgePanel === false);
  record('production ?forge=1 has no forge title text', prodState.hasForgeTitle === false);
  record('production preview has zero console/page errors', prodErrors.length === 0, prodErrors.slice(0, 4).join(' | '));
  await page.close();
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const outDir = argv.out ? resolveOut(argv.out) : fs.mkdtempSync(path.join(os.tmpdir(), 'frd-qa-'));
  fs.mkdirSync(outDir, { recursive: true });

  if (!fs.existsSync(path.join(REPO_ROOT, 'dist', 'index.html'))) {
    fail('dist/ missing — run npm run build before qa:forge-review');
  }
  let server = null;
  let previewServer = null;
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

    await page.goto(server.url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await runDevAcceptance(page, server.url, errors, outDir);
    await page.close();

    previewServer = await startDevServer({ quiet: true, mode: 'preview' });
    await runProductionIsolation(context, previewServer.url);
    await context.close();
  } catch (err) {
    failed = true;
    record('acceptance run completed', false, err?.stack ?? String(err));
  } finally {
    try { if (browser) await browser.close(); } catch {}
    try { if (server) await stopDevServer(server); } catch {}
    try { if (previewServer) await stopDevServer(previewServer); } catch {}
  }

  await new Promise((resolve) => setTimeout(resolve, 800));
  let leakOutput = '';
  try {
    const { execFileSync } = await import('node:child_process');
    leakOutput = execFileSync('pgrep', ['-af', 'chromium|vite'], { encoding: 'utf8' });
  } catch {
    leakOutput = '';
  }
  const repoMarker = REPO_ROOT.replace(/\\/g, '/');
  const leaked = leakOutput
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => line.includes(repoMarker))
    .filter((line) => /(?:^|\/)vite\b|chromium/i.test(line))
    .filter((line) => !/pgrep|cursor-agent/.test(line));
  record('no leaked vite/chromium processes', leaked.length === 0, leaked.join(' ; ').slice(0, 300));

  fs.writeFileSync(path.join(outDir, 'console.txt'), consoleLog.join('\n'));
  const summary = { ok: !failed, results };
  fs.writeFileSync(path.join(outDir, 'qa-forge-review.json'), JSON.stringify(summary, null, 2));
  console.log('--- qa-forge-review summary ---');
  console.log(`ok=${summary.ok} passed=${results.filter((r) => r.pass).length}/${results.length}`);
  console.log(`artifacts=${outDir}`);
  if (!summary.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`qa-forge-review: fatal: ${err?.stack ?? err}`);
  process.exitCode = 1;
});
