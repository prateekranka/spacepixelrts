#!/usr/bin/env node
/** VS-2B browser proof: Central Lumen ownership, HUD, minimap tint, pulse, and perf. */

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
const MAP = 72;
const DT = 1 / 20;
const CAPTURE_STEPS = Math.round(5 / DT);
const SIM_HZ = 20;
const P99_BUDGET_MS = 8;
const KIND = { Worker: 0, Scout: 1, Fighter: 2, Ravager: 4, Prism: 5 };
const ORD_MOVE = 1;
const SEEN_PLAYER = 1;
const NAV_TIMEOUT_MS = 30000;
const PROBE_TIMEOUT_MS = 30000;
const SERVER_BOOT_TIMEOUT_MS = 120000;

function assertThat(condition, message) {
  if (!condition) throw new Error(message);
}

function near(actual, expected, tolerance = DT + 1e-6) {
  return Math.abs(actual - expected) <= tolerance;
}

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
  const state = { child, url, exited: false, stopped: false };
  child.on('exit', () => { state.exited = true; });
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
      try { child.kill(name); } catch {}
    }
  };
  if (!server.exited) {
    signal('SIGTERM');
    const stopped = await Promise.race([
      once(child, 'exit').then(() => true, () => true),
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
  assertThat(png.width === VIEWPORT.width && png.height === VIEWPORT.height, `${path.basename(file)} has wrong size`);
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
  assertThat(max > 6 && litRatio >= 0.002, `${path.basename(file)} is black or empty`);
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
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

async function stageCamera(page, camera) {
  await page.evaluate((next) => {
    const input = globalThis.__STARHOLD_INPUT__;
    if (!input) throw new Error('__STARHOLD_INPUT__ missing');
    input.pan.x = next.x;
    input.pan.z = next.z;
    input.halfH = next.halfH;
    input.tick(0);
  }, camera);
}

async function spawnFixture(page) {
  return page.evaluate(({ kinds, map }) => {
    const world = globalThis.__STARHOLD_WORLD__;
    if (!world) throw new Error('__STARHOLD_WORLD__ missing');
    const landmark = world.landmarks.find((entry) => entry.id === 'central-lumen-field');
    if (!landmark) throw new Error('central Lumen landmark missing');
    const scout = world.spawn(kinds.Scout, world.civ[0], 0, landmark.x, landmark.z);
    const fighter = world.spawn(kinds.Fighter, world.civ[0], 0, 10.5, 10.5);
    if (!scout || !fighter) throw new Error('player roster fixture spawn failed');
    return {
      center: { x: landmark.x, z: landmark.z },
      scout: { id: scout.id, x: landmark.x, z: landmark.z },
      player: { id: fighter.id, x: 10.5, z: 10.5 },
      workers: world.ents
        .filter((entity) => entity.alive && entity.team === 1 && entity.kind === kinds.Worker)
        .map((entity) => ({ id: entity.id, x: entity.x, z: entity.z })),
      rival: null,
    };
  }, { kinds: KIND, map: MAP });
}

async function spawnRival(page, fixture) {
  return page.evaluate(({ kinds, fixture }) => {
    const world = globalThis.__STARHOLD_WORLD__;
    if (!world) throw new Error('__STARHOLD_WORLD__ missing');
    const rival = world.spawn(kinds.Fighter, world.civ[1], 1, fixture.center.x, fixture.center.z);
    if (!rival) throw new Error('rival roster fixture spawn failed');
    return { id: rival.id, x: fixture.center.x, z: fixture.center.z };
  }, { kinds: KIND, fixture });
}

async function stepFixtures(page, fixtures, steps) {
  return page.evaluate(({ fixtures, steps, ordMove }) => {
    const world = globalThis.__STARHOLD_WORLD__;
    if (!world) throw new Error('__STARHOLD_WORLD__ missing');
    for (let step = 0; step < steps; step++) {
      for (const fixture of fixtures) {
        const unit = world.ents[fixture.id];
        if (!unit?.alive) throw new Error(`fixture ${fixture.id} died unexpectedly`);
        unit.x = unit.px = fixture.x;
        unit.z = unit.pz = fixture.z;
        unit.vx = unit.vz = 0;
        unit.order = ordMove;
        unit.tx = fixture.x + 1.5;
        unit.tz = fixture.z;
        unit.tid = -1;
        unit.path = null;
        unit.pathI = 0;
      }
      world.step();
    }
    return { tick: world.tick };
  }, { fixtures, steps, ordMove: ORD_MOVE });
}

async function readLumen(page, fixture) {
  await settleFrames(page);
  return page.evaluate(({ fixture, map, seenPlayer }) => {
    const world = globalThis.__STARHOLD_WORLD__;
    if (!world) throw new Error('__STARHOLD_WORLD__ missing');
    const landmark = world.landmarks.find((entry) => entry.id === 'central-lumen-field');
    const state = world.lumenState();
    const panel = document.querySelector('#lumen-objective');
    const label = panel?.querySelector('.lumen-label');
    const bar = panel?.querySelector('.lumen-bar');
    const barFill = panel?.querySelector('.lumen-bar i');
    const pulse = panel?.querySelector('.lumen-pulse');
    const minimap = document.querySelector('#minimap');
    const ctx = minimap?.getContext('2d');
    const cx = Math.round((fixture.center.x / map) * (minimap?.width ?? 220));
    const cy = Math.round((fixture.center.z / map) * (minimap?.height ?? 220));
    const pixel = (x, y) => {
      if (!ctx || !minimap) return [0, 0, 0, 0];
      const px = Math.max(0, Math.min(minimap.width - 1, x));
      const py = Math.max(0, Math.min(minimap.height - 1, y));
      return Array.from(ctx.getImageData(px, py, 1, 1).data);
    };
    const farX = Math.floor(fixture.far.x);
    const farZ = Math.floor(fixture.far.z);
    const farTile = farX + farZ * map;
    const farEnemy = fixture.rival ? world.ents[fixture.rival.id] : null;
    return {
      tick: world.tick,
      winner: world.winner,
      state,
      energy: [world.teams[0].energy, world.teams[1].energy],
      landmark: landmark ? { discoveredBy: landmark.discoveredBy } : null,
      far: {
        visible: world.visible[0][farTile] === 1,
        explored: world.explored[0][farTile] === 1,
        seenByPlayer: farEnemy ? (farEnemy.seenBy & seenPlayer) !== 0 : false,
      },
      panel: {
        hidden: panel?.hidden ?? true,
        label: label?.textContent ?? '',
        barHidden: bar?.hidden ?? true,
        barWidth: barFill?.style.width ?? '',
        barHeight: bar ? Number.parseFloat(getComputedStyle(bar).height) : 0,
        pulse: pulse?.textContent ?? '',
        pulseHidden: pulse?.hidden ?? true,
        width: panel?.getBoundingClientRect().width ?? 0,
        labelFontSize: label ? Number.parseFloat(getComputedStyle(label).fontSize) : 0,
        pointerEvents: panel ? getComputedStyle(panel).pointerEvents : '',
      },
      minimap: {
        diamond: pixel(cx, cy),
        ring: pixel(cx + 7, cy),
      },
    };
  }, { fixture: { ...fixture, far: { x: MAP - 3.5, z: MAP - 3.5 } }, map: MAP, seenPlayer: SEEN_PLAYER });
}

async function capture(page, out, name, camera, manifest, fixture) {
  await stageCamera(page, camera);
  await settleFrames(page);
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file, type: 'png' });
  const state = await readLumen(page, fixture);
  manifest.captures[name] = {
    file: path.basename(file),
    image: analyzePng(file),
    state,
  };
  return state;
}

async function rendererName(page) {
  return page.evaluate(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return 'none';
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'masked';
    } catch {
      return 'err';
    }
  });
}

