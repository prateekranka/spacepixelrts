#!/usr/bin/env node
/** M4-B bounded browser smoke: technology-path choice UI, channel, locked readout, gates, language ban. */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = '/home/bobbyranka/workspace/evidence/starhaven-m4-tech-paths';
const VIEWPORT = { width: 1366, height: 1024 };
const NAV_TIMEOUT_MS = 30000;
const PROBE_TIMEOUT_MS = 30000;
const SERVER_BOOT_TIMEOUT_MS = 120000;
/** DT = 1/20 s; the commit channel is 40 s ≈ 800 ticks. */
const CHANNEL_STEP_LIMIT = 1100;
/** M4 decision 2 — commit cost, mirrored from the contract for assertions. */
const COMMIT_ORE = 400;
const COMMIT_CHARGE = 80;

// Decision 7 language ban — zero hits allowed across ALL rendered text.
// "Sky Dominion" is a proper noun and allowed; a bare stage-word hit fails.
const BANNED = [
  ['epoch', /\bepoch\b/i],
  ['age', /\bage\b/i],
  ['Spark', /\bspark\b/i],
  ['Orbit', /\borbit\b/i],
  ['Apex', /\bapex\b/i],
  ['Dominion (stage)', /(?<!sky )\bdominion\b/i],
];

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
  const out = path.resolve(String(raw ?? DEFAULT_OUT).trim());
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

function parseCssColor(value) {
  const match = /^rgba?\(([^)]+)\)$/.exec(value.trim());
  if (!match) return null;
  const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
  return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
}

function colorDistance(left, right) {
  return Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b);
}

