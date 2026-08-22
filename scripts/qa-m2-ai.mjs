#!/usr/bin/env node
/** M2-D bounded browser smoke: AI imperfect knowledge under fog on the frozen opening route. */

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
const STEP_CHUNKS = 30;
const STEPS_PER_CHUNK = 90; // 2700 steps = 90 sim-seconds at 30 fps
const SEEN_RIVAL = 2;

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
  const beforeShot = path.join(out, 'm2d-ai-before.png');
  const afterShot = path.join(out, 'm2d-ai-after.png');
  const manifest = {
    tool: 'qa-m2-ai',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: { out, route: 'opening', frozen: false, viewport: VIEWPORT, seed: EXPECTED_SEED },
    checks: {},
    captures: {},
    errors: [],
    ok: false,
  };
  let server = null;
  let browser = null;

  try {
    server = await startServer();
    console.log(`qa-m2-ai: dev server ready at ${server.url}`);

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

    // 1. Frozen deterministic opening route.
    await page.goto(`${server.url}/?qa=opening&qa-run=1`, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Playing', null, { timeout: PROBE_TIMEOUT_MS });
    const entryProbe = await probe(page);
    manifest.checks.entry = {
      state: entryProbe.state,
      scenario: entryProbe.scenario,
      frozen: entryProbe.frozen,
      seed: entryProbe.config?.seed,
      fogOfWar: entryProbe.config?.fogOfWar,
    };
    if (entryProbe.scenario !== 'opening') throw new Error(`scenario != opening`);
    if (
      entryProbe.config?.seed !== EXPECTED_SEED ||
      entryProbe.config?.seedMode !== 'deterministic' ||
      entryProbe.config?.fogOfWar !== true
    ) {
      throw new Error(`unexpected config: ${JSON.stringify(entryProbe.config)}`);
    }

    // 2. Baseline audit state.
    const readAudit = () =>
      page.evaluate((seenRival) => {
        const world = globalThis.__STARHOLD_WORLD__;
        if (!world) throw new Error('__STARHOLD_WORLD__ missing');
        let workers = 0;
        let gathering = 0;
        let unknownResourceTargets = 0;
        let hiddenCoreVisible = 0;
        let explored = 0;
        for (let i = 0; i < world.explored[1].length; i++) explored += world.explored[1][i];
        for (const e of world.ents) {
          if (!e.alive) continue;
          if (e.team === 1 && e.kind === 0 /* Worker */) {
            workers++;
            if (e.order === 3 /* Gather */ || e.order === 4 /* Return */) {
              gathering++;
              if (e.tid >= 0) {
                const node = world.ents[e.tid];
                if (node?.alive && node.kind === 20 /* Resource */ && (node.seenBy & seenRival) === 0) {
                  unknownResourceTargets++;
                }
              }
            }
          }
          if (e.team === 0 && e.kind === 10 /* Hall */) {
            const idx = Math.floor(e.z) * 72 + Math.floor(e.x);
            if (world.visible[1][idx] === 1) hiddenCoreVisible++;
          }
        }
        let sieges = 0;
        for (const e of world.ents) if (e.alive && e.team === 1 && e.kind === 3) sieges++;
        return {
          tick: world.tick,
          workers,
          gathering,
          unknownResourceTargets,
          hiddenCoreVisible,
          explored,
          scriptedMarshalEnabled: world.scriptedMarshalEnabled,
          eco: JSON.parse(JSON.stringify(world.teams[1])),
          sieges,
        };
      }, SEEN_RIVAL);

    await settleFrames(page);
    manifest.checks.before = await readAudit();
    await page.screenshot({ path: beforeShot, type: 'png' });
    manifest.captures.before = { file: path.basename(beforeShot), image: analyzePng(beforeShot) };

    // 3. Step exactly 90 sim-seconds in public chunks.
    for (let c = 0; c < STEP_CHUNKS; c++) {
      await page.evaluate((steps) => {
        const world = globalThis.__STARHOLD_WORLD__;
        if (!world) throw new Error('__STARHOLD_WORLD__ missing');
        for (let s = 0; s < steps; s++) world.step();
      }, STEPS_PER_CHUNK);
    }

    // 4. Post-window audit.
    await settleFrames(page);
    const stepped = await readAudit();
    const perfProbe = await probe(page);
    stepped.p99FrameMs = perfProbe.p99FrameMs;
    stepped.entities = perfProbe.entities;
    // Deterministic sim-cost probe: average world.step() over 600 steps.
    stepped.simStepMs = await page.evaluate(() => {
      const world = globalThis.__STARHOLD_WORLD__;
      if (!world) throw new Error('__STARHOLD_WORLD__ missing');
      for (let i = 0; i < 120; i++) world.step();
      const t0 = performance.now();
      for (let i = 0; i < 600; i++) world.step();
      return Math.round(((performance.now() - t0) / 600) * 10000) / 10000;
    });
    stepped.renderer = await page.evaluate(() => {
      try {
        const c = document.createElement('canvas');
        const g = c.getContext('webgl2') || c.getContext('webgl');
        if (!g) return 'none';
        const d = g.getExtension('WEBGL_debug_renderer_info');
        return d ? String(g.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'masked';
      } catch {
        return 'err';
      }
    });
    stepped.softwareGl = /swiftshader|llvmpipe|software/i.test(stepped.renderer);
    manifest.checks.stepped90 = stepped;
    await page.screenshot({ path: afterShot, type: 'png' });
    manifest.captures.after = { file: path.basename(afterShot), image: analyzePng(afterShot) };

    if (stepped.scriptedMarshalEnabled !== false) throw new Error('scripted marshal must stay off');
    if (stepped.workers < 4) throw new Error(`expected at least four AI workers, got ${stepped.workers}`);
    if (stepped.gathering < 1) throw new Error('no AI worker was gathering during the audit');
    if (stepped.unknownResourceTargets !== 0) {
      throw new Error(`AI targeted unknown resources ${stepped.unknownResourceTargets} times`);
    }
    if (stepped.hiddenCoreVisible !== 0) throw new Error('player Core visible to AI without scouting');
    if (stepped.explored <= manifest.checks.before.explored) {
      throw new Error(`rival exploration did not grow (${manifest.checks.before.explored} -> ${stepped.explored})`);
    }
    if (stepped.sieges !== 0) throw new Error('free Siege spawned with cheats off');

    // 5. Frame budget. Hardware-GL environments gate the live-loop p99 directly.
    // Software-GL environments (CI containers, SwiftShader/llvmpipe) cannot measure
    // render cost meaningfully; they gate the sim-work share instead (max 5 steps
    // of fixed timestep per rendered frame must fit the budget).
    if (stepped.softwareGl) {
      const simShareMs = stepped.simStepMs * 5;
      if (!(simShareMs < P99_BUDGET_MS)) {
        throw new Error(`sim work ${simShareMs.toFixed(3)}ms exceeds budget ${P99_BUDGET_MS}ms`);
      }
      manifest.checks.frameBudget = {
        mode: 'sim-share (software GL)',
        simStepMs: stepped.simStepMs,
        simShareMs: Math.round(simShareMs * 10000) / 10000,
        renderP99RecordedNotGated: stepped.p99FrameMs,
        renderer: stepped.renderer,
      };
    } else {
      if (!(stepped.p99FrameMs > 0 && stepped.p99FrameMs < P99_BUDGET_MS)) {
        throw new Error(`p99 ${stepped.p99FrameMs}ms outside budget (${P99_BUDGET_MS}ms)`);
      }
      manifest.checks.frameBudget = { mode: 'render-p99', p99FrameMs: stepped.p99FrameMs };
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
    console.log('--- qa-m2-ai summary ---');
    console.log(`ok=${manifest.ok} p99=${manifest.checks.stepped90?.p99FrameMs ?? 'n/a'}ms`);
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