async function measureSim(page, fixtures, steps) {
  return page.evaluate(({ fixtures, steps, ordMove }) => {
    const world = globalThis.__STARHOLD_WORLD__;
    if (!world) throw new Error('__STARHOLD_WORLD__ missing');
    const start = performance.now();
    for (let step = 0; step < steps; step++) {
      for (const fixture of fixtures) {
        const unit = world.ents[fixture.id];
        if (!unit?.alive) throw new Error(`fixture ${fixture.id} died during perf gate`);
        unit.x = unit.px = fixture.x;
        unit.z = unit.pz = fixture.z;
        unit.vx = unit.vz = 0;
        unit.order = ordMove;
        unit.tx = fixture.x + 1.5;
        unit.tz = fixture.z;
        unit.tid = -1;
        unit.path = null;
        unit.pathI = 0;
      }
      world.step();
    }
    return Math.round(((performance.now() - start) / steps) * 10000) / 10000;
  }, { fixtures, steps, ordMove: ORD_MOVE });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = resolveOut(args.out);
  fs.mkdirSync(out, { recursive: true });
  const manifest = {
    tool: 'qa-vs2b-lumen',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: {
      out,
      route: 'opening',
      query: '?qa=opening',
      viewport: VIEWPORT,
      seed: 0x5eed,
      simHz: SIM_HZ,
      directWorldFastStepOnly: true,
      fixturePolicy: 'spawned Fighter/Scout roster units; ordinary positions/orders only',
    },
    checks: {},
    captures: {},
    errors: [],
    ok: false,
  };
  let server = null;
  let browser = null;
  try {
    server = await startServer();
    console.log(`qa-vs2b-lumen: dev server ready at ${server.url}`);
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

    await page.goto(`${server.url}/?qa=opening`, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Playing', null, { timeout: PROBE_TIMEOUT_MS });
    await settleFrames(page);
    const entry = await probe(page);
    assertThat(entry.scenario === 'opening', `scenario != opening (${entry.scenario})`);
    assertThat(entry.frozen === true, 'browser QA must freeze the RAF sim and drive World.step directly');
    assertThat(entry.config?.seed === 0x5eed && entry.config?.fogOfWar === true, `unexpected config ${JSON.stringify(entry.config)}`);
    manifest.checks.entry = { state: entry.state, frozen: entry.frozen, config: entry.config };

    const fixture = await spawnFixture(page);
    fixture.far = { x: MAP - 3.5, z: MAP - 3.5 };
    const activeFixtures = () => [
      fixture.scout,
      ...fixture.workers,
      fixture.player,
      fixture.rival,
    ].filter(Boolean);
    const initial = await readLumen(page, fixture);
    assertThat(initial.panel.hidden, 'undiscovered central Lumen panel is visible');
    assertThat(initial.landmark && (initial.landmark.discoveredBy & SEEN_PLAYER) === 0, 'central landmark starts discovered');
    manifest.checks.undiscovered = initial;
    await capture(page, out, '01-undiscovered', { x: fixture.center.x, z: fixture.center.z, halfH: 24 }, manifest, fixture);

    fixture.scout.x = fixture.center.x;
    fixture.scout.z = fixture.center.z;
    await stepFixtures(page, activeFixtures(), 1);
    let state = await readLumen(page, fixture);
    assertThat(!state.panel.hidden, 'discovered central Lumen panel remains hidden');
    assertThat(state.panel.label === 'LUMEN · NEUTRAL', `neutral label mismatch: ${state.panel.label}`);
    assertThat(state.state.owner === -1 && state.state.capturing === -1, 'neutral state mismatch');
    assertThat(state.panel.width <= 156 && state.panel.labelFontSize >= 12 && state.panel.pointerEvents === 'none', 'Lumen panel geometry/pointer contract failed');
    manifest.checks.neutral = state;
    await capture(page, out, '02-neutral', { x: fixture.center.x, z: fixture.center.z, halfH: 24 }, manifest, fixture);

    fixture.scout.x = 2;
    fixture.scout.z = 2;
    fixture.player.x = fixture.center.x;
    fixture.player.z = fixture.center.z;
    await stepFixtures(page, activeFixtures(), 50);
    state = await readLumen(page, fixture);
    assertThat(state.state.owner === -1 && state.state.capturing === 0, '50% capture ownership state mismatch');
    assertThat(near(state.state.progress, 2.5), `50% capture progress mismatch: ${state.state.progress}`);
    assertThat(state.panel.label === 'LUMEN · CAPTURING — SUNWEAVER', `capture label mismatch: ${state.panel.label}`);
    assertThat(!state.panel.barHidden && near(Number.parseFloat(state.panel.barWidth), 50, 1), 'capture bar is not at 50%');
    assertThat(state.panel.barHeight === 6, `capture bar height is ${state.panel.barHeight}px`);
    manifest.checks.playerCapture50 = state;
    await capture(page, out, '03-sunweaver-50', { x: fixture.center.x, z: fixture.center.z, halfH: 24 }, manifest, fixture);

    await stepFixtures(page, activeFixtures(), 50);
    state = await readLumen(page, fixture);
    assertThat(state.state.owner === 0 && state.state.capturing === -1, 'Sunweaver control state mismatch');
    assertThat(state.panel.label === 'LUMEN · SUNWEAVER CONTROL', `Sunweaver control label mismatch: ${state.panel.label}`);
    const playerEnergyAtControl = state.energy[0];
    const playerDiamond = state.minimap.diamond;
    manifest.checks.sunweaverControl = state;
    await capture(page, out, '04-sunweaver-control', { x: fixture.center.x, z: fixture.center.z, halfH: 24 }, manifest, fixture);

    await stepFixtures(page, activeFixtures(), 200);
    state = await readLumen(page, fixture);
    assertThat(state.energy[0] - playerEnergyAtControl === 10, `Sunweaver Charge delta is ${state.energy[0] - playerEnergyAtControl}, expected 10`);
    manifest.checks.playerCharge = { before: playerEnergyAtControl, after: state.energy[0], delta: state.energy[0] - playerEnergyAtControl };

    fixture.rival = await spawnRival(page, fixture);
    await stepFixtures(page, activeFixtures(), 1);
    state = await readLumen(page, fixture);
    assertThat(state.state.owner === 0 && state.state.contested && state.state.capturing === -1 && state.state.progress === 0, 'contested state mismatch');
    assertThat(state.panel.label === 'LUMEN · CONTESTED' && state.panel.barHidden, `contested HUD mismatch: ${JSON.stringify(state.panel)}`);
    manifest.checks.contested = state;
    await capture(page, out, '05-contested', { x: fixture.center.x, z: fixture.center.z, halfH: 24 }, manifest, fixture);

    fixture.player.x = 20;
    fixture.player.z = 20;
    await stepFixtures(page, activeFixtures(), CAPTURE_STEPS);
    state = await readLumen(page, fixture);
    assertThat(state.state.owner === 1 && state.state.capturing === -1, 'Gravemark recapture state mismatch');
    assertThat(state.panel.label === 'LUMEN · GRAVEMARK CONTROL', `Gravemark control label mismatch: ${state.panel.label}`);
    const rivalEnergyAtControl = state.energy[1];
    const rivalDiamond = state.minimap.diamond;
    const rivalRing = state.minimap.ring;
    assertThat(JSON.stringify(playerDiamond) !== JSON.stringify(rivalDiamond), 'minimap diamond pixel did not change owner tint');
    assertThat(JSON.stringify(manifest.checks.neutral.minimap.ring) !== JSON.stringify(rivalRing), 'minimap ring pixel did not change to Gravemark tint');
    manifest.checks.gravemarkControl = state;
    manifest.checks.minimapPixels = {
      neutral: manifest.checks.neutral.minimap,
      sunweaver: playerDiamond,
      gravemark: { diamond: rivalDiamond, ring: rivalRing },
    };
    await capture(page, out, '06-gravemark-control', { x: fixture.center.x, z: fixture.center.z, halfH: 24 }, manifest, fixture);

    await stepFixtures(page, activeFixtures(), 200);
    state = await readLumen(page, fixture);
    assertThat(state.energy[1] - rivalEnergyAtControl === 10, `Gravemark Charge delta is ${state.energy[1] - rivalEnergyAtControl}, expected 10`);
    manifest.checks.rivalCharge = { before: rivalEnergyAtControl, after: state.energy[1], delta: state.energy[1] - rivalEnergyAtControl };

    fixture.rival.x = MAP - 3.5;
    fixture.rival.z = MAP - 3.5;
    fixture.player.x = fixture.center.x;
    fixture.player.z = fixture.center.z;
    await stepFixtures(page, activeFixtures(), CAPTURE_STEPS);
    state = await readLumen(page, fixture);
    assertThat(state.state.owner === 0, 'player recapture before pulse failed');
    await stepFixtures(page, activeFixtures(), 600);
    state = await readLumen(page, fixture);
    if (state.state.pulseRemaining[0] <= 0) {
      await stepFixtures(page, activeFixtures(), 2);
      state = await readLumen(page, fixture);
    }
    assertThat(state.state.owner === 0 && state.state.pulseRemaining[0] > 0, 'player vision pulse did not activate at 30 owned seconds');
    assertThat(state.panel.pulse === `VISION PULSE · ${Math.ceil(state.state.pulseRemaining[0])}s`, `pulse HUD mismatch: ${state.panel.pulse}`);
    assertThat(state.far.visible && state.far.explored && state.far.seenByPlayer, 'pulse did not fill/discover global player fog');
    assertThat(state.winner === -1, `winner changed during pulse: ${state.winner}`);
    manifest.checks.pulse = state;
    await capture(page, out, '07-vision-pulse', { x: fixture.center.x, z: fixture.center.z, halfH: 24 }, manifest, fixture);

    let pulseSteps = 0;
    while (state.state.pulseRemaining[0] > 0 && pulseSteps < Math.round(5 / DT)) {
      await stepFixtures(page, activeFixtures(), 1);
      pulseSteps++;
      state = await readLumen(page, fixture);
    }
    assertThat(state.state.pulseRemaining[0] === 0, 'pulse did not expire');
    assertThat(!state.far.visible && state.far.explored && state.far.seenByPlayer, 'post-pulse fog/discovery contract failed');
    assertThat(state.winner === -1, `winner changed after pulse: ${state.winner}`);
    manifest.checks.postPulse = { ...state, pulseSteps };
    await capture(page, out, '08-post-pulse', { x: fixture.center.x, z: fixture.center.z, halfH: 24 }, manifest, fixture);

    const renderer = await rendererName(page);
    const simStepMs = await measureSim(page, activeFixtures(), 600);
    await delay(2200);
    const perfProbe = await probe(page);
    const softwareGl = /swiftshader|llvmpipe|software/i.test(renderer);
    manifest.checks.final = {
      tick: state.tick,
      winner: state.winner,
      renderer,
      softwareGl,
      simStepMs,
      simShareMs: Math.round(simStepMs * 5 * 10000) / 10000,
      p99FrameMs: perfProbe.p99FrameMs,
      consoleErrors: manifest.errors.length,
      captures: Object.keys(manifest.captures),
      directForbiddenWrites: false,
    };
    if (manifest.errors.length > 0) throw new Error(`browser errors: ${manifest.errors.length}`);
    if (softwareGl) assertThat(simStepMs * 5 < P99_BUDGET_MS, `software-GL sim share ${(simStepMs * 5).toFixed(3)}ms exceeds ${P99_BUDGET_MS}ms`);
    else assertThat(perfProbe.p99FrameMs > 0 && perfProbe.p99FrameMs < P99_BUDGET_MS, `hardware-GL render p99 ${perfProbe.p99FrameMs}ms exceeds ${P99_BUDGET_MS}ms`);
    manifest.checks.frameBudget = softwareGl
      ? { mode: 'sim-share (software GL)', simShareMs: simStepMs * 5, renderP99RecordedNotGated: perfProbe.p99FrameMs }
      : { mode: 'render-p99', p99FrameMs: perfProbe.p99FrameMs };
    manifest.ok = true;
  } catch (error) {
    manifest.errors.push(error?.stack ?? String(error));
    manifest.ok = false;
  } finally {
    try { if (browser) await browser.close(); } catch {}
    try { await stopServer(server); } catch {}
    manifest.finishedAt = new Date().toISOString();
    const manifestPath = path.join(out, 'manifest.json');
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log('--- qa-vs2b-lumen summary ---');
    console.log(`ok=${manifest.ok} captures=${Object.keys(manifest.captures).length} errors=${manifest.errors.length}`);
    console.log(`manifest=${manifestPath}`);
    if (manifest.errors.length) {
      console.log('errors:');
      for (const error of manifest.errors) console.log(`  - ${error.split('\n')[0]}`);
    }
    if (!manifest.ok) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
