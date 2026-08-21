#!/usr/bin/env node
/** M2-A bounded browser smoke: scout long-press Move on the opening route. */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIEWPORT = { width: 1366, height: 1024 };
const EXPECTED_SEED = 0x5eed;
const LONG_PRESS_MS = 500;
const P99_BUDGET_MS = 8;
const NAV_TIMEOUT_MS = 30000;
const PROBE_TIMEOUT_MS = 30000;
const SERVER_BOOT_TIMEOUT_MS = 120000;
// Deterministic screen probes tried in order until one lands on empty terrain.
const CANDIDATE_POINTS = [
  [0.9, 0.1],
  [0.1, 0.1],
  [0.9, 0.9],
  [0.1, 0.9],
  [0.5, 0.34],
  [0.66, 0.5],
  [0.5, 0.66],
  [0.34, 0.5],
  [0.64, 0.36],
  [0.64, 0.64],
  [0.36, 0.64],
  [0.36, 0.36],
];

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index++) {
    const raw = argv[index];
    if (!raw.startsWith('--')) continue;
    const equals = raw.indexOf('=');
    if (equals >= 0) result[raw.slice(2, equals)] = raw.slice(equals + 1);
    else if (argv[index + 1] && !argv[index + 1].startsWith('--')) result[raw.slice(2)] = argv[++index];
    else result[raw.slice(2)] = true;
  }
  return result;
}

function resolveOut(raw) {
  if (typeof raw !== 'string' || raw.trim() === '' || !path.isAbsolute(raw)) {
    throw new Error('--out is required and must be an absolute path outside the repository');
  }
  const out = path.resolve(raw.trim());
  const relative = path.relative(REPO_ROOT, out);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error(`--out must be outside the repository (${REPO_ROOT})`);
  }
  return out;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('could not allocate a private QA port'));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function startServer() {
  const port = await findOpenPort();
  const url = `http://127.0.0.1:${port}`;
  const vite = path.join(REPO_ROOT, 'node_modules', '.bin', 'vite');
  const child = spawn(vite, ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: REPO_ROOT,
    detached: true,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const state = { child, url, exited: false };
  child.on('exit', () => {
    state.exited = true;
  });
  const pump = (stream, label) => {
    stream.setEncoding('utf8');
    let pending = '';
    stream.on('data', (chunk) => {
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop();
      for (const line of lines) console.log(`${label} ${line}`);
    });
    stream.on('end', () => {
      if (pending.trim()) console.log(`${label} ${pending}`);
    });
  };
  pump(child.stdout, '[dev]');
  pump(child.stderr, '[dev:err]');
  const deadline = Date.now() + SERVER_BOOT_TIMEOUT_MS;
  while (Date.now() < deadline && !state.exited) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return state;
    } catch {}
    await delay(250);
  }
  await stopServer(state);
  throw new Error(state.exited ? 'dev server exited before becoming reachable' : `Vite did not become ready at ${url}`);
}

