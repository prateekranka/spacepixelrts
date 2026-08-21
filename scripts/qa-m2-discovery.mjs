#!/usr/bin/env node
/** M2-B bounded browser smoke: hidden data, first sight, and persistent discovery. */

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
const P99_BUDGET_MS = 8;
const NAV_TIMEOUT_MS = 30000;
const PROBE_TIMEOUT_MS = 30000;
const SERVER_BOOT_TIMEOUT_MS = 120000;

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
  const beforePath = path.join(out, 'discovery-before.png');
  const afterPath = path.join(out, 'discovery-after.png');
  const manifest = {
    tool: 'qa-m2-discovery',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: { out, route: 'scouting', viewport: VIEWPORT, seed: EXPECTED_SEED },
    checks: {},
    captures: {},
    errors: [],
    ok: false,
  };
  let server = null;
  let browser = null;

  try {
    server = await startServer();
    console.log(`qa-m2-discovery: dev server ready at ${server.url}`);
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

    await page.goto(`${server.url}/?qa=scouting`, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Playing');
    await settleFrames(page);
    const initialQa = await probe(page);
    manifest.checks.seed = initialQa.config?.seed;
    if (initialQa.config?.seed !== EXPECTED_SEED) {
      throw new Error(`QA seed mismatch: ${initialQa.config?.seed} !== ${EXPECTED_SEED}`);
    }

    const before = await page.evaluate(() => {
      const world = globalThis.__STARHOLD_WORLD__;
      if (!world) throw new Error('__STARHOLD_WORLD__ missing');
      const center = { x: 72 * 0.5, z: 72 * 0.52 };
      const resources = world.ents
        .filter((entity) => entity.alive && entity.kind === 20 && entity.cargoType === 5)
        .sort(
          (a, b) =>
            Math.hypot(a.x - center.x, a.z - center.z) -
            Math.hypot(b.x - center.x, b.z - center.z),
        );
      const central = resources[0];
      const relic = world.ents.find(
        (entity) =>
          entity.alive &&
          entity.kind === 20 &&
          entity.cargoType === 6 &&
          Math.hypot(entity.x - (center.x - 10.8), entity.z - (center.z - 0.7)) < 4,
      );
      const rivalHall = world.ents.find((entity) => entity.alive && entity.team === 1 && entity.kind === 10);
      const scout = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === 1);
      const landmark = world.landmarks.find((entry) => entry.id === 'central-lumen-field');
      if (!central || !relic || !rivalHall || !scout || !landmark) throw new Error('discovery fixtures missing');
      return {
        central: { id: central.id, x: central.x, z: central.z, seenBy: central.seenBy, vis: central.vis },
        relic: { id: relic.id, seenBy: relic.seenBy, vis: relic.vis },
        rivalHall: { id: rivalHall.id, seenBy: rivalHall.seenBy, vis: rivalHall.vis },
        scoutId: scout.id,
        landmark: { id: landmark.id, discoveredBy: landmark.discoveredBy },
        logLength: world.discoveryLog.length,
      };
    });
    manifest.checks.before = before;
    if (before.central.seenBy & 1 || before.central.vis) throw new Error('central resource starts discovered');
    if (before.relic.seenBy & 1 || before.relic.vis) throw new Error('relic starts discovered');
    if (before.rivalHall.seenBy & 1 || before.rivalHall.vis) throw new Error('rival Core starts discovered');
    if (before.landmark.discoveredBy & 1) throw new Error('central landmark starts discovered');
    await page.screenshot({ path: beforePath, type: 'png' });
    manifest.captures.before = { file: path.basename(beforePath), image: analyzePng(beforePath) };

    const discovered = await page.evaluate(({ scoutId, centralId }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      const input = globalThis.__STARHOLD_INPUT__;
      const scout = world.ents[scoutId];
      const central = world.ents[centralId];
      scout.x = scout.px = central.x;
      scout.z = scout.pz = central.z;
      scout.vx = scout.vz = 0;
      scout.order = 0;
      scout.path = null;
      scout.pathI = 0;
      input.pan.x = central.x;
      input.pan.z = central.z;
      input.halfH = 10;
      input.view.lookAt(input.pan.x, input.pan.z);
      input.view.setZoom(input.halfH);
      world.step();
      const landmark = world.landmarks.find((entry) => entry.id === 'central-lumen-field');
      return {
        central: { seenBy: central.seenBy, vis: central.vis },
        landmark: { discoveredBy: landmark.discoveredBy },
        centralEvents: world.discoveryLog.filter((event) => event.team === 0 && event.id === central.id).length,
        landmarkEvents: world.discoveryLog.filter(
          (event) => event.team === 0 && event.id === 'central-lumen-field',
        ).length,
      };
    }, { scoutId: before.scoutId, centralId: before.central.id });
    manifest.checks.discovered = discovered;
    if (!(discovered.central.seenBy & 1) || !discovered.central.vis) throw new Error('central resource not discovered');
    if (!(discovered.landmark.discoveredBy & 1)) throw new Error('central landmark not discovered');
    if (discovered.centralEvents !== 1 || discovered.landmarkEvents !== 1) {
      throw new Error(`discovery event count ${JSON.stringify(discovered)}`);
    }
    await settleFrames(page);
    await page.screenshot({ path: afterPath, type: 'png' });
    manifest.captures.after = { file: path.basename(afterPath), image: analyzePng(afterPath) };

    const remembered = await page.evaluate(({ scoutId, centralId }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      const scout = world.ents[scoutId];
      const central = world.ents[centralId];
      scout.x = scout.px = 14.7;
      scout.z = scout.pz = 6.3;
      scout.vx = scout.vz = 0;
      scout.order = 0;
      scout.path = null;
      scout.pathI = 0;
      world.step();
      const tile = Math.floor(central.x) + Math.floor(central.z) * 72;
      return {
        seenBy: central.seenBy,
        vis: central.vis,
        currentVisible: world.visible[0][tile],
        centralEvents: world.discoveryLog.filter((event) => event.team === 0 && event.id === central.id).length,
      };
    }, { scoutId: before.scoutId, centralId: before.central.id });
    manifest.checks.remembered = remembered;
    if (!(remembered.seenBy & 1) || !remembered.vis || remembered.currentVisible !== 0) {
      throw new Error(`resource memory failed: ${JSON.stringify(remembered)}`);
    }
    if (remembered.centralEvents !== 1) throw new Error('resource discovery logged more than once');

    await settleFrames(page);
    const qa = await probe(page);
    manifest.checks.probe = {
      discoveries: qa.discoveries?.length ?? 0,
      landmarks: qa.landmarks?.length ?? 0,
      centralLandmark: qa.landmarks?.find((entry) => entry.id === 'central-lumen-field') ?? null,
    };
    if (!qa.discoveries?.some((event) => event.team === 0 && event.id === before.central.id)) {
      throw new Error('QA probe missing central resource discovery');
    }
    if (!(manifest.checks.probe.centralLandmark?.discoveredBy & 1)) {
      throw new Error('QA probe missing central landmark latch');
    }
    await page.waitForFunction(
      (budget) =>
        globalThis.__STARHAVEN_QA__?.p99FrameMs > 0 && globalThis.__STARHAVEN_QA__?.p99FrameMs < budget,
      P99_BUDGET_MS,
      { timeout: 15000 },
    );
    const perf = await probe(page);
    manifest.checks.p99FrameMs = perf.p99FrameMs;
    manifest.ok = manifest.errors.length === 0;
  } catch (error) {
    manifest.errors.push(error?.stack ?? String(error));
    manifest.ok = false;
  } finally {
    try { if (browser) await browser.close(); } catch {}
    try { await stopServer(server); } catch {}
    manifest.finishedAt = new Date().toISOString();
    const manifestPath = path.join(out, 'manifest.json');
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log('--- qa-m2-discovery summary ---');
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
