#!/usr/bin/env node
/** M6-B bounded browser proof: reachable Nexus research and complete resource costs. */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = '/tmp/starhaven-m6b-progression-handoff';
const VIEWPORT = { width: 1024, height: 768 };
const EXPECTED_SEED = 0x5eed;
const PROBE_TIMEOUT_MS = 30000;
const NAV_TIMEOUT_MS = 30000;
const SERVER_BOOT_TIMEOUT_MS = 120000;
const CHANNEL_STEP_LIMIT = 1100;

// Keep the QA-side staging numeric and content-free: these are the stable engine enum values.
const KIND = {
  Worker: 0,
  Fighter: 2,
  Ravager: 4,
  Hall: 10,
  Barracks: 12,
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

async function readDeck(page) {
  return page.evaluate(() => {
    const world = globalThis.__STARHOLD_WORLD__;
    const input = globalThis.__STARHOLD_INPUT__;
    if (!world || !input) throw new Error('__STARHOLD_WORLD__/__STARHOLD_INPUT__ missing');
    return {
      deck: [...document.querySelectorAll('#cmds button')].map((button) => ({
        cmd: button.dataset.cmd ?? '',
        label: button.querySelector('strong')?.textContent?.trim() ?? '',
        small: [...button.querySelectorAll('small')].map((line) => line.textContent?.trim() ?? ''),
        text: button.textContent?.trim() ?? '',
        className: button.className,
        disabled: button.hasAttribute('disabled'),
      })),
      selection: [...input.selected].map((id) => {
        const entity = world.ents[id];
        return entity
          ? { id, kind: entity.kind, team: entity.team, alive: entity.alive, hp: entity.hp, progress: entity.progress, x: entity.x, z: entity.z }
          : null;
      }),
      mode: input.commandMode,
      place: input.place,
      pan: { x: input.pan.x, z: input.pan.z },
      hint: document.querySelector('#hint')?.textContent?.trim() ?? '',
      ore: world.teams[0].ore,
      gas: world.teams[0].gas,
      charge: world.teams[0].energy,
      techPath: world.techPathOf(0),
      pendingPath: world.pendingPathOf(0),
      channelT: world.pathChannelT(0),
      tick: world.tick,
    };
  });
}

async function stageOpening(page, selection) {
  return page.evaluate(({ selected, kind }) => {
    const world = globalThis.__STARHOLD_WORLD__;
    const input = globalThis.__STARHOLD_INPUT__;
    if (!world || !input) throw new Error('QA world/input handles missing');
    const hall = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === 10);
    const worker = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === 0);
    let yard = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === 12);
    if (!hall || !worker) throw new Error('opening Hall/worker missing');
    if (!yard) yard = world.spawn(12, world.civ[0], 0, 16.5, 16.5);
    if (!yard) throw new Error('could not stage a completed Yard');
    yard.progress = 1;
    yard.hp = yard.maxHp;
    yard.trainT = 0;
    world.teams[0].ore = 500;
    world.teams[0].gas = 120;
    world.teams[0].energy = 120;
    world.teams[0].epoch = 0;
    world.teams[0].ageT = 0;
    world.teams[0].techPath = null;
    input.selected = new Set(kind === 'hall' ? [hall.id] : kind === 'yard' ? [yard.id] : kind === 'worker' ? [worker.id] : []);
    input.commandMode = null;
    input.place = null;
    return { hallId: hall.id, workerId: worker.id, yardId: yard.id, selected };
  }, { selected: selection, kind: selection });
}

async function stageUncommitted(page, ids, selection) {
  return page.evaluate(({ entityIds, selected }) => {
    const world = globalThis.__STARHOLD_WORLD__;
    const input = globalThis.__STARHOLD_INPUT__;
    if (!world || !input) throw new Error('QA world/input handles missing');
    world.teams[0].ore = 500;
    world.teams[0].gas = 120;
    world.teams[0].energy = 120;
    world.teams[0].epoch = 0;
    world.teams[0].ageT = 0;
    world.teams[0].techPath = null;
    const hall = world.ents[entityIds.hallId];
    if (hall) {
      hall.alive = true;
      hall.hp = hall.maxHp;
      hall.progress = 1;
      hall.trainT = 0;
    }
    input.selected = new Set(selected === 'hall' ? [entityIds.hallId] : selected === 'yard' ? [entityIds.yardId] : selected === 'worker' ? [entityIds.workerId] : []);
    input.commandMode = null;
    input.place = null;
    return [...input.selected];
  }, { entityIds: ids, selected: selection });
}

