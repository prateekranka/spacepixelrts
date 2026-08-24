#!/usr/bin/env node
/** Browser proof for the four random P6/L6-style front-end variants. */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIEWPORT = { width: 1920, height: 1080 };
const THEMES = ['violet-orbit', 'solar-foundry', 'cyan-rift', 'crimson-citadel'];
const DEFAULT_OUT = '/tmp/starhaven-front-end-themes';
const TIMEOUT_MS = 45000;

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

function normalizeBaseUrl(raw) {
  return String(raw).replace(/\/$/, '');
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

function fileDigest(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function captureTheme(browser, baseUrl, out, theme) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console.error: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error?.message ?? String(error)}`));
  const result = { theme, menu: null, loading: null, errors, ok: false };

  try {
    const route = `${baseUrl}/desktop.html?front-theme=${encodeURIComponent(theme)}&qa-hold-loading=1`;
    await page.goto(route, { waitUntil: 'load' });
    await page.waitForFunction(
      (expected) => document.documentElement.dataset.frontTheme === expected
        && document.documentElement.dataset.frontArtReady === 'true'
        && document.querySelector('#start-screen.front-themed')?.dataset.frontTheme === expected,
      theme,
    );
    await settle(page);

    const menu = await page.evaluate((expected) => {
      const screen = document.querySelector('#start-screen');
      const heading = document.querySelector('.start-heading h1');
      const art = document.documentElement.style.getPropertyValue('--front-art');
      const rect = screen?.getBoundingClientRect();
      const copy = screen?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      return {
        theme: document.documentElement.dataset.frontTheme ?? '',
        screenTheme: screen?.getAttribute('data-front-theme') ?? '',
        heading: heading?.textContent?.trim() ?? '',
        containsRts: /\bRTS\b/i.test(copy),
        artIsFullHdData: art.startsWith('url("data:image/') && art.length > 10000,
        width: rect?.width ?? 0,
        height: rect?.height ?? 0,
        expected,
      };
    }, theme);
    assertThat(menu.theme === theme && menu.screenTheme === theme, `${theme}: menu theme identity drift`);
    assertThat(menu.heading === 'Starhaven', `${theme}: menu title is ${menu.heading}`);
    assertThat(!menu.containsRts, `${theme}: menu still shows RTS below Starhaven`);
    assertThat(menu.artIsFullHdData, `${theme}: generated Full-HD art is missing`);
    assertThat(menu.width === VIEWPORT.width && menu.height === VIEWPORT.height, `${theme}: menu is not viewport-sized`);
    const menuFile = path.join(out, `menu-${theme}.png`);
    await page.screenshot({ path: menuFile, type: 'png' });
    result.menu = { ...menu, file: path.basename(menuFile), sha256: fileDigest(menuFile) };

    await page.click('[data-start-action="new-skirmish"]');
    await page.waitForFunction(() => document.documentElement.dataset.appState === 'MatchSetup');
    await page.locator('[data-start-action="start-match"]').waitFor({ state: 'visible' });
    assertThat(await page.locator('[data-start-action="start-match"]').isEnabled(), `${theme}: Start Match is disabled`);
    await page.click('[data-start-action="start-match"]');
    await page.waitForFunction(
      (expected) => document.querySelector('#front-loading-screen')?.getAttribute('data-front-theme') === expected,
      theme,
    );
    await settle(page);

    const loading = await page.evaluate((expected) => {
      const screen = document.querySelector('#front-loading-screen');
      const heading = screen?.querySelector('h1');
      const progress = screen?.querySelector('.front-loading-track i');
      const rect = screen?.getBoundingClientRect();
      const copy = screen?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      return {
        theme: screen?.getAttribute('data-front-theme') ?? '',
        heading: heading?.textContent?.trim() ?? '',
        containsRts: /\bRTS\b/i.test(copy),
        progressWidth: progress ? getComputedStyle(progress).width : '',
        width: rect?.width ?? 0,
        height: rect?.height ?? 0,
        state: document.documentElement.dataset.appState ?? '',
        expected,
      };
    }, theme);
    assertThat(loading.theme === theme, `${theme}: loading theme identity drift`);
    assertThat(loading.heading === 'STARHAVEN', `${theme}: loading title is ${loading.heading}`);
    assertThat(!loading.containsRts, `${theme}: loading screen still shows RTS below Starhaven`);
    assertThat(loading.progressWidth !== '' && loading.progressWidth !== '0px', `${theme}: loading progress is missing`);
    assertThat(loading.width === VIEWPORT.width && loading.height === VIEWPORT.height, `${theme}: loading is not viewport-sized`);
    assertThat(loading.state === 'Loading', `${theme}: qa-hold-loading did not hold Loading state`);
    const loadingFile = path.join(out, `loading-${theme}.png`);
    await page.screenshot({ path: loadingFile, type: 'png' });
    result.loading = { ...loading, file: path.basename(loadingFile), sha256: fileDigest(loadingFile) };
    result.ok = errors.length === 0;
  } catch (error) {
    errors.push(error?.stack ?? String(error));
  } finally {
    await context.close();
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = resolveOut(args.out);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  let server = null;
  let browser = null;
  const manifest = {
    tool: 'qa-front-end-themes',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    viewport: VIEWPORT,
    baseUrl: null,
    themes: [],
    errors: [],
    ok: false,
  };

  try {
    let baseUrl;
    if (typeof args.url === 'string') baseUrl = normalizeBaseUrl(args.url);
    else {
      server = await startServer();
      baseUrl = server.url;
    }
    manifest.baseUrl = baseUrl;
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
    }).catch(() => chromium.launch({
      headless: true,
      args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
    }));

    for (const theme of THEMES) {
      const result = await captureTheme(browser, baseUrl, out, theme);
      manifest.themes.push(result);
      for (const error of result.errors) manifest.errors.push(`${theme}: ${error}`);
      console.log(`qa-front-end-themes: ${theme} ok=${result.ok}`);
    }

    const menuHashes = new Set(manifest.themes.map((result) => result.menu?.sha256).filter(Boolean));
    const loadingHashes = new Set(manifest.themes.map((result) => result.loading?.sha256).filter(Boolean));
    assertThat(menuHashes.size === THEMES.length, `menu variants are not visually distinct (${menuHashes.size}/4)`);
    assertThat(loadingHashes.size === THEMES.length, `loading variants are not visually distinct (${loadingHashes.size}/4)`);
    manifest.ok = manifest.errors.length === 0 && manifest.themes.every((result) => result.ok);
  } catch (error) {
    manifest.errors.push(error?.stack ?? String(error));
    manifest.ok = false;
  } finally {
    manifest.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    if (browser) await browser.close().catch(() => {});
    await stopServer(server);
  }

  if (!manifest.ok) {
    console.error(JSON.stringify(manifest, null, 2));
    process.exitCode = 1;
  } else {
    console.log(`PASS qa-front-end-themes: four Full-HD menu/loading variants; evidence ${out}`);
  }
}

main().catch((error) => {
  console.error(error?.stack ?? String(error));
  process.exitCode = 1;
});
