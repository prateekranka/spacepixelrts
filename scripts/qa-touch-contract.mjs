#!/usr/bin/env node
/** M6-A bounded browser proof: touch command modes, resource gathering, and context picks. */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = '/tmp/starhaven-touch-contract';
const VIEWPORT = { width: 1024, height: 768 };
const EXPECTED_SEED = 0x5eed;
const PROBE_TIMEOUT_MS = 30000;
const NAV_TIMEOUT_MS = 30000;
const SERVER_BOOT_TIMEOUT_MS = 120000;
const LONG_PRESS_MS = 500;
const RESOURCE_PICK_PX = 44;
const MAX_DEPOSIT_STEPS = 1400;

const KIND = { Worker: 0, Scout: 1, Resource: 20 };
const ORD = { Move: 1, Attack: 2, Gather: 3, AttackMove: 6 };
const TILE = { Ore: 3, Gas: 4, Solar: 5 };

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
  if (!requested || !path.isAbsolute(requested)) {
    throw new Error(`--out must be an absolute path outside the repository (default: ${DEFAULT_OUT})`);
  }
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

async function settleFrames(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

async function readProbe(page) {
  return page.evaluate(() => {
    const qa = globalThis.__STARHAVEN_QA__;
    return qa ? JSON.parse(JSON.stringify(qa)) : null;
  });
}

async function readSelection(page) {
  return page.evaluate(() => {
    const input = globalThis.__STARHOLD_INPUT__;
    const world = globalThis.__STARHOLD_WORLD__;
    if (!input || !world) throw new Error('QA input/world handles missing');
    return {
      ids: [...input.selected],
      mode: input.commandMode,
      place: input.place,
      entities: [...input.selected].map((id) => {
        const e = world.ents[id];
        return e ? { id, kind: e.kind, team: e.team, alive: e.alive, vis: e.vis, order: e.order, tid: e.tid, tx: e.tx, tz: e.tz } : null;
      }),
    };
  });
}

async function stageSelection(page, ids) {
  return page.evaluate((selectedIds) => {
    const input = globalThis.__STARHOLD_INPUT__;
    if (!input) throw new Error('__STARHOLD_INPUT__ missing');
    input.selected = new Set(selectedIds);
    return [...input.selected];
  }, ids);
}

async function readEntity(page, id) {
  return page.evaluate((entityId) => {
    const world = globalThis.__STARHOLD_WORLD__;
    const e = world?.ents[entityId];
    if (!e) throw new Error(`entity ${entityId} missing`);
    return { id: e.id, kind: e.kind, team: e.team, alive: e.alive, vis: e.vis, order: e.order, tid: e.tid, tx: e.tx, tz: e.tz, x: e.x, z: e.z, cargo: e.cargo };
  }, id);
}

async function locateGround(page, avoidId) {
  return page.evaluate((selectedId) => {
    const view = globalThis.__STARHOLD_VIEW__;
    const world = globalThis.__STARHOLD_WORLD__;
    if (!view || !world) throw new Error('QA view/world handles missing');
    const candidates = [];
    for (let y = 0.16; y <= 0.72; y += 0.055) {
      for (let x = 0.14; x <= 0.86; x += 0.055) candidates.push([x, y]);
    }
    const avoid = world.ents[selectedId];
    for (const [nx, ny] of candidates) {
      const hit = view.pick(nx, ny);
      if (!(hit.x > 1 && hit.x < 71 && hit.z > 1 && hit.z < 71)) continue;
      if (avoid && Math.hypot(hit.x - avoid.x, hit.z - avoid.z) < 3) continue;
      let occupied = false;
      for (const e of world.ents) {
        if (!e.alive || e.kind === 20) continue;
        if (Math.hypot(e.x - hit.x, e.z - hit.z) < 1.6) {
          occupied = true;
          break;
        }
      }
      if (occupied) continue;
      const rect = view.overlay.getBoundingClientRect();
      return {
        nx,
        ny,
        x: rect.left + nx * rect.width,
        y: rect.top + ny * rect.height,
        wx: Math.round(hit.x * 1000) / 1000,
        wz: Math.round(hit.z * 1000) / 1000,
      };
    }
    return null;
  }, avoidId);
}

async function locateResource(page, preferredId = null) {
  return page.evaluate(({ preferred, resourceKind, allowedTiles, pickRadius }) => {
    const view = globalThis.__STARHOLD_VIEW__;
    const world = globalThis.__STARHOLD_WORLD__;
    if (!view || !world) throw new Error('QA view/world handles missing');
    const rect = view.overlay.getBoundingClientRect();
    const resources = world.ents
      .filter((e) => e.alive && e.vis && e.kind === resourceKind && allowedTiles.includes(e.cargoType))
      .map((e) => {
        const p = view.project(e.x, 0.05, e.z);
        const x = rect.left + p.x * (rect.width / Math.max(1, view.overlay.width));
        const y = rect.top + p.y * (rect.height / Math.max(1, view.overlay.height));
        return { e, x, y };
      })
      .filter(({ x, y }) => x > 56 && x < window.innerWidth - 56 && y > 94 && y < window.innerHeight - 164)
      .sort((left, right) => Number(right.e.id === preferred) - Number(left.e.id === preferred));
    if (!resources.length) return null;
    const selected = resources[0];
    const dx = selected.x + 32 < rect.right - 4 ? 32 : -32;
    const tapX = selected.x + dx;
    const tapY = selected.y;
    return {
      id: selected.e.id,
      cargoType: selected.e.cargoType,
      x: selected.x,
      y: selected.y,
      tapX,
      tapY,
      tapDistance: Math.hypot(tapX - selected.x, tapY - selected.y),
      resourcePickRadius: pickRadius,
      worldX: selected.e.x,
      worldZ: selected.e.z,
    };
  }, { preferred: preferredId, resourceKind: KIND.Resource, allowedTiles: [TILE.Ore, TILE.Gas, TILE.Solar], pickRadius: RESOURCE_PICK_PX });
}

async function dispatchPointer(page, point, options = {}) {
  const pointerType = options.pointerType ?? 'touch';
  const button = options.button ?? 0;
  const buttons = options.buttons ?? (button === 2 ? 2 : 1);
  const pointerId = options.pointerId ?? 41;
  await page.evaluate(({ x, y, pointerType: type, buttonValue, buttonsValue, id }) => {
    const canvas = document.querySelector('#game');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('#game canvas missing');
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: id,
      pointerType: type,
      isPrimary: true,
      button: buttonValue,
      buttons: buttonsValue,
      clientX: x,
      clientY: y,
    };
    canvas.dispatchEvent(new PointerEvent('pointerdown', init));
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
  }, { x: point.x, y: point.y, pointerType, buttonValue: button, buttonsValue: buttons, id: pointerId });
}

