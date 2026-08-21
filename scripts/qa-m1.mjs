#!/usr/bin/env node

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
const EXPECTED_CONFIG = {
  playerFaction: 'gravemark',
  aiFaction: 'sunweaver',
  map: 'helios-rift',
  difficulty: 'veteran',
  fogOfWar: false,
  speed: 1.25,
  tacticalPause: 'on-demand',
  seedMode: 'deterministic',
  seed: 424242,
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
  if (typeof raw !== 'string' || !path.isAbsolute(raw)) throw new Error('--out must be an absolute path');
  const out = path.resolve(raw);
  const relative = path.relative(REPO_ROOT, out);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error('--out must be outside the repository');
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
        reject(new Error('could not allocate QA port'));
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
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => process.stdout.write(`[dev] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[dev] ${chunk}`));
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline && !state.exited) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return state;
    } catch {}
    await delay(200);
  }
  await stopServer(state);
  throw new Error(`Vite did not become ready at ${url}`);
}

async function stopServer(server) {
  if (!server || server.exited) return;
  const child = server.child;
  const signal = (name) => {
    try { process.kill(-child.pid, name); }
    catch { try { child.kill(name); } catch {} }
  };
  signal('SIGTERM');
  const stopped = await Promise.race([once(child, 'exit').then(() => true).catch(() => true), delay(3000).then(() => false)]);
  if (!stopped && !server.exited) {
    signal('SIGKILL');
    await Promise.race([once(child, 'exit').catch(() => {}), delay(1000)]);
  }
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
  return { width: png.width, height: png.height, maxLuma: Math.round(max * 100) / 100, litRatio };
}

function equalConfig(actual, expected) {
  return Object.keys(expected).every((key) => actual?.[key] === expected[key]);
}

async function probe(page) {
  return page.evaluate(() => {
    const value = globalThis.__STARHAVEN_QA__;
    return value ? JSON.parse(JSON.stringify(value)) : null;
  });
}

