#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_BASE_URL = 'http://127.0.0.1:4173';
const OUTPUT_DIR = path.resolve(REPO_ROOT, '..', 'evidence', 'starhaven-aaa');
const VIEWPORT = { width: 1920, height: 1080 };
const PROFILE_STORAGE_KEY = 'starhaven.player-profile.v1';
const FACTIONS = ['sunweaver', 'gravemark'];
const MODES = ['menu', 'loading'];
const TIMEOUT_MS = 30_000;

function assertThat(condition, message) {
  if (!condition) throw new Error(message);
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
        reject(new Error('could not allocate a local QA port'));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function stopPreview(server) {
  if (!server || server.stopped) return;
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
  signal('SIGTERM');
  const stopped = await Promise.race([
    once(child, 'exit').then(() => true).catch(() => true),
    delay(3000).then(() => false),
  ]);
  if (!stopped) {
    signal('SIGKILL');
    await Promise.race([once(child, 'exit').catch(() => {}), delay(1000)]);
  }
}

async function startPreview() {
  const port = 4173;
  const url = `http://127.0.0.1:${port}`;
  const viteBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'vite');
  const child = spawn(viteBin, ['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: REPO_ROOT,
    detached: true,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const state = { child, url, exited: false, stopped: false };
  child.on('exit', () => { state.exited = true; });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => process.stdout.write(`[preview] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[preview] ${chunk}`));
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline && !state.exited) {
    try {
      const response = await fetch(`${url}/desktop.html`, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return state;
    } catch {}
    await delay(250);
  }
  await stopPreview(state);
  throw new Error(state.exited ? 'Vite preview exited before becoming reachable' : `Vite preview did not become reachable at ${url}`);
}

function profileValue(faction) {
  return {
    schemaVersion: 1,
    preferredFaction: faction,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    fastestVictoryMs: null,
    recentMatches: [],
    recordedMatchIds: [],
    unlockedAchievements: [],
    lastSeenDispatchVersion: 0,
  };
}

async function createContext(browser, faction) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: PROFILE_STORAGE_KEY, value: profileValue(faction) });
  return context;
}

function attachErrorCapture(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error?.message || String(error)}`));
  return errors;
}

async function waitForArt(page, faction, mode) {
  await page.waitForFunction(({ expectedFaction, expectedMode }) => {
    const root = document.querySelector('.front-end-scene');
    return root?.getAttribute('data-art-ready') === 'true'
      && root.getAttribute('data-faction') === expectedFaction
      && root.getAttribute('data-mode') === expectedMode;
  }, { expectedFaction: faction, expectedMode: mode }, { timeout: TIMEOUT_MS });
}

async function inspectCanvas(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.front-end-scene__canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const samples = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set();
    for (let gridY = 0; gridY < 60; gridY += 1) {
      for (let gridX = 0; gridX < 120; gridX += 1) {
        const x = Math.min(canvas.width - 1, Math.floor((gridX + 0.5) * canvas.width / 120));
        const y = Math.min(canvas.height - 1, Math.floor((gridY + 0.5) * canvas.height / 60));
        const offset = (y * canvas.width + x) * 4;
        colors.add(`${samples[offset]},${samples[offset + 1]},${samples[offset + 2]}`);
      }
    }
    const box = canvas.getBoundingClientRect();
    return {
      distinctColors: colors.size,
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      cssWidth: box.width,
      cssHeight: box.height,
      className: canvas.className,
    };
  });
}

async function assertScene(page, faction, mode, errors) {
  await waitForArt(page, faction, mode);
  const details = await inspectCanvas(page);
  assertThat(details, `${faction}/${mode}: scene canvas is missing or has no 2D context`);
  assertThat(details.className.includes('front-end-scene__canvas'), `${faction}/${mode}: scene canvas class is missing`);
  assertThat(details.backingWidth === 960 && details.backingHeight === 540, `${faction}/${mode}: backing canvas is ${details.backingWidth}x${details.backingHeight}`);
  assertThat(details.viewportWidth === VIEWPORT.width && details.viewportHeight === VIEWPORT.height, `${faction}/${mode}: viewport is ${details.viewportWidth}x${details.viewportHeight}`);
  assertThat(details.cssWidth >= VIEWPORT.width - 1 && details.cssHeight >= VIEWPORT.height - 1, `${faction}/${mode}: scene does not fill the viewport (${details.cssWidth}x${details.cssHeight})`);
  assertThat(details.distinctColors >= 200, `${faction}/${mode}: only ${details.distinctColors} sampled colors; canvas appears unpainted`);
  assertThat(errors.length === 0, `${faction}/${mode}: browser errors:\n${errors.join('\n')}`);
  return details;
}

async function captureMenu(browser, baseUrl, faction) {
  const context = await createContext(browser, faction);
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = attachErrorCapture(page);
  try {
    await page.goto(`${baseUrl}/desktop.html`, { waitUntil: 'load', timeout: TIMEOUT_MS });
    await page.getByRole('button', { name: /^New Skirmish(?:\s|$)/i }).waitFor({ state: 'visible' });
    await delay(600);
    const details = await assertScene(page, faction, 'menu', errors);
    const file = path.join(OUTPUT_DIR, `${faction}-menu.png`);
    await page.screenshot({ path: file, type: 'png' });
    return { faction, mode: 'menu', file, details };
  } finally {
    await context.close();
  }
}

async function captureLoading(browser, baseUrl, faction) {
  const context = await createContext(browser, faction);
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = attachErrorCapture(page);
  try {
    await page.goto(`${baseUrl}/desktop.html?qa-hold-loading=1`, { waitUntil: 'load', timeout: TIMEOUT_MS });
    await page.getByRole('button', { name: /^New Skirmish(?:\s|$)/i }).click();
    await page.getByRole('button', { name: /^Start Match(?:\s|$)/i }).click();
    await page.locator('.front-loading-screen').waitFor({ state: 'visible' });
    const details = await assertScene(page, faction, 'loading', errors);
    const file = path.join(OUTPUT_DIR, `${faction}-loading.png`);
    await page.screenshot({ path: file, type: 'png' });
    return { faction, mode: 'loading', file, details };
  } finally {
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const server = await startPreview();
  let browser;
  const results = [];
  const failures = [];
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
    for (const faction of FACTIONS) {
      for (const mode of MODES) {
        try {
          const result = mode === 'menu'
            ? await captureMenu(browser, server.url, faction)
            : await captureLoading(browser, server.url, faction);
          results.push({ ...result, status: 'PASS' });
        } catch (error) {
          const message = error?.stack || error?.message || String(error);
          failures.push(`${faction}/${mode}: ${message}`);
          results.push({ faction, mode, status: 'FAIL', error: message });
        }
      }
    }
  } finally {
    await browser?.close();
    await stopPreview(server);
  }

  console.log('AAA front-end QA results');
  console.log('status | faction | mode | sampled colors | screenshot');
  for (const result of results) {
    const colors = result.details?.distinctColors ?? 'n/a';
    console.log(`${result.status} | ${result.faction} | ${result.mode} | ${colors} | ${result.file ?? 'not written'}`);
  }
  if (failures.length > 0) {
    console.error('AAA front-end QA: FAIL');
    for (const failure of failures) console.error(failure);
    process.exitCode = 1;
    return;
  }
  console.log('AAA front-end QA: PASS');
}

main().catch((error) => {
  console.error(`AAA front-end QA: FAIL\n${error?.stack || error?.message || String(error)}`);
  process.exitCode = 1;
});