async function dispatchLongPress(page, point, pointerId = 51) {
  await page.evaluate(({ x, y, holdMs, id }) => new Promise((resolve) => {
    const canvas = document.querySelector('#game');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('#game canvas missing');
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: id,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientX: x,
      clientY: y,
    };
    canvas.dispatchEvent(new PointerEvent('pointerdown', init));
    setTimeout(() => {
      canvas.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
      resolve();
    }, holdMs);
  }), { x: point.x, y: point.y, holdMs: LONG_PRESS_MS, id: pointerId });
}

async function clickCommand(page, cmd) {
  const button = page.locator(`#cmds button[data-cmd="${cmd}"]`);
  if (!(await button.isVisible())) throw new Error(`${cmd} command button is not visible`);
  if (!(await button.isEnabled())) throw new Error(`${cmd} command button is disabled`);
  await button.click();
  await settleFrames(page);
  return page.evaluate((command) => {
    const input = globalThis.__STARHOLD_INPUT__;
    const button = document.querySelector(`#cmds button[data-cmd="${command}"]`);
    return {
      mode: input?.commandMode ?? null,
      place: input?.place ?? null,
      className: button?.className ?? '',
      hint: document.querySelector('#hint')?.textContent ?? '',
    };
  }, cmd);
}

async function capture(page, out, manifest, key, filename) {
  await settleFrames(page);
  const file = path.join(out, filename);
  await page.screenshot({ path: file, type: 'png' });
  manifest.captures[key] = { file: path.basename(file), image: analyzePng(file) };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = resolveOut(args.out);
  fs.mkdirSync(out, { recursive: true });
  const manifest = {
    tool: 'qa-touch-contract',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: { out, route: 'opening', viewport: VIEWPORT, seed: EXPECTED_SEED },
    checks: {},
    captures: {},
    consoleErrors: [],
    errors: [],
    ok: false,
  };
  let server = null;
  let browser = null;
  let page = null;

  try {
    server = await startServer();
    console.log(`qa-touch-contract: dev server ready at ${server.url}`);

    browser = await chromium
      .launch({
        channel: 'chrome',
        headless: true,
        args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
      })
      .catch(() => chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] }));
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    page = await context.newPage();
    page.setDefaultTimeout(PROBE_TIMEOUT_MS);
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const entry = `console.error: ${message.text()}`;
        manifest.consoleErrors.push(entry);
        manifest.errors.push(entry);
      }
    });
    page.on('pageerror', (error) => {
      const entry = `pageerror: ${error?.message ?? String(error)}`;
      manifest.consoleErrors.push(entry);
      manifest.errors.push(entry);
    });

    await page.goto(`${server.url}/?qa=opening&qa-run=1`, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Playing', null, { timeout: PROBE_TIMEOUT_MS });
    const entry = await readProbe(page);
    manifest.checks.entry = {
      state: entry?.state,
      scenario: entry?.scenario,
      seed: entry?.config?.seed,
      viewport: await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })),
    };
    assert(entry?.scenario === 'opening', `scenario ${JSON.stringify(entry?.scenario)} != opening`);
    assert(entry?.config?.seed === EXPECTED_SEED, `unexpected deterministic config: ${JSON.stringify(entry?.config)}`);
    assert(manifest.checks.entry.viewport.width === VIEWPORT.width && manifest.checks.entry.viewport.height === VIEWPORT.height, `viewport is ${JSON.stringify(manifest.checks.entry.viewport)}, expected ${VIEWPORT.width}x${VIEWPORT.height}`);

    // 1. Real DOM scout selection, armed MOVE, and a real canvas touch tap.
    const scoutButton = page.locator('#scout-focus');
    assert(await scoutButton.isVisible(), 'scout focus control is not visible');
    await scoutButton.click();
    await settleFrames(page);
    const scoutSelection = await readSelection(page);
    assert(scoutSelection.ids.length === 1, `expected one selected scout, got ${JSON.stringify(scoutSelection)}`);
    const scout = scoutSelection.entities[0];
    assert(scout?.kind === KIND.Scout && scout.team === 0 && scout.alive && scout.vis, `selected entity is not a visible player scout: ${JSON.stringify(scout)}`);
    const scoutId = scout.id;
    const moveTarget = await locateGround(page, scoutId);
    assert(moveTarget, 'no visible empty ground target found for MOVE touch');
    const moveBefore = await readEntity(page, scoutId);
    const moveArm = await clickCommand(page, 'move');
    manifest.checks.moveArm = moveArm;
    assert(moveArm.mode === 'move', `MOVE did not arm commandMode=move: ${JSON.stringify(moveArm)}`);
    assert(moveArm.className.split(/\s+/).includes('on'), `MOVE tile is not visibly armed: ${JSON.stringify(moveArm)}`);
    assert(moveArm.hint === 'MOVE ARMED · Tap ground', `MOVE hint is ${JSON.stringify(moveArm.hint)}`);
    await dispatchPointer(page, moveTarget, { pointerType: 'touch', pointerId: 61 });
    const moveAfter = await readEntity(page, scoutId);
    const moveSelectionAfter = await readSelection(page);
    manifest.checks.moveTap = { before: moveBefore, after: moveAfter, target: moveTarget, selection: moveSelectionAfter };
    assert(moveSelectionAfter.ids.length === 1 && moveSelectionAfter.ids[0] === scoutId, `MOVE tap changed scout selection: ${JSON.stringify(moveSelectionAfter)}`);
    assert(moveAfter.order === ORD.Move, `scout order ${moveAfter.order} != Ord.Move (${ORD.Move})`);
    assert(moveBefore.tx !== moveAfter.tx || moveBefore.tz !== moveAfter.tz, 'MOVE tap did not change the scout target');
    assert(moveSelectionAfter.mode === null, `MOVE mode did not clear after issuance: ${moveSelectionAfter.mode}`);
    await settleFrames(page);
    const moveHintAfter = (await page.locator('#hint').textContent())?.trim() ?? '';
    manifest.checks.moveHintAfter = moveHintAfter;
    assert(!moveHintAfter.includes('ARMED'), `MOVE hint stayed armed after issuance: ${JSON.stringify(moveHintAfter)}`);
    await capture(page, out, manifest, 'move', 'touch-move-armed.png');

    // 2. Worker deck, 44px resource touch target, Gather order, and income.
    const staged = await page.evaluate(() => {
      const world = globalThis.__STARHOLD_WORLD__;
      const worker = world.ents.find((e) => e.alive && e.team === 0 && e.kind === 0 && e.vis);
      const scout = world.ents.find((e) => e.alive && e.team === 0 && e.kind === 1 && e.vis);
      if (!worker || !scout) return null;
      const resources = world.ents
        .filter((e) => e.alive && e.vis && e.kind === 20 && [3, 4, 5].includes(e.cargoType))
        .map((e) => ({ id: e.id, cargoType: e.cargoType, d: Math.hypot(e.x - worker.x, e.z - worker.z) }))
        .sort((a, b) => (a.cargoType === 3 ? -1 : a.cargoType === 4 ? 0 : 1) - (b.cargoType === 3 ? -1 : b.cargoType === 4 ? 0 : 1) || a.d - b.d);
      return { workerId: worker.id, scoutId: scout.id, resources };
    });
    assert(staged, 'visible player worker/scout staging entities are missing');
    const workerId = staged.workerId;
    assert(staged.scoutId === scoutId, `scout focus id changed unexpectedly: ${staged.scoutId} != ${scoutId}`);
    await stageSelection(page, [workerId]);
    await settleFrames(page);
    const workerSelection = await readSelection(page);
    assert(workerSelection.ids.length === 1 && workerSelection.entities[0]?.kind === KIND.Worker, `worker staging failed: ${JSON.stringify(workerSelection)}`);
    const workerResource = await locateResource(page, staged.resources[0]?.id ?? null);
    assert(workerResource, 'no visible projected Resource node found within the touch scene');
    assert(workerResource.tapDistance <= RESOURCE_PICK_PX, `resource touch point is ${workerResource.tapDistance}px from projection, over ${RESOURCE_PICK_PX}px`);
    manifest.checks.resourceProjection = workerResource;
    const workerDeck = await page.evaluate(() => [...document.querySelectorAll('#cmds button')].map((button) => ({ cmd: button.dataset.cmd ?? '', label: button.querySelector('strong')?.textContent ?? '', sub: button.querySelector('small')?.textContent ?? '', className: button.className })));
    manifest.checks.workerDeck = workerDeck;
    const gatherButton = workerDeck.find((button) => button.cmd === 'gather');
    assert(gatherButton?.label === 'GATHER' && gatherButton.sub === 'Tap a resource node', `worker GATHER tile missing or wrong: ${JSON.stringify(workerDeck)}`);

    const gatherArm = await clickCommand(page, 'gather');
    manifest.checks.gatherArm = gatherArm;
    assert(gatherArm.mode === 'gather', `GATHER did not arm commandMode=gather: ${JSON.stringify(gatherArm)}`);
    assert(gatherArm.className.split(/\s+/).includes('on'), `GATHER tile is not visibly armed: ${JSON.stringify(gatherArm)}`);
    assert(gatherArm.hint === 'GATHER ARMED · Tap a resource node', `GATHER hint is ${JSON.stringify(gatherArm.hint)}`);
    await dispatchPointer(page, { x: workerResource.tapX, y: workerResource.tapY }, { pointerType: 'touch', pointerId: 62 });
    const gatherOrder = await readEntity(page, workerId);
    const gatherSelection = await readSelection(page);
    manifest.checks.gatherTap = { order: gatherOrder, selection: gatherSelection, resource: workerResource };
    assert(gatherOrder.order === ORD.Gather, `worker order ${gatherOrder.order} != Ord.Gather (${ORD.Gather})`);
    assert(gatherOrder.tid === workerResource.id, `worker gather tid ${gatherOrder.tid} != Resource ${workerResource.id}`);
    assert(gatherSelection.ids.length === 1 && gatherSelection.ids[0] === workerId, `GATHER tap changed worker selection: ${JSON.stringify(gatherSelection)}`);
    assert(gatherSelection.mode === null, `GATHER mode did not clear after issuance: ${gatherSelection.mode}`);
    await capture(page, out, manifest, 'gather', 'touch-gather-order.png');

    // 3. Mixed selection: Gather filters to Workers and leaves the Scout order alone.
    await stageSelection(page, [workerId, scoutId]);
    await settleFrames(page);
    const scoutBeforeMixed = await readEntity(page, scoutId);
    const mixedArm = await clickCommand(page, 'gather');
    assert(mixedArm.mode === 'gather', `mixed Worker/Scout selection could not arm GATHER: ${JSON.stringify(mixedArm)}`);
    const mixedResource = await locateResource(page, workerResource.id);
    assert(mixedResource, 'Resource projection disappeared before mixed-selection test');
    await dispatchPointer(page, { x: mixedResource.tapX, y: mixedResource.tapY }, { pointerType: 'touch', pointerId: 63 });
    const mixedWorker = await readEntity(page, workerId);
    const scoutAfterMixed = await readEntity(page, scoutId);
    const mixedSelection = await readSelection(page);
    manifest.checks.mixedGather = { worker: mixedWorker, scoutBefore: scoutBeforeMixed, scoutAfter: scoutAfterMixed, selection: mixedSelection };
    assert(mixedWorker.order === ORD.Gather && mixedWorker.tid === workerResource.id, `mixed Worker did not receive Gather: ${JSON.stringify(mixedWorker)}`);
    assert(scoutAfterMixed.order !== ORD.Gather, `mixed Scout entered Gather: ${JSON.stringify({ before: scoutBeforeMixed, after: scoutAfterMixed })}`);
    assert(scoutAfterMixed.order === scoutBeforeMixed.order && scoutAfterMixed.tid === scoutBeforeMixed.tid, `mixed Gather changed Scout order/target: ${JSON.stringify({ before: scoutBeforeMixed, after: scoutAfterMixed })}`);
    assert(mixedSelection.ids.length === 2 && mixedSelection.mode === null, `mixed Gather changed selection or left mode armed: ${JSON.stringify(mixedSelection)}`);

    // 4. The shared long-press/right-click resolver must classify Resource as Gather.
    await stageSelection(page, [workerId]);
    await settleFrames(page);
    const contextResource = await locateResource(page, workerResource.id);
    assert(contextResource, 'Resource projection disappeared before context resolver tests');
    await dispatchLongPress(page, { x: contextResource.tapX, y: contextResource.tapY }, 64);
    const longPressWorker = await readEntity(page, workerId);
    manifest.checks.longPressResource = longPressWorker;
    assert(longPressWorker.order === ORD.Gather, `resource long-press resolved order ${longPressWorker.order}, expected Gather (${ORD.Gather})`);
    assert(longPressWorker.tid === workerResource.id, `resource long-press tid ${longPressWorker.tid} != Resource ${workerResource.id}`);
    assert(longPressWorker.order !== ORD.Attack, 'resource long-press incorrectly resolved Attack');

    const rightClickResource = await locateResource(page, workerResource.id);
    assert(rightClickResource, 'Resource projection disappeared before right-click test');
    await dispatchPointer(page, { x: rightClickResource.tapX, y: rightClickResource.tapY }, { pointerType: 'mouse', button: 2, buttons: 2, pointerId: 65 });
    const rightClickWorker = await readEntity(page, workerId);
    manifest.checks.rightClickResource = rightClickWorker;
    assert(rightClickWorker.order === ORD.Gather, `resource right-click resolved order ${rightClickWorker.order}, expected Gather (${ORD.Gather})`);
    assert(rightClickWorker.tid === workerResource.id, `resource right-click tid ${rightClickWorker.tid} != Resource ${workerResource.id}`);
    assert(rightClickWorker.order !== ORD.Attack, 'resource right-click incorrectly resolved Attack');

    // Explicit ATTACK also proves a Resource is not an enemy pick: it falls through to ground.
    await stageSelection(page, [scoutId]);
    await settleFrames(page);
    const attackResource = await locateResource(page, workerResource.id);
    assert(attackResource, 'Resource projection disappeared before ATTACK resource exclusion test');
    const attackArm = await clickCommand(page, 'attack');
    assert(attackArm.mode === 'attack', `ATTACK did not arm commandMode=attack: ${JSON.stringify(attackArm)}`);
    await dispatchPointer(page, { x: attackResource.tapX, y: attackResource.tapY }, { pointerType: 'touch', pointerId: 66 });
    const attackResourceResult = await readEntity(page, scoutId);
    manifest.checks.attackResourceExclusion = attackResourceResult;
    assert(attackResourceResult.order === ORD.AttackMove, `ATTACK on Resource resolved ${attackResourceResult.order}, expected ground AttackMove (${ORD.AttackMove})`);
    assert(attackResourceResult.order !== ORD.Attack, 'Resource was incorrectly accepted by enemy attack pick');
    await capture(page, out, manifest, 'context', 'touch-context-gather.png');

    // 5. Deterministic simulation steps must produce the corresponding income total.
    await stageSelection(page, [workerId]);
    const incomeField = workerResource.cargoType === TILE.Ore ? 'ore' : workerResource.cargoType === TILE.Gas ? 'gas' : 'energy';
    const incomeLabel = incomeField === 'ore' ? 'Ore' : incomeField === 'gas' ? 'Gas' : 'Charge';
    const deposit = await page.evaluate(({ worker, resource, field, limit }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      const before = world.teams[0][field];
      let steps = 0;
      while (steps < limit && world.teams[0][field] <= before) {
        world.step();
        steps++;
      }
      const workerEntity = world.ents[worker];
      const resourceEntity = world.ents[resource];
      return {
        field,
        before,
        after: world.teams[0][field],
        steps,
        tick: world.tick,
        worker: workerEntity ? { order: workerEntity.order, tid: workerEntity.tid, cargo: workerEntity.cargo } : null,
        resourceAlive: Boolean(resourceEntity?.alive),
      };
    }, { worker: workerId, resource: workerResource.id, field: incomeField, limit: MAX_DEPOSIT_STEPS });
    manifest.checks.deposit = { label: incomeLabel, ...deposit };
    assert(deposit.after > deposit.before, `${incomeLabel} total did not rise after ${deposit.steps} deterministic steps: ${JSON.stringify(deposit)}`);
    await capture(page, out, manifest, 'deposit', 'touch-deposit.png');

    assert(manifest.consoleErrors.length === 0, `console errors/page errors: ${manifest.consoleErrors.join('; ')}`);
    manifest.ok = true;
    console.log('PASS qa-touch-contract: MOVE, GATHER, income, context picks, and mixed-selection filtering');
  } catch (error) {
    manifest.errors.push(error?.stack ?? String(error));
    manifest.ok = false;
    if (page && !manifest.captures.failure) {
      try {
        const file = path.join(out, 'touch-contract-failure.png');
        await page.screenshot({ path: file, type: 'png' });
        manifest.captures.failure = { file: path.basename(file), image: analyzePng(file) };
      } catch (captureError) {
        manifest.errors.push(`failure screenshot: ${captureError?.stack ?? String(captureError)}`);
      }
    }
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
    console.log('--- qa-touch-contract summary ---');
    console.log(`ok=${manifest.ok}`);
    console.log(`manifest=${manifestPath}`);
    if (manifest.consoleErrors.length) {
      console.log('console errors:');
      for (const error of manifest.consoleErrors) console.log(`  - ${error}`);
    }
    if (manifest.errors.length) {
      console.log('errors:');
      for (const error of manifest.errors) console.log(`  - ${error}`);
    }
    if (!manifest.ok) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