async function settleFrames(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

/** Snapshot of the command deck + guidance + sim slice, gathered in ONE evaluate (no re-render races). */
async function readDeck(page) {
  return page.evaluate(() => {
    const world = globalThis.__STARHOLD_WORLD__;
    const input = globalThis.__STARHOLD_INPUT__;
    if (!world || !input) throw new Error('__STARHOLD_WORLD__/__STARHOLD_INPUT__ missing');
    const deck = [...document.querySelectorAll('#cmds button')].map((btn) => ({
      cmd: btn.dataset.cmd ?? '',
      label: btn.querySelector('strong')?.textContent ?? '',
      small: [...btn.querySelectorAll('small')].map((line) => line.textContent ?? ''),
      sub: [...btn.querySelectorAll('small')].map((line) => line.textContent ?? '').join(' · '),
      className: btn.className,
      disabled: btn.hasAttribute('disabled'),
    }));
    return {
      deck,
      guidance: document.querySelector('#guidance strong')?.textContent ?? '',
      ore: world.teams[0].ore,
      energy: world.teams[0].energy,
      techPath: world.techPathOf(0),
      channelT: world.pathChannelT(0),
      tick: world.tick,
      civ0: world.civ[0],
    };
  });
}

function pathButtons(deck) {
  return deck.deck.filter((b) => b.cmd.startsWith('path-'));
}

function scanBanned(corpus) {
  const hits = [];
  for (const [label, regex] of BANNED) {
    for (const entry of corpus) {
      const match = entry.text.match(regex);
      if (match) {
        hits.push(`${label} -> "${match[0]}" in ${entry.where}`);
      }
    }
  }
  return hits;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = resolveOut(args.out);
  fs.mkdirSync(out, { recursive: true });
  const shots = {
    choice: path.join(out, 'm4b-choice-uncommitted.png'),
    yardGated: path.join(out, 'm4b-yard-gated.png'),
    channel: path.join(out, 'm4b-channel-countdown.png'),
    committed: path.join(out, 'm4b-committed-locked.png'),
    yardOpen: path.join(out, 'm4b-yard-open.png'),
  };
  const manifest = {
    tool: 'qa-m4',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: { out, route: 'opening', viewport: VIEWPORT },
    checks: {},
    captures: {},
    bannedWordHits: [],
    errors: [],
    ok: false,
  };
  const corpus = [];
  let server = null;
  let browser = null;

  const captureText = async (page, where) => {
    corpus.push({
      where,
      text: await page.evaluate(() => {
        const parts = [document.body.innerText ?? ''];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
          parts.push(node.nodeValue ?? '');
          node = walker.nextNode();
        }
        return parts.join('\n');
      }),
    });
  };

  try {
    server = await startServer();
    console.log(`qa-m4: dev server ready at ${server.url}`);

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

    // Scripted opening fast-play: run the deterministic opening clash forward.
    const opened = await page.evaluate((steps) => {
      const world = globalThis.__STARHOLD_WORLD__;
      for (let s = 0; s < steps; s++) world.step();
      return { tick: world.tick, winner: world.winner, civ0: world.civ[0] };
    }, 260);
    manifest.checks.opening = opened;
    if (opened.civ0 !== 'vespari') throw new Error(`player civ is ${opened.civ0}, expected vespari`);
    if (opened.winner !== -1) throw new Error('opening fast-play ended the match');

    // 1. Uncommitted Nexus deck — TWO choice buttons with effect summary + cost.
    await page.evaluate(() => {
      const world = globalThis.__STARHOLD_WORLD__;
      const input = globalThis.__STARHOLD_INPUT__;
      // QA-hook resource grant (qa-m3 pattern) — enough for the 400 ore · 80 charge commit.
      world.teams[0].ore = 500;
      world.teams[0].gas = Math.max(world.teams[0].gas, 60);
      world.teams[0].energy = 120;
      const hall = world.ents.find((e) => e.alive && e.team === 0 && e.kind === 10 /* Kind.Hall */);
      if (!hall) throw new Error('player Nexus missing');
      input.selected = new Set([hall.id]);
    });
    await settleFrames(page);
    const choice = await readDeck(page);
    manifest.checks.choice = choice;
    const choiceBtns = pathButtons(choice);
    if (choice.techPath !== null) throw new Error('path committed before any click');
    if (choice.channelT !== 0) throw new Error('channel running before commit');
    if (choiceBtns.length !== 2) throw new Error(`expected 2 path buttons, got ${choiceBtns.length}: ${JSON.stringify(choiceBtns)}`);
    const solar = choiceBtns.find((b) => b.cmd === 'path-solar-ascendancy');
    const sky = choiceBtns.find((b) => b.cmd === 'path-sky-dominion');
    if (!solar || !sky) throw new Error(`vespari path buttons missing: ${JSON.stringify(choiceBtns)}`);
    if (solar.label !== 'Solar Ascendancy' || sky.label !== 'Sky Dominion') {
      throw new Error(`wrong path labels: ${solar.label} / ${sky.label}`);
    }
    for (const btn of [solar, sky]) {
      if (!btn.className.split(/\s+/).includes('choice')) throw new Error(`${btn.label} is not a choice tile`);
      if (btn.disabled) throw new Error(`${btn.label} disabled despite granted funds`);
      if (btn.small.length !== 2) throw new Error(`${btn.label} tile should have blurb and cost lines: ${JSON.stringify(btn.small)}`);
      if (btn.small[1] !== '400 ore · 80 charge') throw new Error(`${btn.label} sub lacks cost: "${btn.small[1]}"`);
      if (btn.small[0].length === 0) throw new Error(`${btn.label} sub lacks effect summary`);
    }
    const choiceMinHeight = await page.evaluate(() => {
      const tile = document.querySelector('#cmds button.choice');
      return tile instanceof HTMLElement ? getComputedStyle(tile).minHeight : null;
    });
    manifest.checks.choiceMinHeight = choiceMinHeight;
    if (choiceMinHeight !== '88px') throw new Error(`choice tile min-height is ${choiceMinHeight}, expected 88px`);
    const unaffordablePaint = await page.evaluate(() => {
      const tile = document.querySelector('#cmds button.choice');
      if (!(tile instanceof HTMLElement)) return null;
      tile.classList.add('unaffordable');
      const styled = document.querySelector('#cmds button.choice.unaffordable');
      if (!(styled instanceof HTMLElement)) return null;
      const style = getComputedStyle(styled);
      const paint = { backgroundColor: style.backgroundColor, opacity: style.opacity };
      tile.classList.remove('unaffordable');
      return paint;
    });
    manifest.checks.unaffordablePaint = unaffordablePaint;
    if (!unaffordablePaint) throw new Error('choice-unaffordable paint probe failed');
    if (choice.guidance !== 'Choose a technology path') {
      throw new Error(`guidance nudge missing, got "${choice.guidance}"`);
    }
    await settleFrames(page);
    await page.screenshot({ path: shots.choice, type: 'png' });
    manifest.captures.choice = { file: path.basename(shots.choice), image: analyzePng(shots.choice) };
    await captureText(page, 'choice-uncommitted');

    // 2. Gated Yard buttons stay disabled before commit.
    await page.evaluate(() => {
      const world = globalThis.__STARHOLD_WORLD__;
      const input = globalThis.__STARHOLD_INPUT__;
      const yard = world.spawn(12 /* Kind.Barracks */, world.civ[0], 0, 14.5, 14.5);
      if (!yard) throw new Error('yard spawn failed');
      yard.progress = 1;
      input.selected = new Set([yard.id]);
    });
    await settleFrames(page);
    const yardGated = await readDeck(page);
    manifest.checks.yardGated = yardGated.deck.filter((b) => b.cmd.startsWith('train-'));
    const gatedTrain = yardGated.deck.filter((b) => b.cmd.startsWith('train-'));
    if (gatedTrain.length < 3) throw new Error(`yard deck incomplete: ${JSON.stringify(gatedTrain)}`);
    for (const btn of gatedTrain) {
      if (!btn.disabled) throw new Error(`gated kind ${btn.cmd} enabled before commit`);
      if (btn.sub !== 'needs path') throw new Error(`gated sub unexpected: "${btn.sub}"`);
    }
    await settleFrames(page);
    await page.screenshot({ path: shots.yardGated, type: 'png' });
    manifest.captures.yardGated = { file: path.basename(shots.yardGated), image: analyzePng(shots.yardGated) };
    await captureText(page, 'yard-gated');

    // 3. Click Solar Ascendancy — funds deducted atomically, channel starts.
    await page.evaluate(() => {
      const world = globalThis.__STARHOLD_WORLD__;
      const input = globalThis.__STARHOLD_INPUT__;
      const hall = world.ents.find((e) => e.alive && e.team === 0 && e.kind === 10);
      input.selected = new Set([hall.id]);
    });
    await settleFrames(page);
    const clicked = await page.evaluate(() => {
      const world = globalThis.__STARHOLD_WORLD__;
      const btn = document.querySelector('#cmds button[data-cmd="path-solar-ascendancy"]');
      if (!btn) throw new Error('Solar Ascendancy button missing');
      if (btn.hasAttribute('disabled')) throw new Error('Solar Ascendancy button disabled');
      btn.click();
      return {
        ore: world.teams[0].ore,
        energy: world.teams[0].energy,
        channelT: world.pathChannelT(0),
        techPath: world.techPathOf(0),
      };
    });
    manifest.checks.click = clicked;
    if (clicked.ore !== 500 - COMMIT_ORE) throw new Error(`ore not deducted: ${clicked.ore}`);
    if (clicked.energy !== 120 - COMMIT_CHARGE) throw new Error(`charge not deducted: ${clicked.energy}`);
    if (!(clicked.channelT > 39 && clicked.channelT <= 40)) throw new Error(`channel not started: ${clicked.channelT}`);
    if (clicked.techPath !== null) throw new Error('path applied before channel elapsed');

    // Double-commit must be rejected with no further spend.
    const rejected = await page.evaluate(() => {
      const world = globalThis.__STARHOLD_WORLD__;
      const ore0 = world.teams[0].ore;
      const ok = world.tryCommitPath(0, 'sky-dominion');
      return { ok, ore0, ore1: world.teams[0].ore };
    });
    manifest.checks.doubleCommitRejected = rejected;
    if (rejected.ok !== false || rejected.ore1 !== rejected.ore0) throw new Error('second commit was not rejected cleanly');

    await settleFrames(page);
    const channelChoice = await page.evaluate(() => {
      const tile = document.querySelector('#cmds button.choice.channel');
      return tile ? { className: tile.className, text: tile.textContent ?? '' } : null;
    });
    manifest.checks.channelChoice = channelChoice;
    if (!channelChoice || !channelChoice.text.includes('Committing ·')) {
      throw new Error(`channel choice tile missing countdown: ${JSON.stringify(channelChoice)}`);
    }
    const channelUi = await readDeck(page);
    manifest.checks.channelUi = { deck: channelUi.deck, guidance: channelUi.guidance, channelT: channelUi.channelT };
    const channelBtns = pathButtons(channelUi);
    if (channelBtns.length !== 1) throw new Error(`channel deck should show only the pending choice, got ${channelBtns.length}`);
    const channelBtn = channelBtns[0];
    if (channelBtn.cmd !== 'path-solar-ascendancy') throw new Error(`wrong pending choice shown: ${channelBtn.cmd}`);
    if (!channelBtn.className.split(/\s+/).includes('channel')) throw new Error(`${channelBtn.label} lacks channel class`);
    if (!channelBtn.disabled) throw new Error(`${channelBtn.label} not disabled during channel`);
    if (channelBtn.small.length !== 2 || !/^Committing · \d+s$/.test(channelBtn.small[1])) {
      throw new Error(`${channelBtn.label} sub is not a committing countdown: ${JSON.stringify(channelBtn.small)}`);
    }
    if (channelUi.guidance === 'Choose a technology path') throw new Error('path nudge not suppressed during channel');

    const readChannelBar = () =>
      page.evaluate(() => {
        const bar = document.querySelector('#cmds button.choice.channel .bar');
        if (!bar) return null;
        const styleWidth = bar instanceof HTMLElement ? bar.style.width : '';
        return { styleWidth, widthPct: Number.parseFloat(styleWidth) };
      });
    const channelBarBefore = await readChannelBar();
    await page.evaluate(() => {
      const world = globalThis.__STARHOLD_WORLD__;
      for (let s = 0; s < 40; s++) world.step();
    });
    await settleFrames(page);
    const channelBarAfter = await readChannelBar();
    manifest.checks.channelBar = { before: channelBarBefore, after: channelBarAfter };
    if (!channelBarBefore || !channelBarAfter) {
      throw new Error(`channel progress bar missing: ${JSON.stringify({ before: channelBarBefore, after: channelBarAfter })}`);
    }
    if (!(channelBarAfter.widthPct > channelBarBefore.widthPct || channelBarAfter.widthPct > 0)) {
      throw new Error(`channel progress bar did not advance: ${JSON.stringify({ before: channelBarBefore, after: channelBarAfter })}`);
    }
    await settleFrames(page);
    await page.screenshot({ path: shots.channel, type: 'png' });
    manifest.captures.channel = { file: path.basename(shots.channel), image: analyzePng(shots.channel) };
    await captureText(page, 'channel-countdown');

    // 4. Fast-forward the 40 s channel; locked readout replaces the choices.
    const committed = await page.evaluate((limit) => {
      const world = globalThis.__STARHOLD_WORLD__;
      for (let s = 0; s < limit && world.pathChannelT(0) > 0; s++) world.step();
      return { techPath: world.techPathOf(0), channelT: world.pathChannelT(0), tick: world.tick };
    }, CHANNEL_STEP_LIMIT);
    manifest.checks.committed = committed;
    if (committed.techPath !== 'solar-ascendancy') throw new Error(`path not locked in: ${committed.techPath}`);
    if (committed.channelT !== 0) throw new Error(`channel did not elapse: ${committed.channelT}`);

    await settleFrames(page);
    const lockedChoice = await page.evaluate(() => {
      const tile = document.querySelector('#cmds button.choice.locked');
      return tile ? { className: tile.className, text: tile.textContent ?? '' } : null;
    });
    manifest.checks.lockedChoice = lockedChoice;
    if (
      !lockedChoice ||
      !lockedChoice.text.includes('Solar Ascendancy') ||
      !lockedChoice.text.includes('Path set') ||
      !lockedChoice.text.includes('Combat units unlocked')
    ) {
      throw new Error(`locked choice tile missing chosen path: ${JSON.stringify(lockedChoice)}`);
    }
    const lockedUi = await readDeck(page);
    manifest.checks.lockedUi = { deck: lockedUi.deck, guidance: lockedUi.guidance };
    const lockedBtns = pathButtons(lockedUi);
    if (lockedBtns.length !== 1) throw new Error(`expected single locked readout, got ${lockedBtns.length}: ${JSON.stringify(lockedBtns)}`);
    const locked = lockedBtns[0];
    if (locked.cmd !== 'path-locked') throw new Error(`locked readout cmd wrong: ${locked.cmd}`);
    if (!locked.className.split(/\s+/).includes('locked')) throw new Error('locked readout lacks locked class');
    if (!locked.disabled) throw new Error('locked readout must be disabled');
    if (locked.label !== 'Solar Ascendancy') throw new Error(`locked readout label: ${locked.label}`);
    if (lockedUi.guidance === 'Choose a technology path') throw new Error('path nudge not suppressed after commit');
    const lockedPaint = await page.evaluate(() => {
      const tile = document.querySelector('#cmds button.choice.locked');
      if (!(tile instanceof HTMLElement)) return null;
      const style = getComputedStyle(tile);
      return { backgroundColor: style.backgroundColor, opacity: style.opacity };
    });
    const lockedColor = lockedPaint ? parseCssColor(lockedPaint.backgroundColor) : null;
    const unaffordableColor = parseCssColor(unaffordablePaint.backgroundColor);
    const paintDelta = lockedColor && unaffordableColor ? colorDistance(lockedColor, unaffordableColor) : null;
    manifest.checks.lockedPaint = { ...lockedPaint, paintDelta };
    if (
      !lockedPaint ||
      !lockedColor ||
      lockedColor.a !== 1 ||
      Number(lockedPaint.opacity) !== 1 ||
      lockedColor.r !== 240 ||
      lockedColor.g !== 193 ||
      lockedColor.b !== 90
    ) {
      throw new Error(`locked choice is not opaque amber: ${JSON.stringify(manifest.checks.lockedPaint)}`);
    }
    if (!unaffordableColor || paintDelta === null || paintDelta < 100) {
      throw new Error(`locked choice does not differ strongly from unaffordable choice: ${JSON.stringify(manifest.checks.lockedPaint)}`);
    }
    await settleFrames(page);
    await page.screenshot({ path: shots.committed, type: 'png' });
    manifest.captures.committed = { file: path.basename(shots.committed), image: analyzePng(shots.committed) };
    await captureText(page, 'committed-locked');

    // 5. Gated Yard buttons enable only post-commit.
    await page.evaluate(() => {
      const world = globalThis.__STARHOLD_WORLD__;
      const input = globalThis.__STARHOLD_INPUT__;
      world.teams[0].ore = Math.max(world.teams[0].ore, 300);
      world.teams[0].gas = Math.max(world.teams[0].gas, 100);
      world.teams[0].energy = Math.max(world.teams[0].energy, 150);
      const yard = world.ents.find((e) => e.alive && e.team === 0 && e.kind === 12 && e.progress >= 1);
      if (!yard) throw new Error('finished yard missing');
      input.selected = new Set([yard.id]);
    });
    await settleFrames(page);
    const yardOpen = await readDeck(page);
    manifest.checks.yardOpen = yardOpen.deck.filter((b) => b.cmd.startsWith('train-'));
    const openTrain = yardOpen.deck.filter((b) => b.cmd.startsWith('train-'));
    if (openTrain.length < 3) throw new Error(`yard deck incomplete post-commit: ${JSON.stringify(openTrain)}`);
    for (const btn of openTrain) {
      if (btn.disabled) throw new Error(`yard kind ${btn.cmd} still disabled after commit (${btn.sub})`);
    }
    await settleFrames(page);
    await page.screenshot({ path: shots.yardOpen, type: 'png' });
    manifest.captures.yardOpen = { file: path.basename(shots.yardOpen), image: analyzePng(shots.yardOpen) };
    await captureText(page, 'yard-open');

    // 6. Language ban over EVERYTHING rendered so far — zero hits required.
    const hits = scanBanned(corpus);
    manifest.bannedWordHits = hits;
    manifest.checks.bannedWords = { scanned: corpus.map((c) => c.where), hits: hits.length };
    if (hits.length) throw new Error(`banned words in rendered text: ${hits.join('; ')}`);

    manifest.ok = manifest.errors.length === 0;
    if (manifest.ok) console.log(`PASS qa-m4: technology-path HUD proof (${corpus.length} text sweeps, 5 screenshots)`);
  } catch (error) {
    manifest.errors.push(error?.stack ?? String(error));
    manifest.ok = false;
  } finally {
    try { if (browser) await browser.close(); } catch {}
    try { await stopServer(server); } catch {}
    manifest.finishedAt = new Date().toISOString();
    const manifestPath = path.join(out, 'manifest.json');
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log('--- qa-m4 summary ---');
    console.log(`ok=${manifest.ok}`);
    console.log(`manifest=${manifestPath}`);
    if (manifest.errors.length) {
      console.log('errors:');
      for (const err of manifest.errors) console.log(`  - ${err.split('\n')[0]}`);
    }
    if (manifest.bannedWordHits.length) {
      console.log('banned words:');
      for (const hit of manifest.bannedWordHits) console.log(`  - ${hit}`);
    }
    if (!manifest.ok) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
