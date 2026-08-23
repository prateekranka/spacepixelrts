#!/usr/bin/env node
/** M3-A bounded browser smoke: Sunweaver Solar links on the deterministic opening route. */

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
const CADENCE_STEPS = 15;
const STREAM_STEPS = 90;

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
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => console.log(`[dev:err] ${chunk.trim()}`));
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
      once(child, 'exit').then(() => true, () => true),
      delay(4000).then(() => false),
    ]);
    if (!stopped && !server.exited && child.exitCode === null && child.signalCode !== null) {
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
  return { width: png.width, height: png.height, maxLuma: Math.round(max * 100) / 100, litRatio: Math.round(litRatio * 10000) / 10000 };
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
  const streamShot = path.join(out, 'm3a-link-streaming.png');
  const severedShot = path.join(out, 'm3a-link-severed.png');
  const manifest = {
    tool: 'qa-m3-economies',
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
    console.log(`qa-m3-economies: dev server ready at ${server.url}`);

    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
    }).catch(() => chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] }));
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(PROBE_TIMEOUT_MS);
    page.on('console', (message) => {
      if (message.type() === 'error') manifest.errors.push(`console.error: ${message.text()}`);
    });
    page.on('pageerror', (error) => manifest.errors.push(`pageerror: ${error?.message ?? String(error)}`));

    await page.goto(`${server.url}/?qa=opening&qa-run=1`, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Playing', null, { timeout: PROBE_TIMEOUT_MS });
    const entryProbe = await probe(page);
    manifest.checks.entry = {
      state: entryProbe.state,
      scenario: entryProbe.scenario,
      seed: entryProbe.config?.seed,
    };
    if (entryProbe.scenario !== 'opening') throw new Error('scenario != opening');

    // 1. Put a player worker on the base Solar node and stream one full pulse.
    const streamed = await page.evaluate((steps) => {
      const world = globalThis.__STARHOLD_WORLD__;
      if (!world) throw new Error('__STARHOLD_WORLD__ missing');
      const hall = world.ents.find((e) => e.alive && e.team === 0 && e.kind === 10);
      let node = null;
      let bestD = Infinity;
      for (const e of world.ents) {
        if (!e.alive || e.kind !== 20 || e.cargoType !== 5 /* Tile.Solar */) continue;
        const d = (e.x - hall.x) ** 2 + (e.z - hall.z) ** 2;
        if (d < bestD) { bestD = d; node = e; }
      }
      if (!node) throw new Error('base solar node missing');
      const worker = world.ents.find((e) => e.alive && e.team === 0 && e.kind === 0);
      if (!worker) throw new Error('worker missing');
      worker.x = worker.px = node.x + 0.4;
      worker.z = worker.pz = node.z + 0.4;
      worker.vx = worker.vz = 0;
      worker.order = 3;
      worker.tid = node.id;
      worker.cooldown = 0;
      worker.cargo = 0;
      const energy0 = world.teams[0].energy;
      for (let s = 0; s < steps; s++) world.step();
      const link = world.links.find((l) => l.nodeId === node.id && l.team === 0) ?? null;
      return {
        energy0,
        energy1: world.teams[0].energy,
        cargo: worker.cargo,
        linkCount: world.links.length,
        link: link ? JSON.parse(JSON.stringify(link)) : null,
        nodeHp: node.hp,
        civ0: world.civ[0],
      };
    }, STREAM_STEPS);
    manifest.checks.stream = streamed;
    if (streamed.civ0 !== 'vespari') throw new Error(`player civ is ${streamed.civ0}, expected vespari`);
    if (!streamed.link) throw new Error('no link formed after streaming window');
    if (!(streamed.energy1 > streamed.energy0)) throw new Error(`energy did not stream (${streamed.energy0} -> ${streamed.energy1})`);
    if (streamed.cargo !== 0) throw new Error(`linked worker carried cargo ${streamed.cargo}`);
    await settleFrames(page);
    await page.screenshot({ path: streamShot, type: 'png' });
    manifest.captures.stream = { file: path.basename(streamShot), image: analyzePng(streamShot) };

    // 2. Park an enemy scout on the tether midpoint; the link must sever.
    const severed = await page.evaluate((cadence) => {
      const world = globalThis.__STARHOLD_WORLD__;
      const link = world.links.find((l) => l.team === 0);
      if (!link) throw new Error('link missing before sever test');
      const node = world.ents[link.nodeId];
      const hall = world.ents[link.hallId];
      const enemy = world.spawn(1, 'aurion', 1, (node.x + hall.x) * 0.5, (node.z + hall.z) * 0.5);
      if (!enemy) throw new Error('enemy spawn failed');
      enemy.order = 0;
      const energyBefore = world.teams[0].energy;
      for (let s = 0; s < cadence; s++) world.step();
      return {
        severedUntil: link.severedUntil,
        tick: world.tick,
        energyBefore,
        energyAfter: world.teams[0].energy,
      };
    }, CADENCE_STEPS);
    manifest.checks.severed = severed;
    if (!(severed.severedUntil > severed.tick)) throw new Error('link did not sever with enemy on the tether');
    if (severed.energyAfter !== severed.energyBefore) throw new Error('energy streamed while severed');
    await settleFrames(page);
    await page.screenshot({ path: severedShot, type: 'png' });
    manifest.captures.severed = { file: path.basename(severedShot), image: analyzePng(severedShot) };

    // 3. Frame budget with the software-GL aware gate (qa-m2-ai pattern).
    const perf = await page.evaluate(() => {
      const world = globalThis.__STARHOLD_WORLD__;
      for (let i = 0; i < 120; i++) world.step();
      const t0 = performance.now();
      for (let i = 0; i < 600; i++) world.step();
      const simStepMs = Math.round(((performance.now() - t0) / 600) * 10000) / 10000;
      let renderer = 'unknown';
      try {
        const c = document.createElement('canvas');
        const g = c.getContext('webgl2') || c.getContext('webgl');
        if (g) {
          const d = g.getExtension('WEBGL_debug_renderer_info');
          renderer = d ? String(g.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'masked';
        }
      } catch { renderer = 'err'; }
      return { simStepMs, renderer };
    });
    const probeAfter = await probe(page);
    perf.p99FrameMs = probeAfter.p99FrameMs;
    const softwareGl = /swiftshader|llvmpipe|software/i.test(perf.renderer);
    manifest.checks.frameBudget = {
      ...perf,
      softwareGl,
      simShareMs: Math.round(perf.simStepMs * 5 * 10000) / 10000,
    };
    if (softwareGl) {
      if (!(perf.simStepMs * 5 < P99_BUDGET_MS)) {
        throw new Error(`sim work ${(perf.simStepMs * 5).toFixed(3)}ms exceeds budget ${P99_BUDGET_MS}ms`);
      }
    } else if (!(perf.p99FrameMs > 0 && perf.p99FrameMs < P99_BUDGET_MS)) {
      throw new Error(`p99 ${perf.p99FrameMs}ms outside budget (${P99_BUDGET_MS}ms)`);
    }

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
    console.log('--- qa-m3-economies summary ---');
    console.log(`ok=${manifest.ok}`);
    console.log(`manifest=${manifestPath}`);
    if (manifest.errors.length) {
      console.log('errors:');
      for (const err of manifest.errors) console.log(`  - ${err.split('\n')[0]}`);
    }
    if (!manifest.ok) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
