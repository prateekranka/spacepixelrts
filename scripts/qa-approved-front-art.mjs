#!/usr/bin/env node
/** Full-HD browser proof for the approved painted menu/loading compositions. */

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIEWPORT = { width: 1920, height: 1080 };
const THEMES = ['violet-orbit', 'solar-foundry', 'cyan-rift', 'crimson-citadel'];
const DEFAULT_OUT = '/tmp/starhaven-approved-front-art';
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
  if (!requested || !path.isAbsolute(requested)) throw new Error('--out must be an absolute path');
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

function digest(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('no private QA port'));
      server.close((error) => error ? reject(error) : resolve(address.port));
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

async function canvasFrame(page, selector) {
  return page.locator(selector).evaluate((canvas) => canvas.toDataURL());
}

async function assertAnimation(page, selector, label) {
  const before = await canvasFrame(page, selector);
  await page.waitForTimeout(360);
  const after = await canvasFrame(page, selector);
  assertThat(before !== after, `${label}: stepped pixel effects did not animate`);
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
        && document.documentElement.dataset.approvedFrontArtReady === 'true'
        && document.querySelector('#start-screen.front-approved-art-ready .front-approved-menu-art')?.complete,
      theme,
    );
    await page.waitForTimeout(180);

    const menu = await page.evaluate((expected) => {
      const screen = document.querySelector('#start-screen');
      const image = screen?.querySelector('.front-approved-menu-art');
      const effects = screen?.querySelector('.front-approved-effects');
      const primary = screen?.querySelector('.front-pixel-menu [data-start-action="new-skirmish"]');
      const start = screen?.querySelector('.front-start-button');
      const originalMenu = screen?.querySelector('.menu-list');
      const imageRect = image?.getBoundingClientRect();
      const primaryRect = primary?.getBoundingClientRect();
      const startRect = start?.getBoundingClientRect();
      return {
        expected,
        theme: document.documentElement.dataset.frontTheme ?? '',
        approved: document.documentElement.dataset.approvedFrontArtReady ?? '',
        asset: screen?.getAttribute('data-approved-asset') ?? '',
        source: image?.getAttribute('src') ?? '',
        naturalWidth: image instanceof HTMLImageElement ? image.naturalWidth : 0,
        naturalHeight: image instanceof HTMLImageElement ? image.naturalHeight : 0,
        viewportWidth: imageRect?.width ?? 0,
        viewportHeight: imageRect?.height ?? 0,
        effectsWidth: effects instanceof HTMLCanvasElement ? effects.width : 0,
        effectsHeight: effects instanceof HTMLCanvasElement ? effects.height : 0,
        primary: primaryRect ? { x: primaryRect.x, y: primaryRect.y, width: primaryRect.width, height: primaryRect.height } : null,
        start: startRect ? { x: startRect.x, y: startRect.y, width: startRect.width, height: startRect.height } : null,
        originalOpacity: originalMenu ? getComputedStyle(originalMenu).opacity : '',
        containsRts: /\bRTS\b/i.test(screen?.textContent ?? ''),
      };
    }, theme);

    assertThat(menu.theme === theme && menu.approved === 'true', `${theme}: approved menu identity drift`);
    assertThat(menu.asset === 'menu' && menu.source.startsWith('blob:'), `${theme}: approved menu WebP is not mounted`);
    assertThat(menu.naturalWidth === 960 && menu.naturalHeight === 540, `${theme}: menu source is not 960×540 pixel art`);
    assertThat(menu.viewportWidth === 1920 && menu.viewportHeight === 1080, `${theme}: menu does not fill Full HD`);
    assertThat(menu.effectsWidth === 960 && menu.effectsHeight === 540, `${theme}: effects canvas is not low-resolution pixel art`);
    assertThat(menu.primary?.x > 1400 && menu.primary?.width > 350 && menu.primary?.height > 55, `${theme}: painted menu hit target is misaligned`);
    assertThat(menu.start?.x > 1400 && menu.start?.y > 760 && menu.start?.width > 350, `${theme}: painted Start hit target is misaligned`);
    assertThat(menu.originalOpacity === '0', `${theme}: legacy menu remains visibly layered`);
    assertThat(!menu.containsRts, `${theme}: live DOM still exposes an RTS subtitle`);
    await assertAnimation(page, '#start-screen .front-approved-effects', `${theme} menu`);

    const menuFile = path.join(out, `approved-menu-${theme}.png`);
    await page.screenshot({ path: menuFile, type: 'png' });
    result.menu = { ...menu, file: path.basename(menuFile), sha256: digest(menuFile) };

    await page.click('.front-pixel-menu [data-start-action="new-skirmish"]');
    await page.waitForFunction(() => document.documentElement.dataset.appState === 'MatchSetup');
    const startMatch = page.locator('[data-start-action="start-match"]');
    await startMatch.waitFor({ state: 'visible' });
    assertThat(await startMatch.isEnabled(), `${theme}: Start Match is disabled`);
    await startMatch.click();
    await page.waitForFunction(
      (expected) => document.querySelector('#front-loading-screen.front-approved-art-ready')?.getAttribute('data-front-theme') === expected
        && document.querySelector('#front-loading-screen .front-approved-loading-art')?.complete,
      theme,
    );
    await page.waitForTimeout(420);

    const loading = await page.evaluate((expected) => {
      const screen = document.querySelector('#front-loading-screen');
      const image = screen?.querySelector('.front-approved-loading-art');
      const effects = screen?.querySelector('.front-approved-effects');
      const imageRect = image?.getBoundingClientRect();
      const progress = screen?.querySelector('.front-loading-progress b')?.textContent?.trim() ?? '';
      return {
        expected,
        theme: screen?.getAttribute('data-front-theme') ?? '',
        asset: screen?.getAttribute('data-approved-asset') ?? '',
        source: image?.getAttribute('src') ?? '',
        naturalWidth: image instanceof HTMLImageElement ? image.naturalWidth : 0,
        naturalHeight: image instanceof HTMLImageElement ? image.naturalHeight : 0,
        viewportWidth: imageRect?.width ?? 0,
        viewportHeight: imageRect?.height ?? 0,
        effectsWidth: effects instanceof HTMLCanvasElement ? effects.width : 0,
        effectsHeight: effects instanceof HTMLCanvasElement ? effects.height : 0,
        progress,
        state: document.documentElement.dataset.appState ?? '',
        containsRts: /\bRTS\b/i.test(screen?.textContent ?? ''),
      };
    }, theme);

    assertThat(loading.theme === theme && loading.asset === 'loading', `${theme}: approved loading identity drift`);
    assertThat(loading.source.startsWith('blob:'), `${theme}: approved loading WebP is not mounted`);
    assertThat(loading.naturalWidth === 960 && loading.naturalHeight === 540, `${theme}: loading source is not 960×540 pixel art`);
    assertThat(loading.viewportWidth === 1920 && loading.viewportHeight === 1080, `${theme}: loading does not fill Full HD`);
    assertThat(loading.effectsWidth === 960 && loading.effectsHeight === 540, `${theme}: loading effects are not low-resolution`);
    assertThat(Number.parseInt(loading.progress, 10) > 12, `${theme}: live stepped progress did not advance (${loading.progress})`);
    assertThat(loading.state === 'Loading', `${theme}: loading hold state drifted to ${loading.state}`);
    assertThat(!loading.containsRts, `${theme}: loading DOM exposes an RTS subtitle`);
    await assertAnimation(page, '#front-loading-screen .front-approved-effects', `${theme} loading`);

    const loadingFile = path.join(out, `approved-loading-${theme}.png`);
    await page.screenshot({ path: loadingFile, type: 'png' });
    result.loading = { ...loading, file: path.basename(loadingFile), sha256: digest(loadingFile) };
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
    tool: 'qa-approved-front-art',
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
    browser = await chromium.launch({ channel: 'chrome', headless: true })
      .catch(() => chromium.launch({ headless: true }));
    for (const theme of THEMES) {
      const result = await captureTheme(browser, baseUrl, out, theme);
      manifest.themes.push(result);
      for (const error of result.errors) manifest.errors.push(`${theme}: ${error}`);
      console.log(`qa-approved-front-art: ${theme} ok=${result.ok}`);
    }
    const menuHashes = new Set(manifest.themes.map((entry) => entry.menu?.sha256).filter(Boolean));
    const loadingHashes = new Set(manifest.themes.map((entry) => entry.loading?.sha256).filter(Boolean));
    assertThat(menuHashes.size === THEMES.length, `approved menu variants are not visually distinct (${menuHashes.size}/4)`);
    assertThat(loadingHashes.size === THEMES.length, `approved loading variants are not visually distinct (${loadingHashes.size}/4)`);
    manifest.ok = manifest.errors.length === 0 && manifest.themes.every((entry) => entry.ok);
  } catch (error) {
    manifest.errors.push(error?.stack ?? String(error));
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
    console.log(`PASS qa-approved-front-art: approved Full-HD paintings, live controls, and stepped animation; evidence ${out}`);
  }
}

main().catch((error) => {
  console.error(error?.stack ?? String(error));
  process.exitCode = 1;
});