async function stopServer(server) {
  if (!server || !server.child || server.stopped) return;
  server.stopped = true;
  const child = server.child;
  const signal = (name) => {
    if (child.pid == null || child.exitCode !== null || child.signalCode !== null) return;
    try {
      process.kill(-child.pid, name);
    } catch {
      try {
        child.kill(name);
      } catch {}
    }
  };
  if (!server.exited) {
    signal('SIGTERM');
    const stopped = await Promise.race([
      once(child, 'exit').then(
        () => true,
        () => true,
      ),
      delay(4000).then(() => false),
    ]);
    if (!stopped && !server.exited && child.exitCode === null && child.signalCode === null) {
      signal('SIGKILL');
      await Promise.race([once(child, 'exit').catch(() => {}), delay(2000)]);
    }
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
}

function analyzePng(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  if (png.width !== VIEWPORT.width || png.height !== VIEWPORT.height) {
    throw new Error(`${path.basename(file)} has wrong size ${png.width}x${png.height}`);
  }
  let max = 0;
  let lit = 0;
  let count = 0;
  for (let index = 0; index < png.data.length; index += 28) {
    const luminance = 0.2126 * png.data[index] + 0.7152 * png.data[index + 1] + 0.0722 * png.data[index + 2];
    max = Math.max(max, luminance);
    if (luminance > 10) lit++;
    count++;
  }
  const litRatio = count > 0 ? lit / count : 0;
  if (max <= 6 || litRatio < 0.002) throw new Error(`${path.basename(file)} is black or empty`);
  return {
    width: png.width,
    height: png.height,
    maxLuma: Math.round(max * 100) / 100,
    litRatio: Math.round(litRatio * 10000) / 10000,
  };
}

async function probe(page) {
  return page.evaluate(() => {
    const value = globalThis.__STARHAVEN_QA__;
    return value ? JSON.parse(JSON.stringify(value)) : null;
  });
}

async function settleFrames(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = resolveOut(args.out);
  fs.mkdirSync(out, { recursive: true });
  const shotPath = path.join(out, 'scout-long-press.png');
  const manifest = {
    tool: 'qa-m2-opening',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: { out, route: 'opening', viewport: VIEWPORT, seed: EXPECTED_SEED },
    checks: {},
    captures: {},
    errors: [],
    ok: false,
  };
  let server = null;
  let browser = null;

  try {
    server = await startServer();
    console.log(`qa-m2-opening: dev server ready at ${server.url}`);

    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
    });
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(PROBE_TIMEOUT_MS);
    page.on('console', (message) => {
      if (message.type() === 'error') manifest.errors.push(`console.error: ${message.text()}`);
    });
    page.on('pageerror', (error) => manifest.errors.push(`pageerror: ${error?.message ?? String(error)}`));

    // 1. Opening route, live simulation.
    await page.goto(`${server.url}/?qa=opening&qa-run=1`, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Playing', null, { timeout: PROBE_TIMEOUT_MS });
    const entryProbe = await probe(page);
    manifest.checks.entry = {
      state: entryProbe.state,
      scenario: entryProbe.scenario,
      seed: entryProbe.config?.seed,
      fogOfWar: entryProbe.config?.fogOfWar,
    };
    if (entryProbe.scenario !== 'opening') throw new Error(`scenario ${JSON.stringify(entryProbe.scenario)} != opening`);
    if (entryProbe.config?.seed !== EXPECTED_SEED || entryProbe.config?.map !== 'helios-rift' || entryProbe.config?.seedMode !== 'deterministic') {
      throw new Error(`unexpected deterministic config: ${JSON.stringify(entryProbe.config)}`);
    }

    // 2. Select the player scout through the accessible Scout control.
    const scoutButton = page.getByRole('button', { name: 'Scout', exact: true });
    if (!(await scoutButton.isVisible())) throw new Error('accessible Scout button not visible');
    await scoutButton.click();
    const selected = await page.evaluate(() => {
      const input = globalThis.__STARHOLD_INPUT__;
      if (!input) throw new Error('__STARHOLD_INPUT__ missing');
      const ids = [...input.selected];
      const ents = ids.map((id) => {
        const e = input.world.ents[id];
        return e ? { id, kind: e.kind, team: e.team, alive: e.alive, vis: e.vis } : null;
      });
      return { size: input.selected.size, ents };
    });
    manifest.checks.scoutSelected = selected;
    if (selected.size !== 1) throw new Error(`expected exactly one selected entity, got ${selected.size}`);
    const scoutEnt = selected.ents[0];
    if (!scoutEnt || scoutEnt.kind !== 1 || scoutEnt.team !== 0 || !scoutEnt.alive || !scoutEnt.vis) {
      throw new Error(`selected entity is not the player scout: ${JSON.stringify(scoutEnt)}`);
    }

    // Widen the QA view so a screen point can land beyond the scout's
    // initial line of sight and prove an order into unexplored terrain.
    await page.evaluate(() => {
      const input = globalThis.__STARHOLD_INPUT__;
      input.halfH = 16;
      input.view.setZoom(input.halfH);
    });

    await settleFrames(page);

    // 3. Project a deterministic empty-terrain target via the renderer pick API.
    const target = await page.evaluate((candidates) => {
      const view = globalThis.__STARHOLD_VIEW__;
      const world = globalThis.__STARHOLD_WORLD__;
      const input = globalThis.__STARHOLD_INPUT__;
      if (!view || !world || !input) throw new Error('QA handles missing');
      const scoutId = [...input.selected][0];
      const scout = world.ents[scoutId];
      for (const [nx, ny] of candidates) {
        const hit = view.pick(nx, ny);
        const wx = hit.x;
        const wz = hit.z;
        if (!(wx > 1 && wx < 72 - 1 && wz > 1 && wz < 72 - 1)) continue;
        if (Math.hypot(wx - scout.x, wz - scout.z) < 2) continue;
        const tile = Math.floor(wx) + Math.floor(wz) * 72;
        if (world.explored[0][tile]) continue;
        let blocked = false;
        for (const e of world.ents) {
          if (!e.alive) continue;
          if (Math.hypot(e.x - wx, e.z - wz) < 2) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        return {
          nx,
          ny,
          wx: Math.round(wx * 1000) / 1000,
          wz: Math.round(wz * 1000) / 1000,
          tile,
        };
      }
      return null;
    }, CANDIDATE_POINTS);
    manifest.checks.target = target;
    if (!target) throw new Error('no deterministic empty terrain target found');

    const before = await page.evaluate((scoutId) => {
      const e = globalThis.__STARHOLD_WORLD__.ents[scoutId];
      return { order: e.order, tx: e.tx, tz: e.tz };
    }, scoutEnt.id);

    // 4. Stationary 500 ms left-button hold, no movement, then release.
    await page.mouse.move(target.nx * VIEWPORT.width, target.ny * VIEWPORT.height);
    await page.mouse.down();
    await page.waitForTimeout(LONG_PRESS_MS);
    await page.mouse.up();

    // 5. The scout must carry Ord.Move toward the chosen world point.
    const after = await page.evaluate((scoutId) => {
      const world = globalThis.__STARHOLD_WORLD__;
      const e = world.ents[scoutId];
      return {
        order: e.order,
        ordMove: 1,
        tx: e.tx,
        tz: e.tz,
        selectedSize: globalThis.__STARHOLD_INPUT__.selected.size,
      };
    }, scoutEnt.id);
    manifest.checks.longPress = { before, after, target };
    if (after.selectedSize !== 1) throw new Error(`selection changed during long press: ${after.selectedSize}`);
    if (after.order !== after.ordMove) throw new Error(`scout order ${after.order} != Ord.Move (${after.ordMove})`);
    if (before.tx === after.tx && before.tz === after.tz) throw new Error('scout target did not change');
    const miss = Math.hypot(after.tx - target.wx, after.tz - target.wz);
    manifest.checks.longPress.targetMissWorldUnits = Math.round(miss * 1000) / 1000;
    if (miss > 1.5) throw new Error(`move target ${after.tx},${after.tz} is ${miss}wu from chosen ${target.wx},${target.wz}`);

    // 6. Frame budget and non-black evidence capture.
    await page.waitForFunction(
      () => globalThis.__STARHAVEN_QA__?.p99FrameMs > 0 && globalThis.__STARHAVEN_QA__?.p99FrameMs < 8,
      null,
      { timeout: 15000 },
    );
    const perfProbe = await probe(page);
    manifest.checks.p99FrameMs = perfProbe.p99FrameMs;
    manifest.checks.tick = perfProbe.tick;
    if (!(perfProbe.p99FrameMs < P99_BUDGET_MS)) {
      throw new Error(`p99 ${perfProbe.p99FrameMs}ms exceeds budget ${P99_BUDGET_MS}ms`);
    }
    await page.screenshot({ path: shotPath, type: 'png' });
    manifest.captures.scoutLongPress = { file: path.basename(shotPath), image: analyzePng(shotPath) };

    manifest.ok = manifest.errors.length === 0;
  } catch (error) {
    manifest.errors.push(error?.stack ?? String(error));
    manifest.ok = false;
  } finally {
    try {
      if (browser) await browser.close();
    } catch {}
    try {
      await stopServer(server);
    } catch {}
    manifest.finishedAt = new Date().toISOString();
    const manifestPath = path.join(out, 'manifest.json');
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log('--- qa-m2-opening summary ---');
    console.log(`ok=${manifest.ok} p99=${manifest.checks.p99FrameMs ?? 'n/a'}ms`);
    console.log(`manifest=${manifestPath}`);
    if (manifest.errors.length) {
      console.log('errors:');
      for (const err of manifest.errors) console.log(`  - ${err}`);
    }
    if (!manifest.ok) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
