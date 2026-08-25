#!/usr/bin/env node
/**
 * Record the accepted pixel front-end utility-panel interaction at 1366x1024.
 * The WebM is temporary; ffmpeg converts it to the committed H.264 MP4.
 */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIEWPORT = { width: 1366, height: 1024 };
const OUTPUT = path.join(REPO_ROOT, 'docs', 'qa', 'starhaven-pixel-ui-shell', 'utility-panel-interaction.mp4');
const PROFILE_KEY = 'starhaven.player-profile.v1';
const UTILITY_ACTIONS = [
  ['records', 'Records'],
  ['history', 'Match History'],
  ['codex', 'Tech Codex'],
  ['dispatches', 'Dispatches'],
];

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
        reject(new Error('could not allocate a video-preview port'));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function stopPreview(preview) {
  if (!preview || preview.stopped) return;
  preview.stopped = true;
  const child = preview.child;
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
  const port = await findOpenPort();
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
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline && !state.exited) {
    try {
      const response = await fetch(`${url}/desktop.html`, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return state;
    } catch {}
    await delay(250);
  }
  await stopPreview(state);
  throw new Error(state.exited ? 'Vite preview exited before recording' : `Vite preview did not become reachable at ${url}`);
}

function profileValue() {
  return {
    schemaVersion: 1,
    preferredFaction: 'sunweaver',
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

async function launchBrowser() {
  try {
    return { browser: await chromium.launch({ channel: 'chrome', headless: true }), engine: 'chrome' };
  } catch {
    return { browser: await chromium.launch({ headless: true }), engine: 'playwright-chromium' };
  }
}

async function waitForTooltip(page, selector) {
  await page.waitForFunction((buttonSelector) => {
    const button = document.querySelector(buttonSelector);
    const tooltipId = button?.getAttribute('aria-describedby') || '';
    const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
    if (!(tooltip instanceof HTMLElement)) return false;
    const style = getComputedStyle(tooltip);
    const box = tooltip.getBoundingClientRect();
    return style.visibility === 'visible' && Number(style.opacity) > 0 && box.width > 0 && box.height > 0;
  }, selector, { timeout: 15000 });
}

async function interactWithUtility(page, action, label, actions) {
  const selector = `.utility-button[data-start-action="${action}"]`;
  const opener = page.locator(selector);
  await opener.waitFor({ state: 'visible' });
  await opener.hover();
  await waitForTooltip(page, selector);
  const tooltipText = await opener.evaluate((element) => {
    const id = element.getAttribute('aria-describedby') || '';
    return id ? document.getElementById(id)?.textContent?.replace(/\s+/g, ' ').trim() || '' : '';
  });
  assertThat(tooltipText === label, `${label}: tooltip text was ${JSON.stringify(tooltipText)}`);
  await delay(1000);
  await opener.click();
  const panel = page.locator('.start-panel');
  await panel.waitFor({ state: 'visible' });
  await page.locator('.panel-card').waitFor({ state: 'visible' });
  await delay(1800);
  const content = await page.locator('.panel-card').innerText();
  assertThat(content.trim().length > 0, `${label}: panel has no readable content`);
  const close = panel.locator('.panel-close');
  await close.click();
  await panel.waitFor({ state: 'hidden' });
  const focusRestored = await page.evaluate((buttonSelector) => document.activeElement === document.querySelector(buttonSelector), selector);
  assertThat(focusRestored, `${label}: focus was not restored to its opener`);
  actions.push({ action, label, tooltip: tooltipText, panelTextLength: content.trim().length, focusRestored });
  await delay(500);
}

async function main() {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'starhaven-fpe6-video-'));
  let preview = null;
  let browser = null;
  let context = null;
  let page = null;
  const issues = [];
  const actions = [];
  let webmPath = null;
  try {
    preview = await startPreview();
    const launched = await launchBrowser();
    browser = launched.browser;
    context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      recordVideo: { dir: tempDir, size: VIEWPORT },
    });
    await context.addInitScript(({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    }, { key: PROFILE_KEY, value: profileValue() });
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') issues.push(`[${message.type()}] ${message.text()}`);
    });
    page.on('pageerror', (error) => issues.push(`[pageerror] ${error.message}`));
    page.on('requestfailed', (request) => issues.push(`[requestfailed] ${request.url()} — ${request.failure()?.errorText || 'unknown'}`));
    page.on('response', (response) => {
      if (response.status() >= 400) issues.push(`[response ${response.status()}] ${response.url()}`);
    });

    await page.goto(`${preview.url}/desktop.html?orientation=landscape-left`, { waitUntil: 'load' });
    await page.locator('.menu-item[data-start-action="new-skirmish"]').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('.front-end-scene')?.getAttribute('data-art-ready') === 'true');
    await page.waitForFunction(() => document.querySelector('#start-screen')?.dataset.civ === 'sunweaver'
      && document.querySelector('.menu-scene')?.getAttribute('data-scene-id') === 'sunweaver-capital');
    actions.push({ action: 'main-menu', faction: 'sunweaver', scene: 'sunweaver-capital' });
    await delay(1200);

    for (const [action, label] of UTILITY_ACTIONS) await interactWithUtility(page, action, label, actions);

    const factionsOpener = page.locator('.menu-item[data-start-action="factions"]');
    await factionsOpener.click();
    await page.locator('.start-panel').waitFor({ state: 'visible' });
    await delay(1600);
    await page.locator('.faction-choice[data-faction-choice="gravemark"]').click();
    await page.waitForFunction(() => document.querySelector('#start-screen')?.dataset.civ === 'gravemark'
      && document.querySelector('.front-end-scene')?.getAttribute('data-faction') === 'gravemark'
      && document.querySelector('.menu-scene')?.getAttribute('data-scene-id') === 'gravemark-quarry'
      && document.querySelector('.front-end-scene')?.getAttribute('data-art-ready') === 'true');
    const authoredSceneReady = await page.locator('.front-end-scene').getAttribute('data-art-ready');
    assertThat(authoredSceneReady === 'true', `Gravemark: data-art-ready was ${JSON.stringify(authoredSceneReady)}`);
    await delay(1200);
    await page.locator('.panel-close').click();
    await page.locator('.start-panel').waitFor({ state: 'hidden' });
    const factionFocusRestored = await page.evaluate(() => document.activeElement === document.querySelector('.menu-item[data-start-action="factions"]'));
    assertThat(factionFocusRestored, 'Factions: focus was not restored to its opener');
    actions.push({ action: 'factions', selected: 'gravemark', scene: 'gravemark-quarry', authoredSceneReady, focusRestored: factionFocusRestored });
    await delay(1200);

    assertThat(issues.length === 0, `recorded browser issues:\n${issues.join('\n')}`);
    const video = page.video();
    await context.close();
    context = null;
    webmPath = await video.path();
    await browser.close();
    browser = null;
    await stopPreview(preview);
    preview = null;

    await execFileAsync('ffmpeg', [
      '-y',
      '-i', webmPath,
      '-an',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      OUTPUT,
    ]);
    const probe = JSON.parse((await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name,width,height',
      '-show_entries', 'format=duration,size',
      '-of', 'json',
      OUTPUT,
    ])).stdout);
    const stream = probe.streams?.[0] || {};
    const size = Number(probe.format?.size || 0);
    const duration = Number(probe.format?.duration || 0);
    assertThat(stream.codec_name === 'h264', `MP4 codec is ${stream.codec_name || '(missing)'}`);
    assertThat(stream.width === VIEWPORT.width && stream.height === VIEWPORT.height, `MP4 dimensions are ${stream.width}x${stream.height}`);
    assertThat(duration > 0 && size > 0 && fs.statSync(OUTPUT).size > 0, `MP4 duration/size invalid (${duration}s/${size} bytes)`);
    console.log(JSON.stringify({
      pass: true,
      browserEngine: launched.engine,
      viewport: VIEWPORT,
      actions,
      issues,
      output: OUTPUT,
      webmTemporary: webmPath,
      ffprobe: { duration, size, codec: stream.codec_name, width: stream.width, height: stream.height },
    }, null, 2));
  } finally {
    try { await context?.close(); } catch {}
    try { await browser?.close(); } catch {}
    try { await stopPreview(preview); } catch {}
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`capture-front-end-interaction: FAIL\n${error?.stack || error?.message || String(error)}`);
  process.exitCode = 1;
});