async function capture(page, file) {
  await page.screenshot({ path: file, type: 'png' });
  return analyzePng(file);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = resolveOut(args.out);
  fs.mkdirSync(out, { recursive: true });
  const manifest = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    ok: false,
    errors: [],
    checks: {},
    captures: {},
    finalProbe: null,
  };
  let server = null;
  let browser = null;
  const browserErrors = [];
  try {
    server = await startServer();
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
    });
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const attachErrors = (page, label) => {
      page.on('console', (message) => {
        if (message.type() === 'error') browserErrors.push(`${label} console: ${message.text()}`);
      });
      page.on('pageerror', (error) => browserErrors.push(`${label} page: ${error.message}`));
    };

    const page = await context.newPage();
    attachErrors(page, 'flow');
    await page.goto(`${server.url}/?qa-hold-loading=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'MainMenu');
    const menuProbe = await probe(page);
    if (menuProbe.resetCount !== 0) throw new Error('MainMenu resetCount must be 0');
    manifest.checks.mainMenu = { state: menuProbe.state, resetCount: menuProbe.resetCount };

    await page.getByRole('button', { name: /New Skirmish/i }).click();
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'MatchSetup');
    const setupEntryProbe = await probe(page);
    if (setupEntryProbe.resetCount !== 0) throw new Error('MatchSetup resetCount must be 0');

    await page.getByRole('group', { name: 'Player civilization' }).getByRole('button', { name: 'Gravemark' }).click();
    await page.getByRole('group', { name: 'AI civilization' }).getByRole('button', { name: 'Sunweaver' }).click();
    await page.getByRole('group', { name: 'AI difficulty' }).getByRole('button', { name: 'Veteran' }).click();
    await page.getByRole('group', { name: 'Fog of War' }).getByRole('button', { name: 'Off' }).click();
    await page.getByRole('group', { name: 'Match speed' }).getByRole('button', { name: '1.25×' }).click();
    await page.getByRole('group', { name: 'Tactical pause' }).getByRole('button', { name: 'On-demand' }).click();
    await page.getByRole('group', { name: 'Seed mode' }).getByRole('button', { name: 'Deterministic' }).click();
    await page.getByRole('spinbutton', { name: 'Deterministic seed' }).fill('424242');
    await page.waitForFunction((expected) => {
      const probe = globalThis.__STARHAVEN_QA__;
      return probe?.state === 'MatchSetup' && Object.keys(expected).every((key) => probe.config?.[key] === expected[key]);
    }, EXPECTED_CONFIG);

    const setupFile = path.join(out, 'setup.png');
    manifest.captures.setup = { file: 'setup.png', image: await capture(page, setupFile) };
    const configuredProbe = await probe(page);
    if (configuredProbe.resetCount !== 0) throw new Error('Configured setup resetCount must be 0');
    manifest.checks.configured = { config: configuredProbe.config, resetCount: configuredProbe.resetCount };

    const start = page.getByRole('button', { name: /Start Match/i });
    if (!(await start.isEnabled())) throw new Error('Start Match is disabled');
    await start.click();
    await page.waitForFunction(() => {
      const probe = globalThis.__STARHAVEN_QA__;
      return probe?.state === 'Loading' && probe?.resetCount === 1;
    }, null, { timeout: 30_000 });
    const loadingProbe = await probe(page);
    if (!equalConfig(loadingProbe.config, EXPECTED_CONFIG)) {
      throw new Error(`Held Loading config differs from submitted config: ${JSON.stringify(loadingProbe.config)}`);
    }
    manifest.checks.loadingHold = { state: loadingProbe.state, resetCount: loadingProbe.resetCount };
    const loadingFile = path.join(out, 'loading.png');
    manifest.captures.loading = { file: 'loading.png', image: await capture(page, loadingFile) };

    const loadReadyResult = await page.evaluate(() => globalThis.__STARHAVEN_QA__?.dispatch('LOAD_READY') ?? null);
    if (loadReadyResult?.accepted !== true) throw new Error(`Probe LOAD_READY dispatch rejected: ${JSON.stringify(loadReadyResult)}`);
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Playing', null, { timeout: 30_000 });
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.p99FrameMs > 0 && globalThis.__STARHAVEN_QA__?.p99FrameMs < 8, null, { timeout: 10_000 });
    const finalProbe = await probe(page);
    manifest.finalProbe = finalProbe;
    if (finalProbe.resetCount !== 1) throw new Error(`Playing resetCount ${finalProbe.resetCount} != 1`);
    if (!equalConfig(finalProbe.config, EXPECTED_CONFIG)) throw new Error('Playing config differs from submitted config');
    const transitionHistory = finalProbe.transitionHistory ?? [];
    let cursor = -1;
    for (const state of ['MainMenu', 'MatchSetup', 'Loading', 'Playing']) {
      const index = transitionHistory.indexOf(state, cursor + 1);
      if (index <= cursor) throw new Error(`transitionHistory missing ${state} at index > ${cursor}`);
      cursor = index;
    }
    const playingFile = path.join(out, 'playing.png');
    manifest.captures.playing = { file: 'playing.png', image: await capture(page, playingFile) };

    manifest.checks.transitionHistory = finalProbe.transitionHistory;
    manifest.checks.p99FrameMs = finalProbe.p99FrameMs;
    manifest.ok = true;
  } catch (error) {
    manifest.errors.push(error?.stack ?? String(error));
  } finally {
    if (browserErrors.length > 0) {
      manifest.errors.push(...browserErrors);
      manifest.ok = false;
    }
    try { if (browser) await browser.close(); } catch {}
    try { await stopServer(server); } catch {}
    manifest.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify({ ok: manifest.ok, checks: manifest.checks, captures: Object.keys(manifest.captures), errors: manifest.errors }, null, 2));
    if (!manifest.ok) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
