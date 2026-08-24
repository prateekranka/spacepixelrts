#!/usr/bin/env node
/** VS-2A browser proof: honest AI Yard, path channel, mixed force, and fog-gated attack. */

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
const SIM_HZ = 20;
const MAX_TICKS = 21600;
const AI_PATH_EARLIEST_TICK = Math.round(4.5 * 60 * SIM_HZ);
const AI_PATH_LATEST_TICK = Math.round(7.5 * 60 * SIM_HZ);
const AI_ATTACK_EARLIEST_TICK = Math.round(8 * 60 * SIM_HZ);
const AI_ATTACK_LATEST_TICK = Math.round(12 * 60 * SIM_HZ);
const STEP_CHUNK = 30;
const P99_BUDGET_MS = 8;
const HONEST_STEP_GAIN_BOUND = 96;
const SEEN_RIVAL = 2;
const CENTER = { x: 36, z: 37.44 };
const KIND = { Fighter: 2, Siege: 3, Ravager: 4, Prism: 5, Shade: 6, Hall: 10, House: 11, Barracks: 12 };
const ORD = { Attack: 2, AttackMove: 6 };
const NAV_TIMEOUT_MS = 30000;
const PROBE_TIMEOUT_MS = 30000;
const SERVER_BOOT_TIMEOUT_MS = 120000;

