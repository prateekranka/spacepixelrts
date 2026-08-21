#!/usr/bin/env node
/** M2-C bounded browser smoke: contextual opening guidance on the frozen opening route. */

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
const GUIDANCE_TEXT = {
  selectScout: 'Select your scout',
  exploreSignal: 'Explore the nearby signal',
  objectivePrimary: 'A shared Lumen field has been discovered',
  objectiveSecondary: 'The enemy may contest this location',
};

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

async function readGuidance(page) {
  return page.evaluate(() => {
    const element = document.querySelector('#guidance');
    if (!element) throw new Error('#guidance missing');
    return {
      id: element.dataset.state ?? '',
      primary: element.querySelector('strong')?.textContent ?? '',
      secondary: element.querySelector('span')?.textContent ?? '',
    };
  });
}

async function readGuidanceTarget(page) {
  return page.evaluate(() => {
    const element = document.querySelector('#guidance-target');
    if (!element) throw new Error('#guidance-target missing');
    const rect = element.getBoundingClientRect();
    return {
      hidden: element.hidden || getComputedStyle(element).display === 'none',
      label: element.querySelector('span')?.textContent ?? '',
      offscreen: element.dataset.offscreen ?? '',
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
    };
  });
}

async function readSelection(page) {
  return page.evaluate(() => {
    const input = globalThis.__STARHOLD_INPUT__;
    if (!input) throw new Error('__STARHOLD_INPUT__ missing');
    const ents = [...input.selected].map((id) => {
      const entity = input.world.ents[id];
      return entity ? { id, kind: entity.kind, team: entity.team, alive: entity.alive, hp: entity.hp, vis: entity.vis } : null;
    });
    return { size: input.selected.size, ents };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = resolveOut(args.out);
  fs.mkdirSync(out, { recursive: true });
  const selectShotPath = path.join(out, 'guidance-select-scout.png');
  const exploreShotPath = path.join(out, 'guidance-explore-signal.png');
  const foundShotPath = path.join(out, 'guidance-objective-found.png');
  const manifest = {
    tool: 'qa-m2-guidance',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: { out, route: 'opening', frozen: true, viewport: VIEWPORT, seed: EXPECTED_SEED },
    checks: {},
    captures: {},
    errors: [],
    ok: false,
  };
  let server = null;
  let browser = null;

  try {
    server = await startServer();
    console.log(`qa-m2-guidance: dev server ready at ${server.url}`);

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

    // 1. Frozen opening route: scenario boots to Playing without advancing the simulation.
    await page.goto(`${server.url}/?qa=opening`, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Playing', null, { timeout: PROBE_TIMEOUT_MS });
    const entryProbe = await probe(page);
    manifest.checks.entry = {
      state: entryProbe.state,
      scenario: entryProbe.scenario,
      frozen: entryProbe.frozen,
      seed: entryProbe.config?.seed,
      seedMode: entryProbe.config?.seedMode,
      map: entryProbe.config?.map,
      fogOfWar: entryProbe.config?.fogOfWar,
    };
    if (entryProbe.scenario !== 'opening') throw new Error(`scenario ${JSON.stringify(entryProbe.scenario)} != opening`);
    if (entryProbe.frozen !== true) throw new Error('QA route is not frozen (qa-run leaked into config)');
    if (
      entryProbe.config?.seed !== EXPECTED_SEED ||
      entryProbe.config?.seedMode !== 'deterministic' ||
      entryProbe.config?.map !== 'helios-rift'
    ) {
      throw new Error(`unexpected deterministic config: ${JSON.stringify(entryProbe.config)}`);
    }

    // 2. Nothing selected: guidance asks for the scout.
    await settleFrames(page);
    const initialGuidance = await readGuidance(page);
    const initialTarget = await readGuidanceTarget(page);
    const initialSelection = await readSelection(page);
    manifest.checks.selectScout = {
      guidance: initialGuidance,
      target: initialTarget,
      selectedSize: initialSelection.size,
    };
    if (initialSelection.size !== 0) throw new Error(`expected empty selection, got ${initialSelection.size}`);
    if (initialGuidance.id !== 'select-scout' || initialGuidance.primary !== GUIDANCE_TEXT.selectScout || initialGuidance.secondary !== '') {
      throw new Error(`unexpected opening guidance: ${JSON.stringify(initialGuidance)}`);
    }
    if (initialTarget.hidden || initialTarget.label !== 'SCOUT') {
      throw new Error(`missing SCOUT target bracket: ${JSON.stringify(initialTarget)}`);
    }
    await page.screenshot({ path: selectShotPath, type: 'png' });
    manifest.captures.guidanceSelectScout = { file: path.basename(selectShotPath), image: analyzePng(selectShotPath) };

    // 3. Real HUD control selects the player scout and advances the prompt.
    await page.click('#scout-focus');
    await settleFrames(page);
    const exploreGuidance = await readGuidance(page);
    const exploreTarget = await readGuidanceTarget(page);
    const exploreSelection = await readSelection(page);
    const scoutEnt = exploreSelection.ents[0];
    manifest.checks.exploreSignal = {
      clicked: '#scout-focus',
      guidance: exploreGuidance,
      target: exploreTarget,
      selection: exploreSelection,
    };
    if (exploreSelection.size !== 1) throw new Error(`expected exactly one selected entity, got ${exploreSelection.size}`);
    if (!scoutEnt || scoutEnt.kind !== 1 || scoutEnt.team !== 0 || !scoutEnt.alive || !scoutEnt.vis) {
      throw new Error(`selected entity is not the player scout: ${JSON.stringify(scoutEnt)}`);
    }
    if (exploreGuidance.id !== 'explore-signal' || exploreGuidance.primary !== GUIDANCE_TEXT.exploreSignal || exploreGuidance.secondary !== '') {
      throw new Error(`unexpected explore guidance: ${JSON.stringify(exploreGuidance)}`);
    }
    if (exploreTarget.hidden || exploreTarget.label !== 'SIGNAL') {
      throw new Error(`missing SIGNAL target bracket: ${JSON.stringify(exploreTarget)}`);
    }
    await page.screenshot({ path: exploreShotPath, type: 'png' });
    manifest.captures.guidanceExploreSignal = { file: path.basename(exploreShotPath), image: analyzePng(exploreShotPath) };

    // 4. Teleport the selected scout onto the central Solar objective, center the
    //    camera there, and advance exactly one public world.step().
    const teleported = await page.evaluate(() => {
      const world = globalThis.__STARHOLD_WORLD__;
      const input = globalThis.__STARHOLD_INPUT__;
      if (!world || !input) throw new Error('QA handles missing');
      const scoutId = [...input.selected][0];
      const scout = world.ents[scoutId];
      const landmark = world.landmarks.find((entry) => entry.id === 'central-lumen-field');
      if (!scout || !landmark) throw new Error('guidance fixtures missing');
      const before = {
        scoutId,
        landmark: { id: landmark.id, x: landmark.x, z: landmark.z },
        playerBitBefore: landmark.discoveredBy & 1,
        tickBefore: world.tick,
        scoutHpBefore: scout.hp,
      };
      if (before.playerBitBefore !== 0) throw new Error('central landmark starts discovered');
      scout.x = scout.px = landmark.x;
      scout.z = scout.pz = landmark.z;
      scout.vx = scout.vz = 0;
      scout.order = 0;
      scout.path = null;
      scout.pathI = 0;
      input.pan.x = landmark.x;
      input.pan.z = landmark.z;
      input.halfH = 10;
      input.view.lookAt(input.pan.x, input.pan.z);
      input.view.setZoom(input.halfH);
      world.step();
      const event = world.discoveryLog.find((entry) => entry.team === 0 && entry.id === 'central-lumen-field') ?? null;
      return {
        ...before,
        playerBitAfter: landmark.discoveredBy & 1,
        tickAfter: world.tick,
        scoutAlive: scout.alive,
        scoutVis: scout.vis,
        scoutHpAfter: scout.hp,
        landmarkEventCount: world.discoveryLog.filter((entry) => entry.team === 0 && entry.id === 'central-lumen-field').length,
        landmarkEvent: event ? JSON.parse(JSON.stringify(event)) : null,
      };
    });
    manifest.checks.objectiveFound = teleported;
    if (!(teleported.playerBitAfter & 1)) throw new Error('central landmark player bit was not latched');
    if (teleported.tickAfter - teleported.tickBefore !== 1) {
      throw new Error(`expected exactly one world.step, tick moved ${teleported.tickBefore} -> ${teleported.tickAfter}`);
    }
    if (teleported.landmarkEventCount !== 1 || !teleported.landmarkEvent) {
      throw new Error(`central landmark discovery events: ${teleported.landmarkEventCount}`);
    }

    await settleFrames(page);
    const foundGuidance = await readGuidance(page);
    const foundTarget = await readGuidanceTarget(page);
    const qaProbe = await probe(page);
    const probeLandmark = qaProbe.landmarks?.find((entry) => entry.id === 'central-lumen-field') ?? null;
    manifest.checks.objectiveFound.guidance = foundGuidance;
    manifest.checks.objectiveFound.target = foundTarget;
    manifest.checks.objectiveFound.probeLandmark = probeLandmark;
    if (foundGuidance.id !== 'objective-found' || foundGuidance.primary !== GUIDANCE_TEXT.objectivePrimary) {
      throw new Error(`unexpected objective guidance: ${JSON.stringify(foundGuidance)}`);
    }
    if (foundGuidance.secondary !== GUIDANCE_TEXT.objectiveSecondary) {
      throw new Error(`missing secondary line: ${JSON.stringify(foundGuidance.secondary)}`);
    }
    if (!foundTarget.hidden) {
      throw new Error(`objective-found target bracket is still visible: ${JSON.stringify(foundTarget)}`);
    }
    if (!(probeLandmark?.discoveredBy & 1)) throw new Error('QA probe missing central landmark latch');
    await page.screenshot({ path: foundShotPath, type: 'png' });
    manifest.captures.guidanceObjectiveFound = { file: path.basename(foundShotPath), image: analyzePng(foundShotPath) };

    // 5. Frame budget under the frozen-route draw loop.
    await page.waitForFunction(
      (budget) =>
        globalThis.__STARHAVEN_QA__?.p99FrameMs > 0 && globalThis.__STARHAVEN_QA__?.p99FrameMs < budget,
      P99_BUDGET_MS,
      { timeout: 15000 },
    );
    const perf = await probe(page);
    manifest.checks.p99FrameMs = perf.p99FrameMs;
    if (!(perf.p99FrameMs < P99_BUDGET_MS)) {
      throw new Error(`p99 ${perf.p99FrameMs}ms exceeds budget ${P99_BUDGET_MS}ms`);
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
    console.log('--- qa-m2-guidance summary ---');
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
