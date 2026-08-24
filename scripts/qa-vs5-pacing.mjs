#!/usr/bin/env node
/** VS5 — first-match pacing closure: real guidance, legal player policy, replacement Scout, terminal. */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = '/home/bobbyranka/workspace/evidence/starhaven-vs5-pacing';
const VIEWPORT = { width: 1366, height: 1024 };
const SEED = 0x5eed;
const SIM_HZ = 20;
const MAX_TICKS = 18 * 60 * SIM_HZ;
const P99_BUDGET_MS = 8;
const PROBE_TIMEOUT_MS = 30000;
const NAV_TIMEOUT_MS = 30000;
const SERVER_BOOT_TIMEOUT_MS = 120000;
const KIND = { Worker: 0, Scout: 1, Fighter: 2, Ravager: 4, Hall: 10, Barracks: 12, Resource: 20 };
const TILE = { Ore: 3, Solar: 5 };
const ORD = { Move: 1, Gather: 3, Attack: 2, AttackMove: 6 };
const SEEN_PLAYER = 1;
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
  const requested = raw === undefined ? DEFAULT_OUT : String(raw).trim();
  if (!requested || !path.isAbsolute(requested)) throw new Error(`--out must be an absolute path outside the repository (default: ${DEFAULT_OUT})`);
  const out = path.resolve(requested);
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
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => process.stdout.write(`[dev] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stdout.write(`[dev:err] ${chunk}`));
  const deadline = Date.now() + SERVER_BOOT_TIMEOUT_MS;
  while (Date.now() < deadline && !state.exited) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return state;
    } catch {}
    await delay(250);
  }
  await stopServer(state);
  throw new Error(state.exited ? 'Vite exited before becoming reachable' : `Vite did not become ready at ${url}`);
}

async function stopServer(server) {
  if (!server || server.stopped) return;
  server.stopped = true;
  const child = server.child;
  if (child.pid != null && child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await Promise.race([once(child, 'exit').catch(() => {}), delay(4000)]);
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
}

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

function minute(tick) {
  return Math.round((tick / SIM_HZ / 60) * 100) / 100;
}

function analyzePng(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  requireThat(png.width === VIEWPORT.width && png.height === VIEWPORT.height, `${path.basename(file)} is ${png.width}x${png.height}, expected ${VIEWPORT.width}x${VIEWPORT.height}`);
  let maxLuma = 0;
  let lit = 0;
  let samples = 0;
  for (let index = 0; index < png.data.length; index += 28) {
    const luma = 0.2126 * png.data[index] + 0.7152 * png.data[index + 1] + 0.0722 * png.data[index + 2];
    maxLuma = Math.max(maxLuma, luma);
    if (luma > 10) lit++;
    samples++;
  }
  const litRatio = samples > 0 ? lit / samples : 0;
  requireThat(maxLuma > 6 && litRatio >= 0.002, `${path.basename(file)} is black or empty`);
  return {
    width: png.width,
    height: png.height,
    maxLuma: Math.round(maxLuma * 100) / 100,
    litRatio: Math.round(litRatio * 10000) / 10000,
  };
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function guidance(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#guidance');
    const target = document.querySelector('#guidance-target');
    const world = globalThis.__STARHOLD_WORLD__;
    const input = globalThis.__STARHOLD_INPUT__;
    const deck = [...document.querySelectorAll('#cmds button')].map((button) => ({
      cmd: button.dataset.cmd ?? '',
      text: button.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      disabled: button.hasAttribute('disabled'),
    }));
    return {
      state: root?.dataset.state ?? '',
      primary: root?.querySelector('strong')?.textContent?.trim() ?? '',
      secondary: root?.querySelector('span')?.textContent?.trim() ?? '',
      targetHidden: target?.hasAttribute('hidden') ?? true,
      target: target?.querySelector('span')?.textContent?.trim() ?? '',
      lumenPanelHidden: document.querySelector('#lumen-objective')?.hasAttribute('hidden') ?? true,
      lumenLabel: document.querySelector('#lumen-objective .lumen-label')?.textContent?.trim() ?? '',
      deck,
      tick: world?.tick ?? -1,
      ore: world?.teams?.[0]?.ore ?? -1,
      charge: world?.teams?.[0]?.energy ?? -1,
      channelT: world?.pathChannelT?.(0) ?? -1,
      selected: input ? [...input.selected] : [],
    };
  });
}

async function pathButtonRects(page) {
  return page.evaluate(() => [...document.querySelectorAll('#cmds button.choice[data-cmd^="path-"]')].map((button) => {
    const rect = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    return {
      cmd: button.dataset.cmd ?? '',
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
      enabled: !button.disabled,
      text: button.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    };
  }));
}

async function capture(page, out, manifest, name, check) {
  await settle(page);
  const filename = `${name}.png`;
  const file = path.join(out, filename);
  await page.screenshot({ path: file, type: 'png' });
  manifest.captures[name] = { file: filename, image: analyzePng(file), check };
}

async function stepWorld(page, steps) {
  return page.evaluate(({ count, kinds, ord, seenRival }) => {
    const world = globalThis.__STARHOLD_WORLD__;
    if (!world) throw new Error('__STARHOLD_WORLD__ missing');
    let maxPositiveGain = 0;
    for (let index = 0; index < count; index++) {
      const before = { ore: world.teams[0].ore, gas: world.teams[0].gas, energy: world.teams[0].energy };
      world.step();
      const after = world.teams[0];
      maxPositiveGain = Math.max(
        maxPositiveGain,
        Math.max(0, after.ore - before.ore) + Math.max(0, after.gas - before.gas) + Math.max(0, after.energy - before.energy),
      );
      globalThis.__VS5_OBSERVE__?.();
      if (world.winner !== -1) break;
    }
    const hall = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === kinds.Hall);
    return { tick: world.tick, winner: world.winner, maxPositiveGain, coreSeen: !!hall && (hall.seenBy & seenRival) !== 0 };
  }, { count: steps, kinds: KIND, ord: ORD, seenRival: SEEN_RIVAL });
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
      return 'error';
    }
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = resolveOut(args.out);
  fs.mkdirSync(out, { recursive: true });
  const manifest = {
    tool: 'qa-vs5-pacing',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: {
      out,
      route: 'opening',
      query: '?qa=opening',
      viewport: VIEWPORT,
      seed: SEED,
      difficulty: 'standard',
      fogOfWar: true,
      frozenRaf: true,
      directWorldFastStepOnly: true,
      objectiveControl: 'ordinary Scout Move / army AttackMove / player Attack with real World.step',
    },
    checks: {},
    captures: {},
    consoleErrors: [],
    errors: [],
    ok: false,
  };
  let server = null;
  let browser = null;
  try {
    server = await startServer();
    console.log(`qa-vs5-pacing: dev server ready at ${server.url}`);
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
    }).catch(() => chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] }));
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, hasTouch: true });
    const page = await context.newPage();
    page.setDefaultTimeout(PROBE_TIMEOUT_MS);
    page.on('console', (message) => {
      if (message.type() === 'error') manifest.consoleErrors.push(`console.error: ${message.text()}`);
    });
    page.on('pageerror', (error) => manifest.consoleErrors.push(`pageerror: ${error?.message ?? String(error)}`));

    await page.goto(`${server.url}/?qa=opening`, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Playing', null, { timeout: PROBE_TIMEOUT_MS });
    await settle(page);
    const entry = await page.evaluate(() => {
      const qa = globalThis.__STARHAVEN_QA__;
      return {
        state: qa?.state,
        scenario: qa?.scenario,
        frozen: qa?.frozen,
        config: qa?.config,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      };
    });
    manifest.checks.entry = entry;
    requireThat(entry.scenario === 'opening' && entry.state === 'Playing', `unexpected QA entry ${JSON.stringify(entry)}`);
    requireThat(entry.frozen === true, 'browser QA must drive the real World directly while RAF simulation is frozen');
    requireThat(entry.config?.seed === SEED && entry.config?.seedMode === 'deterministic' && entry.config?.difficulty === 'standard', `unexpected config ${JSON.stringify(entry.config)}`);
    requireThat(entry.viewport.width === VIEWPORT.width && entry.viewport.height === VIEWPORT.height, `unexpected viewport ${JSON.stringify(entry.viewport)}`);

    const setup = await page.evaluate(({ kinds, tile, ord, seenRival }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      const input = globalThis.__STARHOLD_INPUT__;
      if (!world || !input) throw new Error('VS5 world/input handles missing');
      const trace = { trainCalls: [], placeCalls: [], commitCalls: [], replacementTrainTick: -1, coreDiscoveryTick: -1, attackTick: -1, winnerTick: -1 };
      const originalTrain = world.tryTrain.bind(world);
      const originalPlace = world.tryPlace.bind(world);
      const originalCommit = world.tryCommitPath.bind(world);
      world.tryTrain = (building, kind) => {
        const before = { ...world.teams[building.team] };
        const ok = originalTrain(building, kind);
        const after = world.teams[building.team];
        const call = {
          tick: world.tick,
          team: building.team,
          buildingKind: building.kind,
          kind,
          ok,
          delta: { ore: before.ore - after.ore, gas: before.gas - after.gas, energy: before.energy - after.energy },
          trainT: building.trainT,
        };
        trace.trainCalls.push(call);
        if (call.ok && call.team === 1 && call.buildingKind === kinds.Hall && call.kind === kinds.Scout && trace.replacementTrainTick < 0) trace.replacementTrainTick = call.tick;
        return ok;
      };
      world.tryPlace = (team, kind, x, z, builderId) => {
        const before = { ...world.teams[team] };
        const ok = originalPlace(team, kind, x, z, builderId);
        const after = world.teams[team];
        trace.placeCalls.push({ tick: world.tick, team, kind, ok, delta: { ore: before.ore - after.ore, gas: before.gas - after.gas, energy: before.energy - after.energy } });
        return ok;
      };
      world.tryCommitPath = (team, path) => {
        const before = { ...world.teams[team] };
        const ok = originalCommit(team, path);
        const after = world.teams[team];
        trace.commitCalls.push({ tick: world.tick, team, path, ok, delta: { ore: before.ore - after.ore, gas: before.gas - after.gas, energy: before.energy - after.energy } });
        return ok;
      };
      globalThis.__VS5_TRACE__ = trace;
      globalThis.__VS5_OBSERVE__ = () => {
        const hall = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === kinds.Hall);
        if (hall && (hall.seenBy & seenRival) !== 0 && trace.coreDiscoveryTick < 0) trace.coreDiscoveryTick = world.tick;
        if (trace.replacementTrainTick >= 0) {
          const replacement = world.ents.find((entity) => entity.alive && entity.hp > 0 && entity.team === 1 && entity.kind === kinds.Scout);
          if (replacement) trace.replacementScoutId ??= replacement.id;
        }
        if (hall && trace.attackTick < 0 && world.tick >= 8 * 60 * 20) {
          const attacking = world.ents.some((entity) => entity.alive && entity.hp > 0 && entity.team === 1
            && (entity.kind === kinds.Fighter || entity.kind === kinds.Ravager || entity.kind === kinds.Prism)
            && (entity.order === 2 || entity.order === 6) && entity.tid === hall.id);
          if (attacking) trace.attackTick = world.tick;
        }
        if (trace.winnerTick < 0 && world.winner !== -1) trace.winnerTick = world.tick;
      };
      const rivalScout = world.ents.find((entity) => entity.alive && entity.team === 1 && entity.kind === kinds.Scout);
      const hall = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === kinds.Hall);
      if (!rivalScout || !hall) throw new Error('actual opening rival Scout/Nexus missing');
      world.kill(rivalScout);
      input.selected.clear();
      input.commandMode = null;
      input.place = null;
      input.pan.x = 12;
      input.pan.z = 12;
      input.halfH = 24;
      return { rivalScoutId: rivalScout.id, hallId: hall.id, tick: world.tick, winner: world.winner };
    }, { kinds: { ...KIND, Prism: 5 }, tile: TILE, ord: ORD, seenRival: SEEN_RIVAL });
    manifest.checks.opening = setup;
    requireThat(setup.winner === -1, `opening kill changed winner ${setup.winner}`);

    let current = await guidance(page);
    requireThat(current.state === 'build-yard', `01 state ${current.state}`);
    requireThat(current.primary === 'Build a Yard' && current.secondary === 'Select a Worker · 150 Ore + 20 Charge', `01 copy ${JSON.stringify(current)}`);
    requireThat(!current.targetHidden && current.target === 'WORKER', `01 target ${JSON.stringify(current)}`);
    await capture(page, out, manifest, '01-build-yard', current);

    const policy = await page.evaluate(({ kinds, tile, ord }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      if (!world) throw new Error('__STARHOLD_WORLD__ missing');
      const hall = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === kinds.Hall);
      const workers = world.ents.filter((entity) => entity.alive && entity.team === 0 && entity.kind === kinds.Worker);
      if (!hall || workers.length !== 4) throw new Error('opening player Hall/Workers missing');
      const resources = (cargoType) => world.ents
        .filter((entity) => entity.alive && entity.kind === kinds.Resource && entity.cargoType === cargoType)
        .sort((a, b) => Math.hypot(a.x - hall.x, a.z - hall.z) - Math.hypot(b.x - hall.x, b.z - hall.z));
      const ore = resources(tile.Ore)[0];
      const solar = resources(tile.Solar)[0];
      if (!ore || !solar) throw new Error('safe policy nodes missing');
      const spots = [
        { x: hall.x - 3.4, z: hall.z - 3.4 },
        { x: hall.x, z: hall.z - 4.4 },
        { x: hall.x + 3.4, z: hall.z - 3.4 },
        { x: hall.x + 4.4, z: hall.z },
      ];
      const spot = spots.find((candidate) => world.canPlace(candidate.x, candidate.z, 1.05));
      if (!spot || !world.tryPlace(0, kinds.Barracks, spot.x, spot.z, workers[3].id)) throw new Error('legal player Yard placement failed');
      const yard = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === kinds.Barracks);
      if (!yard) throw new Error('player Yard missing after tryPlace');
      return {
        hallId: hall.id,
        yardId: yard.id,
        builderId: workers[3].id,
        workerIds: workers.map((worker) => worker.id),
        oreId: ore.id,
        solarId: solar.id,
        tick: world.tick,
      };
    }, { kinds: KIND, tile: TILE, ord: ORD });
    manifest.checks.policySetup = policy;

    const completed = await page.evaluate(({ yardId }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      const yard = world.ents[yardId];
      while (yard.progress < 1 && world.winner === -1 && world.tick < 10000) {
        world.step();
        globalThis.__VS5_OBSERVE__?.();
      }
      if (yard.progress < 1) throw new Error(`Yard did not complete by tick ${world.tick}`);
      return { tick: world.tick, yardProgress: yard.progress, ore: world.teams[0].ore, charge: world.teams[0].energy };
    }, policy);
    manifest.checks.yard = completed;
    current = await guidance(page);
    requireThat(current.state === 'assign-ore', `02 state ${current.state}`);
    requireThat(current.primary === 'Assign 2 Workers to Ore' && current.secondary === 'Ore Workers 0/2 · Find Idle Worker → GATHER → marked Ore', `02 copy ${JSON.stringify(current)}`);
    requireThat(!current.targetHidden && current.target === 'ORE · 0/2', `02 target ${JSON.stringify(current)}`);
    await capture(page, out, manifest, '02-assign-ore', current);

    const firstAssignment = await page.evaluate(({ workerId, oreId, ord }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      const worker = world.ents[workerId];
      const ore = world.ents[oreId];
      world.issue([worker.id], ord.Gather, ore.x, ore.z, ore.id);
      globalThis.__VS5_OBSERVE__?.();
      return { tick: world.tick, workerId, workerOrder: worker.order, workerTarget: worker.tid, oreId: ore.id };
    }, { workerId: policy.workerIds[0], oreId: policy.oreId, ord: ORD });
    manifest.checks.firstOreAssignment = firstAssignment;
    await settle(page);
    current = await guidance(page);
    requireThat(current.state === 'assign-ore', `02->1 state ${current.state}`);
    requireThat(current.primary === 'Assign 2 Workers to Ore' && current.secondary === 'Ore Workers 1/2 · Find Idle Worker → GATHER → marked Ore', `02->1 copy ${JSON.stringify(current)}`);
    requireThat(!current.targetHidden && current.target === 'ORE · 1/2', `02->1 target ${JSON.stringify(current)}`);

    const secondAssignment = await page.evaluate(({ secondWorkerId, solarWorkerId, oreId, solarId, ord }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      const secondWorker = world.ents[secondWorkerId];
      const solarWorker = world.ents[solarWorkerId];
      const ore = world.ents[oreId];
      const solar = world.ents[solarId];
      world.issue([secondWorker.id], ord.Gather, ore.x, ore.z, ore.id);
      world.issue([solarWorker.id], ord.Gather, solar.x, solar.z, solar.id);
      globalThis.__VS5_OBSERVE__?.();
      return {
        tick: world.tick,
        oreWorkerId: secondWorker.id,
        oreWorkerOrder: secondWorker.order,
        oreWorkerTarget: secondWorker.tid,
        solarWorkerId: solarWorker.id,
        solarWorkerOrder: solarWorker.order,
        solarWorkerTarget: solarWorker.tid,
        oreId: ore.id,
        solarId: solar.id,
      };
    }, { secondWorkerId: policy.workerIds[1], solarWorkerId: policy.workerIds[2], oreId: policy.oreId, solarId: policy.solarId, ord: ORD });
    manifest.checks.secondOreAndSolarAssignment = secondAssignment;
    await settle(page);
    current = await guidance(page);
    requireThat(current.state === 'fund-path', `03 state ${current.state}`);
    requireThat(current.primary === 'Fund technology' && current.secondary === `Ore ${Math.floor(current.ore)}/400 · Charge ${Math.floor(current.charge)}/80 · Ore Workers 2/2`, `03 copy ${JSON.stringify(current)}`);
    requireThat(!current.targetHidden && current.target === 'ORE · 2/2', `03 target ${JSON.stringify(current)}`);
    await capture(page, out, manifest, '03-fund-path', current);

    const builderAssignment = await page.evaluate(({ builderId, oreId, ord }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      const builder = world.ents[builderId];
      const ore = world.ents[oreId];
      world.issue([builder.id], ord.Gather, ore.x, ore.z, ore.id);
      globalThis.__VS5_OBSERVE__?.();
      return { tick: world.tick, workerId: builder.id, workerOrder: builder.order, workerTarget: builder.tid, oreId: ore.id };
    }, { builderId: policy.builderId, oreId: policy.oreId, ord: ORD });
    manifest.checks.builderFollowup = builderAssignment;

    const funds = await page.evaluate(({ hallId }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      while ((world.teams[0].ore < 400 || world.teams[0].energy < 80) && world.winner === -1 && world.tick < 12000) {
        world.step();
        globalThis.__VS5_OBSERVE__?.();
      }
      if (world.teams[0].ore < 400 || world.teams[0].energy < 80) throw new Error(`path funds missed at tick ${world.tick}: ${world.teams[0].ore}/${world.teams[0].energy}`);
      const input = globalThis.__STARHOLD_INPUT__;
      input.selected = new Set([hallId]);
      return { tick: world.tick, ore: world.teams[0].ore, charge: world.teams[0].energy, techPath: world.techPathOf(0), winner: world.winner };
    }, { hallId: policy.hallId });
    manifest.checks.funded = funds;
    await settle(page);
    current = await guidance(page);
    const pathButtons = current.deck.filter((button) => button.cmd === 'path-solar-ascendancy' || button.cmd === 'path-sky-dominion');
    const pathRects = await pathButtonRects(page);
    requireThat(current.state === 'choose-path', `04 state ${current.state}`);
    requireThat(current.primary === 'Choose a technology path' && current.secondary === 'Select your Nexus and commit one of two doctrines', `04 copy ${JSON.stringify(current)}`);
    requireThat(!current.targetHidden && current.target === 'NEXUS', `04 target ${JSON.stringify(current)}`);
    requireThat(pathButtons.length === 2 && pathButtons.every((button) => button.text.includes('400 Ore · 80 Charge')), `04 path costs ${JSON.stringify(pathButtons)}`);
    requireThat(pathRects.length === 2, `04 path rect count ${JSON.stringify(pathRects)}`);
    requireThat(pathRects.every((button) => button.visible && button.enabled), `04 path visibility/enabled ${JSON.stringify(pathRects)}`);
    requireThat(pathRects.every((button) => button.width >= 44 && button.height >= 88), `04 path minimum geometry ${JSON.stringify(pathRects)}`);
    requireThat(pathRects.every((button) => button.left >= 0 && button.top >= 0 && button.right <= VIEWPORT.width && button.bottom <= VIEWPORT.height), `04 path viewport geometry ${JSON.stringify(pathRects)}`);
    requireThat(Math.abs(pathRects[0].top - pathRects[1].top) <= 4, `04 path row geometry ${JSON.stringify(pathRects)}`);
    requireThat(pathRects.every((button) => button.text.includes('400 Ore · 80 Charge')), `04 path rect costs ${JSON.stringify(pathRects)}`);
    await capture(page, out, manifest, '04-choose-path', { ...current, pathButtons, pathRects });

    const committed = await page.evaluate(() => {
      const world = globalThis.__STARHOLD_WORLD__;
      const ok = world.tryCommitPath(0, 'sky-dominion');
      globalThis.__VS5_OBSERVE__?.();
      return { ok, tick: world.tick, pendingPath: world.pendingPathOf(0), channelT: world.pathChannelT(0), ore: world.teams[0].ore, charge: world.teams[0].energy };
    });
    requireThat(committed.ok && committed.pendingPath === 'sky-dominion' && committed.channelT > 0, `path commit failed ${JSON.stringify(committed)}`);
    const channelBefore = await guidance(page);
    requireThat(channelBefore.state === 'path-channel' && channelBefore.primary === `Technology locks in ${Math.ceil(channelBefore.channelT)}s`, `05 initial channel ${JSON.stringify(channelBefore)}`);
    requireThat(!channelBefore.targetHidden && channelBefore.target === 'NEXUS', `05 target ${JSON.stringify(channelBefore)}`);
    const channelBeforeRects = await pathButtonRects(page);
    const combinedPrecommitWidth = pathRects[0].width + pathRects[1].width;
    requireThat(channelBeforeRects.length === 1, `05 path rect count ${JSON.stringify(channelBeforeRects)}`);
    requireThat(channelBeforeRects[0].visible && !channelBeforeRects[0].enabled, `05 path visibility/enabled ${JSON.stringify(channelBeforeRects)}`);
    requireThat(channelBeforeRects[0].left >= 0 && channelBeforeRects[0].top >= 0 && channelBeforeRects[0].right <= VIEWPORT.width && channelBeforeRects[0].bottom <= VIEWPORT.height, `05 path viewport geometry ${JSON.stringify(channelBeforeRects)}`);
    requireThat(channelBeforeRects[0].height >= 88, `05 path height ${JSON.stringify(channelBeforeRects)}`);
    requireThat(channelBeforeRects[0].width >= combinedPrecommitWidth - 4, `05 path combined width ${JSON.stringify({ combinedPrecommitWidth, channelBeforeRects })}`);
    requireThat(channelBeforeRects[0].text.includes('Committing') && /\d+s/.test(channelBeforeRects[0].text), `05 path countdown ${JSON.stringify(channelBeforeRects)}`);
    await stepWorld(page, 40);
    const channelAfter = await guidance(page);
    requireThat(channelAfter.state === 'path-channel', `05 channel state changed ${JSON.stringify(channelAfter)}`);
    requireThat(channelAfter.primary !== channelBefore.primary && channelAfter.channelT < channelBefore.channelT, `05 countdown did not update ${JSON.stringify({ channelBefore, channelAfter })}`);
    const channelAfterRects = await pathButtonRects(page);
    requireThat(channelAfterRects.length === 1, `05 updated path rect count ${JSON.stringify(channelAfterRects)}`);
    requireThat(channelAfterRects[0].visible && !channelAfterRects[0].enabled, `05 updated path visibility/enabled ${JSON.stringify(channelAfterRects)}`);
    requireThat(channelAfterRects[0].left >= 0 && channelAfterRects[0].top >= 0 && channelAfterRects[0].right <= VIEWPORT.width && channelAfterRects[0].bottom <= VIEWPORT.height, `05 updated path viewport geometry ${JSON.stringify(channelAfterRects)}`);
    requireThat(channelAfterRects[0].height >= 88, `05 updated path height ${JSON.stringify(channelAfterRects)}`);
    requireThat(channelAfterRects[0].width >= combinedPrecommitWidth - 4, `05 updated path combined width ${JSON.stringify({ combinedPrecommitWidth, channelAfterRects })}`);
    requireThat(channelAfterRects[0].text.includes('Committing') && /\d+s/.test(channelAfterRects[0].text), `05 updated path countdown ${JSON.stringify(channelAfterRects)}`);
    manifest.checks.channel = { before: channelBefore, beforeRects: channelBeforeRects, after: channelAfter, afterRects: channelAfterRects, combinedPrecommitWidth };
    await capture(page, out, manifest, '05-channel', { ...channelAfter, pathRects: channelAfterRects });

    const locked = await page.evaluate(({ yardId }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      while (world.techPathOf(0) === null && world.winner === -1 && world.tick < 14000) {
        world.step();
        globalThis.__VS5_OBSERVE__?.();
      }
      if (world.techPathOf(0) !== 'sky-dominion') throw new Error(`path did not lock at tick ${world.tick}`);
      globalThis.__STARHOLD_INPUT__.selected = new Set([yardId]);
      return { tick: world.tick, path: world.techPathOf(0), channelT: world.pathChannelT(0), ore: world.teams[0].ore, charge: world.teams[0].energy };
    }, { yardId: policy.yardId });
    manifest.checks.pathLock = locked;
    await settle(page);
    current = await guidance(page);
    requireThat(current.state === 'train-army', `06 state ${current.state}`);
    requireThat(current.primary === 'Train Lumen Guard + Solar Strider' && current.secondary === 'Select your Yard · Habitat only if population is full', `06 copy ${JSON.stringify(current)}`);
    requireThat(!current.targetHidden && current.target === 'YARD', `06 target ${JSON.stringify(current)}`);
    await capture(page, out, manifest, '06-train-army', current);

    const army = await page.evaluate(({ yardId, kinds }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      const yard = world.ents[yardId];
      const alive = (kind) => world.ents.some((entity) => entity.alive && entity.hp > 0 && entity.team === 0 && entity.kind === kind);
      if (!world.tryTrain(yard, kinds.Fighter)) throw new Error('normal player Fighter tryTrain failed');
      while (!alive(kinds.Fighter) && world.winner === -1 && world.tick < 16000) {
        world.step();
        globalThis.__VS5_OBSERVE__?.();
      }
      if (!alive(kinds.Fighter)) throw new Error('player Fighter did not finish normally');
      while ((world.teams[0].ore < 90 || world.teams[0].energy < 20) && world.winner === -1 && world.tick < 18000) {
        world.step();
        globalThis.__VS5_OBSERVE__?.();
      }
      if (!world.tryTrain(yard, kinds.Ravager)) throw new Error('normal player unique tryTrain failed');
      while (!alive(kinds.Ravager) && world.winner === -1 && world.tick < 18000) {
        world.step();
        globalThis.__VS5_OBSERVE__?.();
      }
      if (!alive(kinds.Ravager)) throw new Error('player Solar Strider did not finish normally');
      return {
        tick: world.tick,
        fighter: world.ents.filter((entity) => entity.alive && entity.hp > 0 && entity.team === 0 && entity.kind === kinds.Fighter).length,
        unique: world.ents.filter((entity) => entity.alive && entity.hp > 0 && entity.team === 0 && entity.kind === kinds.Ravager).length,
        winner: world.winner,
      };
    }, { yardId: policy.yardId, kinds: KIND });
    manifest.checks.army = army;
    requireThat(army.tick <= 10 * 60 * SIM_HZ && army.fighter >= 1 && army.unique >= 1, `07 army deadline ${JSON.stringify(army)}`);
    await settle(page);
    current = await guidance(page);
    requireThat(current.state === 'select-scout', `07 state ${current.state}`);
    requireThat(current.target !== 'RIVAL NEXUS', `07 hidden rival target leaked ${JSON.stringify(current)}`);
    await capture(page, out, manifest, '07-mixed-army', { ...current, army });

    const objectiveDiscovery = await page.evaluate(({ kinds, ord, seenPlayer, maxTicks }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      const scout = world.ents.find((entity) => entity.alive && entity.hp > 0 && entity.team === 0 && entity.kind === kinds.Scout);
      const central = world.landmarks.find((landmark) => landmark.id === 'central-lumen-field');
      if (!scout || !central) throw new Error('mixed army objective fixture missing player Scout/Central Lumen');
      world.issue([scout.id], ord.Move, central.x, central.z, -1);
      const issue = { tick: world.tick, scoutId: scout.id, order: scout.order, target: scout.tid, x: central.x, z: central.z };
      while ((central.discoveredBy & seenPlayer) === 0 && world.winner === -1 && world.tick < maxTicks) {
        world.step();
        globalThis.__VS5_OBSERVE__?.();
      }
      const fighter = world.ents.find((entity) => entity.alive && entity.hp > 0 && entity.team === 0 && entity.kind === kinds.Fighter);
      const unique = world.ents.find((entity) => entity.alive && entity.hp > 0 && entity.team === 0 && entity.kind === kinds.Ravager);
      return {
        tick: world.tick,
        discovered: (central.discoveredBy & seenPlayer) !== 0,
        landmarkDiscoveredBy: central.discoveredBy,
        issue,
        lumen: world.lumenState(),
        scoutId: scout.id,
        fighterId: fighter?.id ?? -1,
        uniqueId: unique?.id ?? -1,
        pairAlive: Boolean(fighter && unique),
        winner: world.winner,
      };
    }, { kinds: { ...KIND }, ord: ORD, seenPlayer: SEEN_PLAYER, maxTicks: MAX_TICKS });
    manifest.checks.objectiveDiscovery = objectiveDiscovery;
    requireThat(objectiveDiscovery.discovered, `08 Lumen was not naturally discovered ${JSON.stringify(objectiveDiscovery)}`);
    requireThat(objectiveDiscovery.pairAlive, `08 mixed pair did not remain alive ${JSON.stringify(objectiveDiscovery)}`);
    await settle(page);
    current = await guidance(page);
    requireThat(current.state === 'secure-lumen', `08 state ${current.state}`);
    requireThat(current.primary === 'Secure the Central Lumen Field' && current.secondary === 'Select your army · ATTACK → marked Lumen', `08 copy ${JSON.stringify(current)}`);
    requireThat(!current.targetHidden && current.target === 'LUMEN', `08 target ${JSON.stringify(current)}`);
    requireThat(!current.lumenPanelHidden && current.lumenLabel.startsWith('LUMEN · '), `08 Lumen panel ${JSON.stringify(current)}`);
    await capture(page, out, manifest, '08-secure-lumen', { ...current, objectiveDiscovery });

    const lumenControl = await page.evaluate(({ fighterId, uniqueId, ord, maxTicks }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      const input = globalThis.__STARHOLD_INPUT__;
      const central = world.landmarks.find((landmark) => landmark.id === 'central-lumen-field');
      if (!central) throw new Error('Central Lumen missing for control proof');
      const pair = [fighterId, uniqueId].filter((id) => id >= 0 && world.ents[id]?.alive && world.ents[id]?.hp > 0);
      if (pair.length !== 2) throw new Error(`mixed pair unavailable for Lumen control: ${JSON.stringify(pair)}`);
      input.selected = new Set(pair);
      world.issue(pair, ord.AttackMove, central.x, central.z, -1);
      const scout = world.ents.find((entity) => entity.alive && entity.hp > 0 && entity.team === 0 && entity.kind === 1);
      if (scout) world.issue([scout.id], ord.Move, central.x - 8, central.z - 8, -1);
      const issue = { tick: world.tick, ids: pair, order: world.ents[pair[0]].order, target: world.ents[pair[0]].tid, x: central.x, z: central.z };
      const startTick = world.tick;
      while (world.lumenState().owner !== 0 && world.winner === -1 && world.tick < maxTicks) {
        world.step();
        globalThis.__VS5_OBSERVE__?.();
      }
      const state = world.lumenState();
      return {
        startTick,
        tick: world.tick,
        issue,
        pair,
        scoutId: scout?.id ?? -1,
        pairAlive: pair.every((id) => world.ents[id].alive && world.ents[id].hp > 0),
        owner0: state.owner === 0,
        lumen: state,
        winner: world.winner,
      };
    }, { fighterId: objectiveDiscovery.fighterId, uniqueId: objectiveDiscovery.uniqueId, ord: ORD, maxTicks: MAX_TICKS });
    manifest.checks.lumenControl = lumenControl;
    requireThat(lumenControl.owner0, `09 player did not naturally capture Lumen ${JSON.stringify(lumenControl)}`);
    requireThat(lumenControl.pairAlive, `09 mixed pair did not remain alive through capture ${JSON.stringify(lumenControl)}`);
    await settle(page);
    current = await guidance(page);
    requireThat(current.state === 'push-lumen', `09 state ${current.state}`);
    requireThat(current.primary === 'Push through the Lumen lane' && current.secondary === 'Select your army · ATTACK beyond the field', `09 copy ${JSON.stringify(current)}`);
    requireThat(!current.targetHidden && current.target === 'PUSH', `09 target ${JSON.stringify(current)}`);
    requireThat(!current.lumenPanelHidden && current.lumenLabel.startsWith('LUMEN · '), `09 Lumen panel ${JSON.stringify(current)}`);
    await capture(page, out, manifest, '09-lumen-control', { ...current, lumenControl });

    const rivalDiscovery = await page.evaluate(({ fighterId, uniqueId, scoutId, ord, seenPlayer, maxTicks }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      const scout = scoutId >= 0 ? world.ents[scoutId] : null;
      const rivalHall = world.ents.find((entity) => entity.alive && entity.hp > 0 && entity.team === 1 && entity.kind === 10);
      const central = world.landmarks.find((landmark) => landmark.id === 'central-lumen-field');
      if (!scout || !rivalHall || !central) throw new Error('rival discovery fixture missing Scout/Hall/Central Lumen');
      const pair = [fighterId, uniqueId].filter((id) => id >= 0 && world.ents[id]?.alive && world.ents[id]?.hp > 0);
      const beyond = { x: rivalHall.x, z: rivalHall.z };
      world.issue([scout.id], ord.Move, beyond.x, beyond.z, -1);
      if (pair.length > 0) world.issue(pair, ord.AttackMove, beyond.x, beyond.z, -1);
      const issues = {
        scout: { ids: [scout.id], order: scout.order, target: scout.tid, x: beyond.x, z: beyond.z },
        army: pair.length > 0 ? { ids: pair, order: world.ents[pair[0]].order, target: world.ents[pair[0]].tid, x: beyond.x, z: beyond.z } : null,
        field: { x: central.x, z: central.z },
      };
      while ((rivalHall.seenBy & seenPlayer) === 0 && world.winner === -1 && world.tick < maxTicks) {
        world.step();
        globalThis.__VS5_OBSERVE__?.();
      }
      return {
        tick: world.tick,
        discovered: (rivalHall.seenBy & seenPlayer) !== 0,
        hallId: rivalHall.id,
        hallSeenBy: rivalHall.seenBy,
        pair,
        pairAlive: pair.length > 0 && pair.some((id) => world.ents[id].alive && world.ents[id].hp > 0),
        lumen: world.lumenState(),
        issues,
        winner: world.winner,
      };
    }, { fighterId: objectiveDiscovery.fighterId, uniqueId: objectiveDiscovery.uniqueId, scoutId: objectiveDiscovery.scoutId, ord: ORD, seenPlayer: SEEN_PLAYER, maxTicks: MAX_TICKS });
    manifest.checks.rivalDiscovery = rivalDiscovery;
    requireThat(rivalDiscovery.discovered, `10 rival Nexus was not naturally discovered ${JSON.stringify(rivalDiscovery)}`);
    await settle(page);
    current = await guidance(page);
    requireThat(current.state === 'destroy-core', `10 state ${current.state}`);
    requireThat(current.primary === 'Destroy the rival Nexus' && current.secondary === 'Select your army · ATTACK → marked Nexus', `10 copy ${JSON.stringify(current)}`);
    requireThat(!current.targetHidden && current.target === 'RIVAL NEXUS', `10 target ${JSON.stringify(current)}`);
    requireThat(!current.lumenPanelHidden && current.lumenLabel.startsWith('LUMEN · '), `10 Lumen panel ${JSON.stringify(current)}`);
    await capture(page, out, manifest, '10-destroy-core', { ...current, rivalDiscovery });

    const attack = await page.evaluate(({ hallId, ord }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      const hall = world.ents[hallId];
      const army = world.ents
        .filter((entity) => entity.alive && entity.hp > 0 && entity.team === 0
          && (entity.kind === 2 || entity.kind === 4 || entity.kind === 5))
        .map((entity) => entity.id);
      if (hall?.alive && hall.hp > 0 && army.length > 0) {
        globalThis.__STARHOLD_INPUT__.selected = new Set(army);
        world.issue(army, ord.Attack, hall.x, hall.z, hall.id);
      }
      return {
        tick: world.tick,
        hallId,
        army,
        issued: Boolean(hall?.alive && hall.hp > 0 && army.length > 0),
        order: army[0] === undefined ? -1 : world.ents[army[0]].order,
        target: army[0] === undefined ? -1 : world.ents[army[0]].tid,
      };
    }, { hallId: rivalDiscovery.hallId, ord: ORD });
    manifest.checks.attack = attack;

    const terminal = await page.evaluate(({ maxTicks, kinds }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      const trace = globalThis.__VS5_TRACE__;
      while (world.winner === -1 && world.tick < maxTicks) {
        world.step();
        globalThis.__VS5_OBSERVE__?.();
      }
      const hall = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === kinds.Hall);
      const discoveryEvent = hall ? world.discoveryLog.find((event) => event.team === 1 && event.id === hall.id) : null;
      const replacementCallsAfterDiscovery = trace.trainCalls.filter((call) => call.ok && call.team === 1 && call.buildingKind === kinds.Hall && call.kind === kinds.Scout && discoveryEvent && call.tick > discoveryEvent.tick);
      return {
        tick: world.tick,
        minute: world.tick / 1200,
        winner: world.winner,
        discoveryTick: discoveryEvent?.tick ?? trace.coreDiscoveryTick,
        attackTick: trace.attackTick,
        winnerTick: trace.winnerTick,
        replacementCallsAfterDiscovery: replacementCallsAfterDiscovery.length,
        stats: world.matchStats(),
        trace,
      };
    }, { maxTicks: MAX_TICKS, kinds: { ...KIND } });
    manifest.checks.terminal = terminal;
    requireThat(terminal.winner === 0 || terminal.winner === 1, `terminal winner was not real ${JSON.stringify(terminal)}`);
    requireThat(terminal.tick <= MAX_TICKS, `terminal missed 18:00 ${JSON.stringify(terminal)}`);
    requireThat(terminal.discoveryTick >= 0, `replacement scenario did not discover Core ${JSON.stringify(terminal)}`);
    requireThat(terminal.attackTick >= 8 * 60 * SIM_HZ, `attack floor missed ${JSON.stringify(terminal)}`);
    requireThat(terminal.replacementCallsAfterDiscovery === 0, `replacement trained after discovery ${JSON.stringify(terminal)}`);
    const qa = await page.evaluate(() => globalThis.__STARHAVEN_QA__);
    requireThat(qa?.winner === terminal.winner || qa?.state === 'Playing', `QA winner probe mismatch before terminal dispatch ${JSON.stringify(qa)}`);
    const event = terminal.winner === 0 ? 'MATCH_WON' : 'MATCH_LOST';
    await page.evaluate((eventName) => globalThis.__STARHAVEN_QA__?.dispatch(eventName), event);
    await page.waitForFunction((expected) => globalThis.__STARHAVEN_QA__?.state === expected, terminal.winner === 0 ? 'Victory' : 'Defeat', { timeout: PROBE_TIMEOUT_MS });
    const replacement = terminal.trace.trainCalls.filter((call) => call.ok && call.team === 1 && call.buildingKind === KIND.Hall && call.kind === KIND.Scout)[0] ?? null;
    manifest.checks.replacement = replacement;
    requireThat(replacement && replacement.delta.ore === 40 && replacement.delta.gas === 0 && replacement.delta.energy === 15 && replacement.trainT === 6, `replacement cost/time ${JSON.stringify(replacement)}`);
    await capture(page, out, manifest, '11-terminal', { ...terminal, attack, replacement, state: await page.evaluate(() => globalThis.__STARHAVEN_QA__?.state ?? '') });

    const renderer = await rendererName(page);
    const simStepMs = await page.evaluate((seed) => {
      const CurrentWorld = globalThis.__STARHOLD_WORLD__?.constructor;
      if (!CurrentWorld) throw new Error('World constructor missing for performance probe');
      const sample = new CurrentWorld();
      sample.reset(seed);
      const start = performance.now();
      for (let index = 0; index < 600; index++) sample.step();
      return Math.round(((performance.now() - start) / 600) * 10000) / 10000;
    }, SEED);
    const softwareGl = /swiftshader|llvmpipe|software|mesa/i.test(renderer) || renderer === 'none' || renderer === 'masked';
    const simShareMs = Math.round(simStepMs * 5 * 10000) / 10000;
    manifest.checks.performance = { renderer, softwareGl, simStepMs, simShareMs, p99FrameMs: await page.evaluate(() => globalThis.__STARHAVEN_QA__?.p99FrameMs ?? 0) };
    requireThat(manifest.consoleErrors.length === 0, `console/page errors: ${manifest.consoleErrors.join(' | ')}`);
    requireThat(softwareGl ? simShareMs < P99_BUDGET_MS : manifest.checks.performance.p99FrameMs < P99_BUDGET_MS, `performance budget failed ${JSON.stringify(manifest.checks.performance)}`);
    manifest.checks.simSharePolicy = {
      noWinnerWrite: terminal.winner === (await page.evaluate(() => globalThis.__STARHOLD_WORLD__?.winner ?? -1)),
      resourcesGranted: false,
      directSpawnAfterReset: false,
      simShareMs,
      boundMs: P99_BUDGET_MS,
    };
    manifest.ok = true;
  } catch (error) {
    manifest.errors.push(error?.stack ?? String(error));
  } finally {
    try { if (browser) await browser.close(); } catch {}
    try { await stopServer(server); } catch {}
    manifest.finishedAt = new Date().toISOString();
    const manifestPath = path.join(out, 'manifest.json');
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log('--- qa-vs5-pacing summary ---');
    console.log(`ok=${manifest.ok} terminal=${manifest.checks.terminal?.winner ?? 'n/a'} tick=${manifest.checks.terminal?.tick ?? 'n/a'} simShare=${manifest.checks.performance?.simShareMs ?? 'n/a'}ms errors=${manifest.consoleErrors.length}`);
    console.log(`manifest=${manifestPath}`);
    if (manifest.errors.length) for (const error of manifest.errors) console.log(`  - ${error.split('\n')[0]}`);
    if (!manifest.ok) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