async function stageNoHall(page, ids) {
  return page.evaluate(({ hallId }) => {
    const world = globalThis.__STARHOLD_WORLD__;
    const input = globalThis.__STARHOLD_INPUT__;
    if (!world || !input) throw new Error('QA world/input handles missing');
    const hall = world.ents[hallId];
    if (!hall) throw new Error('staged Hall missing');
    hall.hp = 0;
    hall.progress = 0;
    input.selected.clear();
    input.commandMode = null;
    input.place = null;
    return { selected: [...input.selected], mode: input.commandMode, place: input.place, pan: { ...input.pan } };
  }, { hallId: ids.hallId });
}

async function stageCommittedYard(page, ids) {
  return page.evaluate(({ yardId }) => {
    const world = globalThis.__STARHOLD_WORLD__;
    const input = globalThis.__STARHOLD_INPUT__;
    if (!world || !input) throw new Error('QA world/input handles missing');
    world.teams[0].ore = 500;
    world.teams[0].gas = 120;
    world.teams[0].energy = 120;
    const yard = world.ents[yardId];
    if (!yard?.alive) throw new Error('staged Yard was lost');
    yard.progress = 1;
    yard.hp = yard.maxHp;
    yard.trainT = 0;
    input.selected = new Set([yardId]);
    input.commandMode = null;
    input.place = null;
    return [...input.selected];
  }, { yardId: ids.yardId });
}

function pathButtons(deck) {
  return deck.deck.filter((button) => button.cmd.startsWith('path-'));
}

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

async function tapCommand(page, command) {
  const button = page.locator(`#cmds button[data-cmd="${command}"]`);
  if (!(await button.isVisible())) throw new Error(`${command} command button is not visible`);
  if (!(await button.isEnabled())) throw new Error(`${command} command button is disabled`);
  await button.tap();
  await settleFrames(page);
  return readDeck(page);
}

