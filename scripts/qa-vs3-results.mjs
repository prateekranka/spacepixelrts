#!/usr/bin/env node
/** VS-3 browser RED/GREEN tracer: real terminal and Results surface. */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = path.resolve(REPO_ROOT, '..', 'evidence', 'starhaven-pixel-ui-shell', 'final', 'vs3-results');
const VIEWPORT = { width: 1366, height: 1024 };
const DT = 1 / 20;
const MIN_RESULT_TICKS = Math.ceil(60 / DT);
const KIND = { Worker: 0, Ravager: 4, Hall: 10, Resource: 20 };
const TILE = { Ore: 3 };
const ORD = { Gather: 3, Return: 4, Attack: 2 };

function assertThat(condition, message) {
  if (!condition) throw new Error(message);
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

function formatDuration(tick) {
  const whole = Math.max(0, Math.floor(tick * DT + 1e-9));
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('no private QA port'));
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
  child.stderr.on('data', (chunk) => process.stdout.write(`[dev:err] ${chunk}`));
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline && !state.exited) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return state;
    } catch {}
    await delay(250);
  }
  await stopServer(state);
  throw new Error('Vite did not become ready');
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

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = resolveOut(args.out);
  fs.mkdirSync(out, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  }).catch(() => chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] }));
  const page = await browser.newPage({ viewport: VIEWPORT });
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  try {
    await page.goto(`${server.url}/?qa=opening&qa-run=1`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Playing');

    const fixture = await page.evaluate(({ kinds, tile, ord, minimumTicks }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      if (!world) throw new Error('__STARHOLD_WORLD__ missing');
      const playerHall = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === kinds.Hall);
      const rivalHall = world.ents.find((entity) => entity.alive && entity.team === 1 && entity.kind === kinds.Hall);
      const node = world.ents.find((entity) => entity.alive && entity.kind === kinds.Resource && entity.cargoType === tile.Ore);
      const worker = world.spawn(kinds.Worker, world.civ[0], 0, node.x, node.z);
      if (!playerHall || !rivalHall || !node || !worker) throw new Error('terminal fixtures missing');
      worker.order = ord.Gather;
      worker.tid = node.id;
      worker.tx = node.x;
      worker.tz = node.z;
      world.step();
      worker.x = worker.px = playerHall.x;
      worker.z = worker.pz = playerHall.z;
      worker.order = ord.Return;
      world.step();
      while (world.tick < minimumTicks) {
        if (world.winner !== -1) throw new Error(`first match ended before fast-step (${world.winner})`);
        world.step();
      }
      rivalHall.hp = 2;
      const attacker = world.spawn(kinds.Ravager, world.civ[0], 0, rivalHall.x + 0.5, rivalHall.z);
      if (!attacker) throw new Error('combat fixture missing');
      world.issue([attacker.id], ord.Attack, rivalHall.x, rivalHall.z, rivalHall.id);
      for (let step = 0; step < 4 && world.winner === -1; step++) world.step();
      return { tick: world.tick, stats: world.matchStats(), winner: world.winner };
    }, { kinds: KIND, tile: TILE, ord: ORD, minimumTicks: MIN_RESULT_TICKS });
    assertThat(fixture.winner === 0, `ordinary attack did not win (${fixture.winner})`);
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Victory');
    const terminal = await page.evaluate(() => {
      const world = globalThis.__STARHOLD_WORLD__;
      const button = document.querySelector('#match-continue');
      const rect = button?.getBoundingClientRect();
      return {
        tick: world?.tick ?? -1,
        stats: world?.matchStats?.() ?? null,
        title: document.querySelector('#match-title')?.textContent?.trim() ?? '',
        sub: document.querySelector('#match-sub')?.textContent?.trim() ?? '',
        hidden: document.querySelector('#match-end')?.hasAttribute('hidden') ?? true,
        buttonHeight: rect?.height ?? 0,
        focusable: button instanceof HTMLElement && !button.hasAttribute('disabled'),
      };
    });
    assertThat(terminal.title === 'VICTORY', `terminal title ${terminal.title}`);
    assertThat(terminal.sub === 'Enemy Nexus shattered', `terminal subline ${terminal.sub}`);
    assertThat(!terminal.hidden, 'Victory surface is hidden');
    assertThat(terminal.buttonHeight >= 44 && terminal.focusable, 'CONTINUE is not a 44px focusable button');
    await page.mouse.click(80, 500);
    await settle(page);
    const stableTerminal = await page.evaluate(() => {
      const qa = globalThis.__STARHAVEN_QA__;
      const world = globalThis.__STARHOLD_WORLD__;
      return { tick: qa?.tick ?? -1, stats: world?.matchStats?.() ?? null, state: qa?.state ?? '' };
    });
    assertThat(stableTerminal.state === 'Victory', 'terminal state changed after a touch');
    assertThat(stableTerminal.tick === terminal.tick, `terminal tick changed ${terminal.tick} -> ${stableTerminal.tick}`);
    assertThat(JSON.stringify(stableTerminal.stats) === JSON.stringify(terminal.stats), 'terminal stats changed after stop');
    await page.screenshot({ path: path.join(out, 'victory-terminal.png'), fullPage: true });
    await page.click('#match-continue');
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Results');
    const results = await page.evaluate(() => {
      const root = document.querySelector('#results');
      const panel = document.querySelector('#results-panel');
      const outcome = document.querySelector('#results-outcome');
      const outcomeStyle = outcome ? getComputedStyle(outcome) : null;
      const panelStyle = panel ? getComputedStyle(panel) : null;
      const normal = ['#topbar', '#bottom', '#civpick', '#hint', '#guidance'].every((selector) => {
        const element = document.querySelector(selector);
        return element && getComputedStyle(element).display === 'none';
      });
      const buttons = [...document.querySelectorAll('#results button')].map((button) => ({
        text: button.textContent?.trim() ?? '',
        height: button.getBoundingClientRect().height,
      }));
      return {
        visible: !!root && !root.hasAttribute('hidden'),
        text: root?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        duration: document.querySelector('#results-duration')?.textContent?.trim() ?? '',
        panelClasses: panel ? [...panel.classList] : [],
        outcomeColor: outcomeStyle?.color ?? '',
        outcomeTextShadow: outcomeStyle?.textShadow ?? '',
        panelBorderColor: panelStyle?.borderTopColor ?? '',
        panelBoxShadow: panelStyle?.boxShadow ?? '',
        normalHidden: normal,
        buttons,
      };
    });
    assertThat(results.visible, 'Results surface is hidden');
    for (const copy of ['MATCH COMPLETE // HELIOS RIFT', 'VICTORY', 'RESOURCES GATHERED', 'UNITS TRAINED', 'UNITS LOST', 'CORE DAMAGE', 'TECHNOLOGY PATH', 'PLAY AGAIN', 'MAIN MENU']) {
      assertThat(results.text.includes(copy), `Results missing ${copy}`);
    }
    assertThat(results.normalHidden, 'normal game HUD remains visible in Results');
    assertThat(results.buttons.length === 2 && results.buttons.every((button) => button.height >= 44), 'Results action targets are too small');
    assertThat(results.duration === formatDuration(terminal.tick) && results.duration !== '00:00', `Victory duration is not exact/nonzero (${results.duration}, tick ${terminal.tick})`);
    assertThat(results.panelClasses.includes('win'), `Victory Results panel classes ${results.panelClasses.join(' ')}`);
    assertThat(results.outcomeColor === 'rgb(156, 203, 110)', `Victory outcome color ${results.outcomeColor}`);
    assertThat(results.outcomeTextShadow.includes('78, 138, 90'), `Victory outcome shadow ${results.outcomeTextShadow}`);
    assertThat(results.panelBorderColor === 'rgb(78, 138, 90)', `Victory panel border ${results.panelBorderColor}`);
    assertThat(results.panelBoxShadow.includes('78, 138, 90'), `Victory panel glow ${results.panelBoxShadow}`);
    await page.screenshot({ path: path.join(out, 'victory-results.png'), fullPage: true });

    await page.evaluate(() => {
      const world = globalThis.__STARHOLD_WORLD__;
      const input = globalThis.__STARHOLD_INPUT__;
      const view = globalThis.__STARHOLD_VIEW__;
      const hud = document.querySelector('#hud');
      if (!world || !input || !view || !hud) throw new Error('first match handles missing');
      const worker = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === 0);
      if (!worker) throw new Error('first match worker missing');
      input.selected = new Set([worker.id]);
      input.groups[0] = [worker.id];
      input.commandMode = 'move';
      input.place = 11;
      let hash = 2166136261;
      for (const value of world.height) hash = Math.imul(hash ^ value, 16777619) >>> 0;
      globalThis.__VS3_FIRST_REFS__ = { world, input, view, hud, heightHash: hash >>> 0 };
    });
    await page.click('#results button[data-results-action="REMATCH"]');
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'MatchSetup');
    assertThat(await page.locator('#start-screen').count() === 1, 'second-match setup is missing');
    await page.screenshot({ path: path.join(out, 'second-setup.png'), fullPage: true });
    await page.click('[data-config-field="playerFaction"][data-config-value="gravemark"]');
    await page.locator('[data-seed-input]').fill('48879');
    await page.click('[data-start-action="start-match"]');
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Playing');
    await settle(page);
    const replay = await page.evaluate(() => {
      const qa = globalThis.__STARHAVEN_QA__;
      const world = globalThis.__STARHOLD_WORLD__;
      const input = globalThis.__STARHOLD_INPUT__;
      const refs = globalThis.__VS3_FIRST_REFS__;
      let hash = 2166136261;
      for (const value of world.height) hash = Math.imul(hash ^ value, 16777619) >>> 0;
      const stats = world.matchStats();
      return {
        resetCount: qa?.resetCount ?? -1,
        tick: world.tick,
        winner: world.winner,
        stats,
        config: qa?.config ?? null,
        civ: world.civ.slice(0, 2),
        selected: [...input.selected],
        groups: input.groups.map((group) => [...group]),
        mode: input.commandMode,
        place: input.place,
        box: input.box,
        handles: {
          world: refs?.world === world,
          input: refs?.input === input,
          view: refs?.view === globalThis.__STARHOLD_VIEW__,
          hud: refs?.hud === document.querySelector('#hud'),
        },
        canvases: {
          game: document.querySelectorAll('#game').length,
          overlay: document.querySelectorAll('#overlay').length,
          hud: document.querySelectorAll('#hud').length,
        },
        heightChanged: refs?.heightHash !== (hash >>> 0),
      };
    });
    assertThat(replay.resetCount === 2, `resetCount ${replay.resetCount}`);
    assertThat(replay.tick < 10 && replay.winner === -1, `second match did not reset (${replay.tick}, ${replay.winner})`);
    assertThat(replay.stats.teams.every((team) => team.unitsTrained === 0 && team.unitsLost === 0 && team.coreDamage === 0 && Object.values(team.resources).every((value) => value === 0)), 'second-match stats are not zero');
    assertThat(replay.config.playerFaction === 'gravemark' && replay.config.aiFaction === 'sunweaver' && replay.config.seed === 48879, 'second match config did not change');
    assertThat(replay.civ[0] === 'aurion' && replay.civ[1] === 'vespari', 'second match factions did not change');
    assertThat(replay.selected.length === 0 && replay.groups.every((group) => group.length === 0) && replay.mode === null && replay.place === null && replay.box === null, 'Input reset leaked transient state');
    assertThat(Object.values(replay.handles).every(Boolean), 'same-page match objects were recreated');
    assertThat(replay.canvases.game === 1 && replay.canvases.overlay === 1 && replay.canvases.hud === 1, 'duplicate game objects/listeners surfaced');
    assertThat(replay.heightChanged, 'second seed did not change terrain height signature');
    await page.screenshot({ path: path.join(out, 'second-playing.png'), fullPage: true });

    const defeatFixture = await page.evaluate(({ kinds, ord, minimumTicks }) => {
      const world = globalThis.__STARHOLD_WORLD__;
      while (world.tick < minimumTicks) {
        if (world.winner !== -1) throw new Error(`second match ended before fast-step (${world.winner})`);
        world.step();
      }
      const playerHall = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === kinds.Hall);
      if (!playerHall) throw new Error('second player Core missing');
      playerHall.hp = 2;
      const attacker = world.spawn(kinds.Ravager, world.civ[1], 1, playerHall.x + 0.5, playerHall.z);
      if (!attacker) throw new Error('defeat attacker missing');
      attacker.order = ord.Attack;
      attacker.tid = playerHall.id;
      attacker.tx = playerHall.x;
      attacker.tz = playerHall.z;
      for (let step = 0; step < 6 && world.winner === -1; step++) world.step();
      return { winner: world.winner, stats: world.matchStats() };
    }, { kinds: { Hall: KIND.Hall, Ravager: KIND.Ravager }, ord: ORD, minimumTicks: MIN_RESULT_TICKS });
    assertThat(defeatFixture.winner === 1, `ordinary rival attack did not defeat (${defeatFixture.winner})`);
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Defeat');
    const defeatTerminal = await page.evaluate(() => ({
      title: document.querySelector('#match-title')?.textContent?.trim() ?? '',
      sub: document.querySelector('#match-sub')?.textContent?.trim() ?? '',
      hidden: document.querySelector('#match-end')?.hasAttribute('hidden') ?? true,
      tick: globalThis.__STARHOLD_WORLD__?.tick ?? -1,
    }));
    await page.screenshot({ path: path.join(out, 'defeat-terminal.png'), fullPage: true });
    assertThat(
      defeatTerminal.title === 'DEFEAT' && defeatTerminal.sub === 'Your Nexus is ash' && !defeatTerminal.hidden,
      `Defeat terminal copy/surface is wrong (${JSON.stringify(defeatTerminal)})`,
    );
    await page.click('#match-continue');
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Results');
    const defeatResults = await page.evaluate(() => {
      const panel = document.querySelector('#results-panel');
      const outcome = document.querySelector('#results-outcome');
      const outcomeStyle = outcome ? getComputedStyle(outcome) : null;
      const panelStyle = panel ? getComputedStyle(panel) : null;
      return {
        text: document.querySelector('#results')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        visible: !(document.querySelector('#results')?.hasAttribute('hidden') ?? true),
        duration: document.querySelector('#results-duration')?.textContent?.trim() ?? '',
        panelClasses: panel ? [...panel.classList] : [],
        outcomeColor: outcomeStyle?.color ?? '',
        outcomeTextShadow: outcomeStyle?.textShadow ?? '',
        panelBorderColor: panelStyle?.borderTopColor ?? '',
        panelBoxShadow: panelStyle?.boxShadow ?? '',
      };
    });
    assertThat(defeatResults.visible && defeatResults.text.includes('DEFEAT'), 'Defeat Results missing outcome');
    assertThat(defeatResults.duration === formatDuration(defeatTerminal.tick) && defeatResults.duration !== '00:00', `Defeat duration is not exact/nonzero (${defeatResults.duration}, tick ${defeatTerminal.tick})`);
    assertThat(defeatResults.panelClasses.includes('lose'), `Defeat Results panel classes ${defeatResults.panelClasses.join(' ')}`);
    assertThat(defeatResults.outcomeColor === 'rgb(215, 138, 154)', `Defeat outcome color ${defeatResults.outcomeColor}`);
    assertThat(defeatResults.outcomeTextShadow.includes('184, 75, 69'), `Defeat outcome shadow ${defeatResults.outcomeTextShadow}`);
    assertThat(defeatResults.panelBorderColor === 'rgb(184, 75, 69)', `Defeat panel border ${defeatResults.panelBorderColor}`);
    assertThat(defeatResults.panelBoxShadow.includes('184, 75, 69'), `Defeat panel glow ${defeatResults.panelBoxShadow}`);
    assertThat(defeatResults.outcomeColor !== results.outcomeColor, `Victory and Defeat outcome colors match (${results.outcomeColor})`);
    await page.screenshot({ path: path.join(out, 'defeat-results.png'), fullPage: true });
    await page.click('#results button[data-results-action="MAIN_MENU"]');
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'MainMenu');
    const menu = await page.evaluate(() => {
      const qa = globalThis.__STARHAVEN_QA__;
      const scaffolds = Object.fromEntries((qa?.scenarioScaffolds ?? []).map((entry) => [entry.id, entry.scaffold]));
      return {
        starts: document.querySelectorAll('#start-screen').length,
        hudHidden: document.querySelector('#hud')?.hasAttribute('hidden') ?? false,
        terminalHidden: document.querySelector('#match-end')?.hasAttribute('hidden') ?? false,
        resultsHidden: document.querySelector('#results')?.hasAttribute('hidden') ?? false,
        routeCount: new Set(qa?.scenarios ?? []).size,
        scenarioCount: qa?.scenarios?.length ?? 0,
        scaffolds,
        p99FrameMs: qa?.p99FrameMs ?? Infinity,
      };
    });
    const renderer = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return 'none';
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'masked';
    });
    const simStepMs = await page.evaluate(() => {
      const CurrentWorld = globalThis.__STARHOLD_WORLD__?.constructor;
      if (!CurrentWorld) throw new Error('World constructor missing for perf fixture');
      const sample = new CurrentWorld();
      sample.reset(0x5eed);
      const started = performance.now();
      for (let step = 0; step < 600; step++) sample.step();
      return (performance.now() - started) / 600;
    });
    const softwareGl = renderer === 'none' || renderer === 'masked' || /swiftshader|llvmpipe|software|mesa/i.test(renderer);
    assertThat(menu.starts === 1 && menu.hudHidden && menu.terminalHidden && menu.resultsHidden, 'Main Menu leaked match HUD');
    assertThat(menu.scenarioCount === 13 && menu.routeCount === 13, 'primary/supplemental QA routes are not unique');
    assertThat(menu.scaffolds.victory === false && menu.scaffolds.defeat === false && menu.scaffolds.results === false, 'terminal/results route is still scaffolded');
    await page.screenshot({ path: path.join(out, 'main-menu.png'), fullPage: true });
    if (softwareGl) assertThat(simStepMs * 5 < 8, `software-GL sim share ${(simStepMs * 5).toFixed(3)}ms exceeds 8ms`);
    else assertThat(menu.p99FrameMs > 0 && menu.p99FrameMs < 8, `hardware render p99 ${menu.p99FrameMs}ms exceeds 8ms (${renderer})`);
    assertThat(consoleErrors.length === 0, `console errors: ${consoleErrors.join(' | ')}`);
    console.log(JSON.stringify({ pass: true, fixture, terminal, results, replay, defeatFixture, defeatTerminal, defeatResults, menu: { ...menu, renderer, softwareGl, simStepMs, simShareMs: simStepMs * 5 } }, null, 2));
  } finally {
    await browser.close();
    await stopServer(server);
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