function minuteAt(tick) {
  return Math.round((tick / SIM_HZ / 60) * 100) / 100;
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
  const state = { child, url, exited: false };
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

async function readWorld(page) {
  return page.evaluate(({ kinds, orders, center, seenRival, attackEarliestTick }) => {
    const world = globalThis.__STARHOLD_WORLD__;
    if (!world) throw new Error('__STARHOLD_WORLD__ missing');
    const eco = world.teams[1];
    const hall = world.ents.find((e) => e.alive && e.team === 0 && e.kind === kinds.Hall);
    const yard = world.ents.find((e) => e.alive && e.team === 1 && e.kind === kinds.Barracks);
    const unique = world.civ[1] === 'vespari' ? kinds.Ravager : kinds.Prism;
    const force = world.ents.filter(
      (e) => e.alive && e.hp > 0 && e.team === 1 && (e.kind === kinds.Fighter || e.kind === unique),
    );
    const attackTargets = force.filter(
      (e) => e.tid >= 0 && e.tid === hall?.id && (e.order === orders.Attack || e.order === orders.AttackMove),
    );
    const hiddenCoreTargets = attackTargets.filter(() => !hall || (hall.seenBy & seenRival) === 0).length;
    const hallTile = hall ? (Math.floor(hall.z) * 72 + Math.floor(hall.x)) : -1;
    let explored = 0;
    for (const value of world.explored[1]) explored += value;
    return {
      tick: world.tick,
      civ: world.civ.slice(0, 2),
      difficulty: world.aiDifficulty,
      scriptedMarshalEnabled: world.scriptedMarshalEnabled,
      eco: JSON.parse(JSON.stringify(eco)),
      path: world.techPathOf(1),
      pendingPath: world.pendingPathOf(1),
      channelT: world.pathChannelT(1),
      yard: yard ? {
        id: yard.id,
        x: yard.x,
        z: yard.z,
        progress: yard.progress,
        rallyX: yard.rallyX,
        rallyZ: yard.rallyZ,
      } : null,
      hall: hall ? {
        id: hall.id,
        seenBy: hall.seenBy,
        visibleNow: hallTile >= 0 ? world.visible[1][hallTile] === 1 : false,
      } : null,
      explored,
      counts: {
        fighter: force.filter((e) => e.kind === kinds.Fighter).length,
        unique: force.filter((e) => e.kind === unique).length,
        uniqueKind: unique,
        sieges: world.ents.filter((e) => e.alive && e.team === 1 && e.kind === kinds.Siege).length,
        shades: world.ents.filter((e) => e.alive && e.team === 1 && e.kind === kinds.Shade).length,
      },
      force: force.map((e) => ({
        id: e.id,
        kind: e.kind,
        order: e.order,
        tid: e.tid,
        tx: e.tx,
        tz: e.tz,
        x: e.x,
        z: e.z,
        centerDistance: Math.hypot(e.x - center.x, e.z - center.z),
      })),
      centerAttackMoves: force.filter(
        (e) => e.order === orders.AttackMove
          && e.tid === -1
          && Math.abs(e.tx - center.x) < 1e-9
          && Math.abs(e.tz - center.z) < 1e-9,
      ).length,
      attackTargets: attackTargets.map((e) => ({ id: e.id, kind: e.kind, order: e.order, tid: e.tid })),
      hiddenCoreTargets,
      beforeAttackFloorCoreTargets: world.tick < attackEarliestTick ? attackTargets.length : 0,
    };
  }, { kinds: KIND, orders: ORD, center: CENTER, seenRival: SEEN_RIVAL, attackEarliestTick: AI_ATTACK_EARLIEST_TICK });
}

async function stepWorld(page, steps) {
  return page.evaluate((count) => {
    const world = globalThis.__STARHOLD_WORLD__;
    if (!world) throw new Error('__STARHOLD_WORLD__ missing');
    let maxPositiveGain = 0;
    for (let index = 0; index < count; index++) {
      const before = {
        ore: world.teams[1].ore,
        gas: world.teams[1].gas,
        energy: world.teams[1].energy,
      };
      world.step();
      const after = world.teams[1];
      const gain = Math.max(0, after.ore - before.ore)
        + Math.max(0, after.gas - before.gas)
        + Math.max(0, after.energy - before.energy);
      maxPositiveGain = Math.max(maxPositiveGain, gain);
    }
    return { tick: world.tick, maxPositiveGain };
  }, steps);
}

async function capture(page, out, name, camera, manifest, audit) {
  await stageCamera(page, camera);
  await settleFrames(page);
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file, type: 'png' });
  manifest.captures[name] = { file: path.basename(file), image: analyzePng(file), audit };
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = resolveOut(args.out);
  fs.mkdirSync(out, { recursive: true });
  const manifest = {
    tool: 'qa-vs2-ai-doctrine',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: {
      out,
      route: 'opening',
      query: '?qa=opening&qa-run=1',
      viewport: VIEWPORT,
      seed: EXPECTED_SEED,
      difficulty: 'standard',
      maxTicks: MAX_TICKS,
      simHz: SIM_HZ,
      directWorldFastStepOnly: true,
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
    console.log(`qa-vs2-ai-doctrine: dev server ready at ${server.url}`);
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
      frozen: entryProbe.frozen,
      config: entryProbe.config,
    };
    if (entryProbe.scenario !== 'opening') throw new Error('scenario != opening');
    if (
      entryProbe.config?.seed !== EXPECTED_SEED
      || entryProbe.config?.seedMode !== 'deterministic'
      || entryProbe.config?.difficulty !== 'standard'
      || entryProbe.config?.fogOfWar !== true
    ) throw new Error(`unexpected opening config: ${JSON.stringify(entryProbe.config)}`);

    let audit = await readWorld(page);
    const initialExplored = audit.explored;
    let maxPositiveStepGain = 0;
    let hiddenCoreTargetEver = 0;
    let beforeAttackFloorCoreTargetEver = 0;
    const milestones = {
      yard: null,
      yardComplete: null,
      pathStart: null,
      pathLocked: null,
      forceReady: null,
      mixedCenter: null,
      discoveredCoreAttack: null,
    };
    let yardSeen = false;
    let pathSeen = false;
    let forceReadySeen = false;
    let mixedSeen = false;
    let attackSeen = false;
    let previousCoreSeen = audit.hall ? (audit.hall.seenBy & SEEN_RIVAL) !== 0 : false;
    const snapshot = (value) => JSON.parse(JSON.stringify(value));

    while (audit.tick < MAX_TICKS && (!milestones.yard || !milestones.pathStart || !milestones.pathLocked || !milestones.forceReady || !milestones.mixedCenter || !milestones.discoveredCoreAttack)) {
      const stepped = await stepWorld(page, STEP_CHUNK);
      maxPositiveStepGain = Math.max(maxPositiveStepGain, stepped.maxPositiveGain);
      audit = await readWorld(page);
      hiddenCoreTargetEver += audit.hiddenCoreTargets;
      beforeAttackFloorCoreTargetEver += audit.beforeAttackFloorCoreTargets;
      const coreSeen = audit.hall ? (audit.hall.seenBy & SEEN_RIVAL) !== 0 : false;

      if (!yardSeen && audit.yard) {
        yardSeen = true;
        milestones.yard = { tick: audit.tick, minute: minuteAt(audit.tick), state: snapshot(audit) };
        await capture(page, out, 'yard-construction', { x: 56, z: 56, halfH: 20 }, manifest, audit);
      }
      if (!milestones.yardComplete && audit.yard?.progress >= 1) {
        milestones.yardComplete = { tick: audit.tick, minute: minuteAt(audit.tick), state: snapshot(audit) };
        await capture(page, out, 'yard-complete', { x: 56, z: 56, halfH: 20 }, manifest, audit);
      }
      if (!pathSeen && audit.channelT > 0 && audit.pendingPath === 'iron-colossus') {
        pathSeen = true;
        milestones.pathStart = { tick: audit.tick, minute: minuteAt(audit.tick), state: snapshot(audit) };
        await capture(page, out, 'path-channel', { x: 56, z: 56, halfH: 20 }, manifest, audit);
      }
      if (!milestones.pathLocked && audit.path === 'iron-colossus' && audit.channelT === 0) {
        milestones.pathLocked = { tick: audit.tick, minute: minuteAt(audit.tick), state: snapshot(audit) };
      }
      if (!forceReadySeen && audit.counts.fighter >= 2 && audit.counts.unique >= 2) {
        forceReadySeen = true;
        milestones.forceReady = { tick: audit.tick, minute: minuteAt(audit.tick), state: snapshot(audit) };
      }
      if (
        !mixedSeen
        && audit.tick < AI_ATTACK_EARLIEST_TICK
        && audit.counts.fighter >= 2
        && audit.counts.unique >= 2
        && audit.force.length >= 4
        && audit.centerAttackMoves === audit.force.length
        && audit.attackTargets.length === 0
      ) {
        mixedSeen = true;
        milestones.mixedCenter = {
          tick: audit.tick,
          minute: minuteAt(audit.tick),
          state: snapshot(audit),
          centerUnits: audit.force.filter((unit) => unit.centerDistance <= 8).length,
          centerAttackMoves: audit.centerAttackMoves,
          coreTargetCount: audit.attackTargets.length,
        };
        await capture(page, out, 'mixed-center-force', { x: CENTER.x, z: CENTER.z, halfH: 24 }, manifest, audit);
      }
      if (!attackSeen && audit.tick >= AI_ATTACK_EARLIEST_TICK && audit.attackTargets.length >= 4 && coreSeen) {
        attackSeen = true;
        milestones.discoveredCoreAttack = { tick: audit.tick, minute: minuteAt(audit.tick), state: snapshot(audit) };
        await capture(page, out, 'discovered-core-attack', { x: 36, z: 34, halfH: 30 }, manifest, audit);
      }
      if (!previousCoreSeen && coreSeen) {
        manifest.checks.coreDiscovery = { tick: audit.tick, hall: snapshot(audit.hall) };
      }
      previousCoreSeen = coreSeen;
    }

    // A final read is intentionally after the milestone loop; it does not alter state.
    audit = await readWorld(page);
    const perfProbe = await probe(page);
    const renderer = await rendererName(page);
    const softwareGl = /swiftshader|llvmpipe|software/i.test(renderer);
    const simStepMs = await page.evaluate((steps) => {
      const world = globalThis.__STARHOLD_WORLD__;
      if (!world) throw new Error('__STARHOLD_WORLD__ missing');
      const start = performance.now();
      for (let index = 0; index < steps; index++) world.step();
      return Math.round(((performance.now() - start) / steps) * 10000) / 10000;
    }, 600);
    const finalAudit = await readWorld(page);
    maxPositiveStepGain = Math.max(maxPositiveStepGain, 0);
    manifest.checks.milestones = milestones;
    manifest.checks.timing = {
      pathStart: milestones.pathStart ? { tick: milestones.pathStart.tick, minute: milestones.pathStart.minute } : null,
      pathLocked: milestones.pathLocked ? { tick: milestones.pathLocked.tick, minute: milestones.pathLocked.minute } : null,
      forceReady: milestones.forceReady ? { tick: milestones.forceReady.tick, minute: milestones.forceReady.minute } : null,
      discoveredCoreAttack: milestones.discoveredCoreAttack
        ? { tick: milestones.discoveredCoreAttack.tick, minute: milestones.discoveredCoreAttack.minute }
        : null,
    };
    manifest.checks.final = {
      ...finalAudit,
      initialExplored,
      minute: minuteAt(finalAudit.tick),
      maxPositiveStepGain,
      hiddenCoreTargetEver,
      beforeAttackFloorCoreTargetEver,
      renderer,
      softwareGl,
      simStepMs,
      p99FrameMs: perfProbe.p99FrameMs,
      renderP99Recorded: perfProbe.p99FrameMs,
    };
    manifest.checks.noGrantProof = {
      maxPositiveStepGain,
      hiddenCoreTargetEver,
      beforeAttackFloorCoreTargetEver,
      bound: HONEST_STEP_GAIN_BOUND,
      scriptedMarshalEnabled: finalAudit.scriptedMarshalEnabled,
      retiredKinds: { sieges: finalAudit.counts.sieges, shades: finalAudit.counts.shades },
      beforeAttackFloorCoreTargets: finalAudit.beforeAttackFloorCoreTargets,
      directWorldMutation: false,
    };

    if (!milestones.yard || !milestones.yardComplete) throw new Error('AI Yard construction milestone missed');
    if (!milestones.pathStart || !milestones.pathLocked) throw new Error('AI path channel/lock milestone missed');
    if (!milestones.forceReady) throw new Error('mixed Fighter/unique force-ready milestone missed');
    if (!milestones.mixedCenter) throw new Error('pre-8:00 mixed center force milestone missed');
    if (!milestones.discoveredCoreAttack) throw new Error('discovered-Core attack milestone missed');
    for (const [name, milestone] of Object.entries(milestones)) {
      if (milestone && milestone.tick > AI_ATTACK_LATEST_TICK) throw new Error(`${name} missed minute 12 at tick ${milestone.tick}`);
    }
    if (milestones.pathStart.tick < AI_PATH_EARLIEST_TICK || milestones.pathStart.tick > AI_PATH_LATEST_TICK) {
      throw new Error(`path start outside 4:30–7:30 at tick ${milestones.pathStart.tick}`);
    }
    if (milestones.forceReady.tick > AI_ATTACK_EARLIEST_TICK) throw new Error(`2+2 force missed 8:00 at tick ${milestones.forceReady.tick}`);
    if (milestones.mixedCenter.tick >= AI_ATTACK_EARLIEST_TICK) throw new Error(`mixed center capture is not before 8:00 at tick ${milestones.mixedCenter.tick}`);
    if (milestones.mixedCenter.centerAttackMoves !== milestones.mixedCenter.state.force.length) throw new Error('mixed center force is not all AttackMove to center');
    if (milestones.mixedCenter.coreTargetCount !== 0) throw new Error('mixed center force has a Core target');
    if (milestones.discoveredCoreAttack.tick < AI_ATTACK_EARLIEST_TICK || milestones.discoveredCoreAttack.tick > AI_ATTACK_LATEST_TICK) {
      throw new Error(`discovered-Core attack outside 8:00–12:00 at tick ${milestones.discoveredCoreAttack.tick}`);
    }
    if (finalAudit.difficulty !== 'standard') throw new Error(`AI difficulty != standard (${finalAudit.difficulty})`);
    if (finalAudit.scriptedMarshalEnabled !== false) throw new Error('scripted marshal must remain disabled');
    if (finalAudit.counts.sieges !== 0 || finalAudit.counts.shades !== 0) throw new Error('retired Siege/Shade present');
    if (maxPositiveStepGain > HONEST_STEP_GAIN_BOUND) throw new Error(`positive economy jump ${maxPositiveStepGain} exceeds honest bound ${HONEST_STEP_GAIN_BOUND}`);
    if (finalAudit.explored <= initialExplored) throw new Error(`AI exploration did not grow (${initialExplored} -> ${finalAudit.explored})`);
    if (hiddenCoreTargetEver > 0 || finalAudit.hiddenCoreTargets > 0) throw new Error('hidden player Core target observed');
    if (beforeAttackFloorCoreTargetEver > 0 || finalAudit.beforeAttackFloorCoreTargets > 0) throw new Error('pre-floor player Core target observed');
    if (manifest.errors.length > 0) throw new Error(`browser errors: ${manifest.errors.length}`);
    const frameBudget = softwareGl
      ? { mode: 'sim-share (software GL)', simStepMs, simShareMs: Math.round(simStepMs * 5 * 10000) / 10000, renderP99RecordedNotGated: perfProbe.p99FrameMs, renderer }
      : { mode: 'render-p99', p99FrameMs: perfProbe.p99FrameMs, renderer };
    if (softwareGl) {
      if (!(simStepMs * 5 < P99_BUDGET_MS)) throw new Error(`sim share ${(simStepMs * 5).toFixed(3)}ms exceeds ${P99_BUDGET_MS}ms`);
    } else if (!(perfProbe.p99FrameMs > 0 && perfProbe.p99FrameMs < P99_BUDGET_MS)) {
      throw new Error(`render p99 ${perfProbe.p99FrameMs}ms outside ${P99_BUDGET_MS}ms`);
    }
    manifest.checks.frameBudget = frameBudget;
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
    console.log('--- qa-vs2-ai-doctrine summary ---');
    console.log(`ok=${manifest.ok} tick=${manifest.checks.final?.tick ?? 'n/a'} p99=${manifest.checks.final?.p99FrameMs ?? 'n/a'}ms`);
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