async function capture(page, out, manifest, key, filename) {
  await settleFrames(page);
  const file = path.join(out, filename);
  await page.screenshot({ path: file, type: 'png' });
  manifest.captures[key] = { file: path.basename(file), image: analyzePng(file) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = resolveOut(args.out);
  fs.mkdirSync(out, { recursive: true });
  const manifest = {
    tool: 'qa-progression-handoff',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: { out, route: 'opening', viewport: VIEWPORT, seed: EXPECTED_SEED, input: 'real touch taps' },
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
    console.log(`qa-progression-handoff: dev server ready at ${server.url}`);

    browser = await chromium
      .launch({
        channel: 'chrome',
        headless: true,
        args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
      })
      .catch(() => chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] }));
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, hasTouch: true });
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
    const entry = await page.evaluate(() => {
      const qa = globalThis.__STARHAVEN_QA__;
      return {
        state: qa?.state,
        scenario: qa?.scenario,
        seed: qa?.config?.seed,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      };
    });
    manifest.checks.entry = entry;
    requireThat(entry.scenario === 'opening', `scenario ${JSON.stringify(entry.scenario)} != opening`);
    requireThat(entry.seed === EXPECTED_SEED, `unexpected deterministic seed ${entry.seed}`);
    requireThat(entry.viewport.width === VIEWPORT.width && entry.viewport.height === VIEWPORT.height, `viewport is ${JSON.stringify(entry.viewport)}`);

    const ids = await stageOpening(page, 'yard');
    await settleFrames(page);

    // Strict RED probe: run before any src edit and collect all three current-tree failures.
    const redErrors = [];
    const redYard = await readDeck(page);
    const redTech = redYard.deck.find((button) => button.cmd === 'tech-focus');
    if (!redTech || redTech.disabled) {
      redErrors.push('RED current tree: completed Yard has no actionable tech-focus button');
    }
    const redLocked = redYard.deck.filter((button) => button.cmd === `train-${KIND.Fighter}` || button.cmd === `train-${KIND.Ravager}`);
    for (const button of redLocked) {
      if (button.small[0] !== 'Choose path first') {
        redErrors.push(`RED current tree: ${button.label} exposes ${JSON.stringify(button.small[0] ?? '')} instead of "Choose path first"`);
      }
    }
    await stageUncommitted(page, ids, 'worker');
    await settleFrames(page);
    const redWorker = await readDeck(page);
    const redYardBuild = redWorker.deck.find((button) => button.cmd === `build-${KIND.Barracks}`);
    if (redYardBuild?.small[0] !== '150 Ore · 20 Charge') {
      redErrors.push(`RED current tree: Yard build label hides Charge (saw ${JSON.stringify(redYardBuild?.small[0] ?? '')})`);
    }
    manifest.checks.redCurrentTree = { yard: redYard, worker: redWorker, failures: redErrors };
    if (redErrors.length) {
      for (const failure of redErrors) console.log(`[RED] ${failure}`);
      await capture(page, out, manifest, 'redCurrentTree', 'm6b-red-current-tree.png');
      throw new Error(`RED current-tree contract failures:\n${redErrors.join('\n')}`);
    }

    // 1. No selection: real touch on TECHNOLOGY PATH focuses the completed Nexus.
    await stageUncommitted(page, ids, 'none');
    await page.evaluate(() => {
      const input = globalThis.__STARHOLD_INPUT__;
      input.commandMode = 'move';
      input.place = 12;
    });
    await settleFrames(page);
    const noSelection = await readDeck(page);
    const noSelectionTech = noSelection.deck.find((button) => button.cmd === 'tech-focus');
    requireThat(noSelectionTech?.label === 'TECHNOLOGY PATH', `no-selection tech-focus label is ${JSON.stringify(noSelectionTech?.label)}`);
    requireThat(noSelectionTech?.small[0] === 'Open Nexus research', `no-selection tech-focus hint is ${JSON.stringify(noSelectionTech?.small[0])}`);
    const noSelectionFocused = await tapCommand(page, 'tech-focus');
    const focusedEntity = noSelectionFocused.selection[0];
    requireThat(focusedEntity?.kind === KIND.Hall && focusedEntity.team === 0 && focusedEntity.alive && focusedEntity.progress >= 1, `tech-focus did not select a completed player Nexus: ${JSON.stringify(noSelectionFocused.selection)}`);
    requireThat(noSelectionFocused.selection.length === 1, `tech-focus selected ${noSelectionFocused.selection.length} entities`);
    requireThat(noSelectionFocused.mode === null && noSelectionFocused.place === null, `tech-focus did not clear input modes: ${JSON.stringify({ mode: noSelectionFocused.mode, place: noSelectionFocused.place })}`);
    requireThat(noSelectionFocused.hint === 'Choose one permanent path', `successful tech-focus hint is ${JSON.stringify(noSelectionFocused.hint)}`);
    requireThat(Math.abs(noSelectionFocused.pan.x - focusedEntity.x) < 0.001 && Math.abs(noSelectionFocused.pan.z - focusedEntity.z) < 0.001, `tech-focus did not center the Nexus: ${JSON.stringify({ pan: noSelectionFocused.pan, hall: focusedEntity })}`);
    requireThat(pathButtons(noSelectionFocused).length === 2, `no-selection tech-focus exposed ${pathButtons(noSelectionFocused).length} path tiles`);
    manifest.checks.noSelectionFocus = noSelectionFocused;
    await capture(page, out, manifest, 'noSelectionFocus', 'm6b-no-selection-handoff.png');

    // 2. Yard handoff: CHOOSE PATH precedes the locked combat tiles and focuses the Nexus.
    await stageUncommitted(page, ids, 'yard');
    await settleFrames(page);
    const yardBefore = await readDeck(page);
    const yardTech = yardBefore.deck.find((button) => button.cmd === 'tech-focus');
    const firstTrainIndex = yardBefore.deck.findIndex((button) => button.cmd.startsWith('train-'));
    const yardTechIndex = yardBefore.deck.findIndex((button) => button.cmd === 'tech-focus');
    requireThat(yardTech?.label === 'CHOOSE PATH', `Yard tech-focus label is ${JSON.stringify(yardTech?.label)}`);
    requireThat(yardTech?.small[0] === 'Open Nexus research', `Yard tech-focus hint is ${JSON.stringify(yardTech?.small[0])}`);
    requireThat(yardTechIndex >= 0 && firstTrainIndex > yardTechIndex, `Yard tech-focus is not before combat tiles: ${JSON.stringify({ yardTechIndex, firstTrainIndex })}`);
    const yardFocused = await tapCommand(page, 'tech-focus');
    requireThat(yardFocused.hint === 'Choose one permanent path', `Yard tech-focus success hint is ${JSON.stringify(yardFocused.hint)}`);
    requireThat(yardFocused.selection[0]?.kind === KIND.Hall && pathButtons(yardFocused).length === 2, `Yard tech-focus did not expose both Nexus paths: ${JSON.stringify({ selection: yardFocused.selection, paths: pathButtons(yardFocused) })}`);
    manifest.checks.yardFocus = { before: yardBefore, after: yardFocused };
    await capture(page, out, manifest, 'yardFocus', 'm6b-yard-handoff.png');

    // 3–4. Complete cost strings use Ore · Volatiles · Charge in every resource-bearing line.
    await stageUncommitted(page, ids, 'worker');
    await settleFrames(page);
    const workerDeck = await readDeck(page);
    const yardBuild = workerDeck.deck.find((button) => button.cmd === `build-${KIND.Barracks}`);
    requireThat(yardBuild?.small[0] === '150 Ore · 20 Charge', `Yard cost label is ${JSON.stringify(yardBuild?.small[0])}`);
    await stageUncommitted(page, ids, 'yard');
    await settleFrames(page);
    const yardCosts = await readDeck(page);
    manifest.checks.costLabels = { yardBuild, workerDeck, yardCosts };

    // 5. Real touch on Solar Ascendancy spends exactly 400 Ore + 80 Charge and channels.
    await stageUncommitted(page, ids, 'hall');
    const pathFunds = await page.evaluate(() => {
      const world = globalThis.__STARHOLD_WORLD__;
      world.teams[0].ore = 500;
      world.teams[0].energy = 120;
      world.teams[0].gas = 120;
      return { ore: world.teams[0].ore, charge: world.teams[0].energy };
    });
    await settleFrames(page);
    const pathBefore = await readDeck(page);
    const solarPath = pathBefore.deck.find((button) => button.cmd === 'path-solar-ascendancy');
    requireThat(solarPath && !solarPath.disabled, `Solar Ascendancy is not touch-enabled: ${JSON.stringify(solarPath)}`);
    const channeling = await tapCommand(page, 'path-solar-ascendancy');
    requireThat(channeling.ore === pathFunds.ore - 400 && channeling.charge === pathFunds.charge - 80, `path deduction was ${JSON.stringify({ ore: channeling.ore, charge: channeling.charge })}, expected 400/80 from ${JSON.stringify(pathFunds)}`);
    requireThat(channeling.techPath === null && channeling.pendingPath === 'solar-ascendancy' && channeling.channelT > 0, `Solar Ascendancy did not enter its channel: ${JSON.stringify(channeling)}`);
    const channelTile = channeling.deck.find((button) => button.cmd === 'path-solar-ascendancy');
    requireThat(channelTile?.className.split(/\s+/).includes('channel') && channelTile.text.includes('Committing ·'), `channel countdown tile missing: ${JSON.stringify(channelTile)}`);
    requireThat(pathButtons(channeling).length === 1, `channel deck exposed ${pathButtons(channeling).length} path tiles`);
    manifest.checks.channel = { before: pathBefore, after: channeling };
    await capture(page, out, manifest, 'channel', 'm6b-channel-countdown.png');

    const committed = await page.evaluate((limit) => {
      const world = globalThis.__STARHOLD_WORLD__;
      let steps = 0;
      while (steps < limit && world.pathChannelT(0) > 0) {
        world.step();
        steps++;
      }
      return { steps, techPath: world.techPathOf(0), channelT: world.pathChannelT(0), ore: world.teams[0].ore, charge: world.teams[0].energy, tick: world.tick };
    }, CHANNEL_STEP_LIMIT);
    await settleFrames(page);
    const committedDeck = await readDeck(page);
    requireThat(committed.techPath === 'solar-ascendancy' && committed.channelT === 0, `Solar Ascendancy did not complete: ${JSON.stringify(committed)}`);
    const lockedPath = committedDeck.deck.find((button) => button.cmd === 'path-locked');
    requireThat(lockedPath?.label === 'Solar Ascendancy' && lockedPath.disabled, `committed path readout is wrong: ${JSON.stringify(lockedPath)}`);
    requireThat(pathButtons(committedDeck).length === 1, `committed deck has wrong path tile count: ${JSON.stringify(pathButtons(committedDeck))}`);
    manifest.checks.committed = { sim: committed, deck: committedDeck };
    await capture(page, out, manifest, 'committed', 'm6b-committed-path.png');

    // 6. A committed Yard has normal train gates and no technology handoff button.
    await stageCommittedYard(page, ids);
    await settleFrames(page);
    const committedYard = await readDeck(page);
    const lumenGuard = committedYard.deck.find((button) => button.cmd === `train-${KIND.Fighter}`);
    const committedSolar = committedYard.deck.find((button) => button.cmd === `train-${KIND.Ravager}`);
    requireThat(!committedYard.deck.some((button) => button.cmd === 'tech-focus'), `tech-focus remains after commit: ${JSON.stringify(committedYard.deck)}`);
    requireThat(lumenGuard?.label === 'Lumen Guard' && !lumenGuard.disabled, `Lumen Guard is not enabled after commit: ${JSON.stringify(lumenGuard)}`);
    requireThat(committedSolar?.label === 'Solar Strider' && !committedSolar.disabled, `Solar Strider is not enabled after commit: ${JSON.stringify(committedSolar)}`);
    requireThat(committedSolar?.small[0] === '90 Ore · 35 Volatiles · 20 Charge', `Solar Strider cost label is ${JSON.stringify(committedSolar?.small[0])}`);
    manifest.checks.committedYard = { deck: committedYard.deck, lumenGuard, solarStrider: committedSolar };
    await capture(page, out, manifest, 'committedYard', 'm6b-yard-committed.png');

    // Destructive negative case runs LAST: removing the only completed Nexus legally
    // triggers Defeat, so it must never contaminate the handoff/channel visual pack.
    await stageUncommitted(page, ids, 'none');
    await stageNoHall(page, ids);
    await settleFrames(page);
    const noHallBefore = await readDeck(page);
    requireThat(noHallBefore.deck.some((button) => button.cmd === 'tech-focus'), 'tech-focus disappeared when no completed Nexus exists');
    const noHallAfter = await tapCommand(page, 'tech-focus');
    requireThat(noHallAfter.hint === 'Build a Nexus first', `no-Hall tech-focus hint is ${JSON.stringify(noHallAfter.hint)}`);
    requireThat(noHallAfter.selection.length === 0 && noHallAfter.mode === null && noHallAfter.place === null, `failed tech-focus mutated input state: ${JSON.stringify({ selection: noHallAfter.selection, mode: noHallAfter.mode, place: noHallAfter.place })}`);
    manifest.checks.noHallFocus = noHallAfter;

    requireThat(manifest.consoleErrors.length === 0, `console errors/page errors: ${manifest.consoleErrors.join('; ')}`);
    manifest.ok = true;
    console.log('PASS qa-progression-handoff: reachable Nexus research, honest costs, channel, and committed Yard gates');
  } catch (error) {
    manifest.errors.push(error?.stack ?? String(error));
    manifest.ok = false;
    if (page && !manifest.captures.failure) {
      try {
        const file = path.join(out, 'm6b-progression-failure.png');
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
    console.log('--- qa-progression-handoff summary ---');
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
