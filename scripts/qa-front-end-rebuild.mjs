#!/usr/bin/env node
/**
 * Browser contract proof for the Starhaven front-end rebuild.
 *
 * Usage:
 *   node scripts/qa-front-end-rebuild.mjs --url http://127.0.0.1:4173 --out /path/to/evidence
 */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_URL = 'http://127.0.0.1:4173';
const DIMENSIONS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1366, height: 1024 },
  { width: 1180, height: 820 },
];
const SCENES = ['sunweaver-capital', 'gravemark-quarry'];
const UTILITY_CONTROLS = [
  'Tutorial',
  'Factions',
  'Settings',
  'Records',
  'Match History',
  'Tech Codex',
  'Dispatches',
];
const PANEL_CONTROLS = ['Records', 'Match History', 'Tech Codex', 'Dispatches'];
const TIMEOUT_MS = 15000;
const SERVER_BOOT_TIMEOUT_MS = 120000;

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (!raw.startsWith('--')) continue;
    const equals = raw.indexOf('=');
    if (equals >= 0) result[raw.slice(2, equals)] = raw.slice(equals + 1);
    else if (argv[index + 1] && !argv[index + 1].startsWith('--')) result[raw.slice(2)] = argv[++index];
    else result[raw.slice(2)] = true;
  }
  return result;
}

function resolveOutput(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error('--out is required. Provide an absolute, durable evidence folder.');
  }
  if (!path.isAbsolute(raw.trim())) {
    throw new Error('--out must be an absolute path so evidence remains durable.');
  }
  const output = path.resolve(raw.trim());
  if (output === REPO_ROOT) {
    throw new Error('--out must be a folder, not the repository root.');
  }
  return output;
}

function normalizeUrl(raw) {
  return String(raw || DEFAULT_URL).replace(/\/$/, '');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.unref();
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const address = listener.address();
      if (!address || typeof address === 'string') {
        listener.close();
        reject(new Error('could not allocate a private front-end QA port'));
        return;
      }
      listener.close((error) => (error ? reject(error) : resolve(address.port)));
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
  const server = { child, url, exited: false, launchError: null, stopped: false };
  child.once('exit', () => {
    server.exited = true;
  });
  const output = [];
  child.once('error', (error) => {
    server.launchError = error;
    server.exited = true;
    output.push(`[spawn error] ${error.message}`);
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream?.setEncoding('utf8');
    stream?.on('data', (chunk) => output.push(chunk));
  }
  const deadline = Date.now() + SERVER_BOOT_TIMEOUT_MS;
  while (Date.now() < deadline && !server.exited) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return server;
    } catch {}
    await delay(250);
  }
  await stopServer(server);
  if (server.launchError) {
    throw new Error(`front-end QA dev server failed to launch: ${server.launchError.message}`);
  }
  const detail = output.join('').trim();
  throw new Error(server.exited
    ? `front-end QA dev server exited before readiness${detail ? `: ${detail}` : ''}`
    : `front-end QA dev server did not become ready at ${url}`);
}

async function stopServer(server) {
  if (!server?.child || server.stopped) return;
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

function visible(element) {
  if (!(element instanceof HTMLElement)) return false;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function assertThat(condition, message) {
  if (!condition) throw new Error(message);
}

function namePattern(name) {
  return new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`, 'i');
}

async function visibleButton(page, name, { required = true } = {}) {
  const buttons = page.getByRole('button', { name: namePattern(name) });
  const matches = [];
  for (let index = 0; index < await buttons.count(); index += 1) {
    const button = buttons.nth(index);
    if (await button.isVisible()) matches.push(button);
  }
  if (required) assertThat(matches.length === 1, `${name}: expected one visible button, found ${matches.length}`);
  return matches[0] ?? null;
}

async function waitForMenu(page) {
  await page.waitForFunction(() => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const controls = [...document.querySelectorAll('button')].filter(isVisible);
    const text = controls.map((control) => `${control.getAttribute('aria-label') || ''} ${control.textContent || ''}`).join(' ');
    return /New Skirmish|Continue/i.test(text) && /Factions/i.test(text);
  }, undefined, { timeout: TIMEOUT_MS });
}

async function readScene(page) {
  return page.evaluate(() => {
    const roots = [
      document.body,
      document.querySelector('[data-front-shell]'),
      document.querySelector('.front-shell'),
      document.querySelector('#start-screen'),
      document.querySelector('[data-scene-id]'),
    ].filter(Boolean);
    const element = roots.find((candidate) => candidate?.getAttribute('data-scene-id'));
    return element?.getAttribute('data-scene-id') || '';
  });
}

async function readCanvas(page) {
  return page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')];
    const scene = canvases.find((canvas) => {
      const className = typeof canvas.className === 'string' ? canvas.className : '';
      return canvas.matches('[data-scene-canvas], [data-role="scene-canvas"]')
        || /scene-canvas|front-scene-canvas/i.test(className)
        || (canvas.width === 960 && canvas.height === 540);
    });
    return scene ? { width: scene.width, height: scene.height, className: scene.className } : null;
  });
}

async function readOverflow(page) {
  return page.evaluate(() => ({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    document: {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    },
  }));
}

async function readTooltip(page, button) {
  return button.evaluate((element) => {
    const describedBy = element.getAttribute('aria-describedby') || '';
    const described = describedBy
      .split(/\s+/)
      .map((id) => id && document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ');
    return {
      tagName: element.tagName,
      name: element.getAttribute('aria-label') || element.textContent?.replace(/\s+/g, ' ').trim() || '',
      title: element.getAttribute('title') || '',
      tooltip: element.getAttribute('data-tooltip') || element.getAttribute('data-tooltip-content') || '',
      description: element.getAttribute('aria-description') || described,
      rect: (() => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height };
      })(),
    };
  });
}

async function visiblePanel(page) {
  const panels = page.locator([
    '[role="dialog"]:visible',
    '[data-panel]:visible',
    '[data-utility-panel]:visible',
    '.utility-panel:visible',
    '.panel-card:visible',
  ].join(','));
  return (await panels.count()) > 0 ? panels.last() : null;
}

async function closeVisiblePanel(page) {
  const panel = await visiblePanel(page);
  if (!panel) return;
  const close = panel.getByRole('button', { name: /^Close(?:\s|$)/i });
  if (await close.count() > 0 && await close.last().isVisible()) {
    await close.last().click();
    await page.waitForTimeout(50);
    return;
  }
  const globalClose = page.getByRole('button', { name: /^Close(?:\s|$)/i });
  if (await globalClose.count() > 0 && await globalClose.last().isVisible()) await globalClose.last().click();
}

async function exercisePanel(page, name, output, capture = false) {
  await waitForMenu(page);
  const opener = await visibleButton(page, name);
  const openerHandle = await opener.elementHandle();
  await opener.click();
  const panel = await visiblePanel(page);
  assertThat(panel, `${name}: no visible dialog or panel after click`);
  const close = panel.getByRole('button', { name: /^Close(?:\s|$)/i });
  assertThat(await close.count() > 0, `${name}: visible panel has no Close button`);
  assertThat(await close.last().isVisible(), `${name}: Close button is not visible`);
  let captureFile = null;
  if (capture) {
    captureFile = path.join(output, 'utility-records-panel-1920x1080.png');
    await page.screenshot({ path: captureFile, type: 'png' });
  }
  await close.last().click();
  await page.waitForFunction(() => {
    const candidates = [...document.querySelectorAll('[role="dialog"], [data-panel], [data-utility-panel], .utility-panel, .panel-card')];
    return !candidates.some((candidate) => {
      if (!(candidate instanceof HTMLElement)) return false;
      const style = getComputedStyle(candidate);
      const rect = candidate.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
  }, undefined, { timeout: TIMEOUT_MS });
  assertThat(await page.evaluate((element) => document.activeElement === element, openerHandle), `${name}: closing panel did not return focus to opener`);
  await openerHandle?.dispose();
  return captureFile ? { file: path.basename(captureFile) } : {};
}

async function unreadBadge(page) {
  return page.evaluate(() => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const dispatch = [...document.querySelectorAll('button')].find((button) => {
      const label = button.getAttribute('aria-label') || '';
      const text = button.textContent || '';
      return /^Dispatches(?:\s|$)/i.test(label) || /^Dispatches(?:\s|$)/i.test(text);
    });
    const selectors = [
      '[data-dispatches-unread]',
      '[data-dispatch-badge]',
      '[data-unread-badge]',
      '[data-unread-for="dispatches"]',
      '[data-badge-for="dispatches"]',
      '.dispatches-unread',
      '.unread-badge',
      '.unread',
      '.badge',
    ];
    const candidates = [
      ...(dispatch ? [...dispatch.querySelectorAll(selectors.join(','))] : []),
      ...[...document.querySelectorAll(selectors.join(','))],
    ];
    const unique = [...new Set(candidates)];
    const badge = unique.find((element) => isVisible(element) && (element.textContent || '').trim() !== '')
      || unique.find((element) => isVisible(element));
    return badge
      ? { present: true, visible: isVisible(badge), text: badge.textContent?.replace(/\s+/g, ' ').trim() || '', tagName: badge.tagName }
      : { present: false, visible: false, text: '', tagName: '' };
  });
}

async function selectFaction(page, faction, expectedScene) {
  await waitForMenu(page);
  const factions = await visibleButton(page, 'Factions');
  await factions.click();
  const choice = await visibleButton(page, faction);
  assertThat(choice, `Factions: ${faction} choice is not a real visible button`);
  await choice.click();
  await page.waitForFunction((expected) => {
    const roots = [document.body, document.querySelector('[data-front-shell]'), document.querySelector('.front-shell'), document.querySelector('[data-scene-id]')].filter(Boolean);
    return roots.some((root) => root?.getAttribute('data-scene-id') === expected);
  }, expectedScene, { timeout: TIMEOUT_MS });
  await closeVisiblePanel(page);
  assertThat(await readScene(page) === expectedScene, `Factions: scene did not become ${expectedScene}`);
}

async function ensureScene(page, scene) {
  if (await readScene(page) !== scene) {
    await selectFaction(page, scene === 'gravemark-quarry' ? 'Gravemark' : 'Sunweaver', scene);
  }
  assertThat(await readScene(page) === scene, `scene is not ${scene}`);
}

function appendError(manifest, error) {
  const text = error?.stack || error?.message || String(error);
  manifest.errors.push(text);
}

async function attempt(manifest, name, operation) {
  try {
    const details = await operation();
    manifest.assertions.push({ name, status: 'PASS', ...(details && typeof details === 'object' ? { details } : {}) });
    return details;
  } catch (error) {
    manifest.assertions.push({ name, status: 'FAIL', error: error?.message || String(error) });
    appendError(manifest, error);
    return null;
  }
}

async function runContract(browser, baseUrl, output, manifest) {
  const context = await browser.newContext({ viewport: DIMENSIONS[0], deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console.error: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error?.message || String(error)}`));

  try {
    await page.goto(baseUrl, { waitUntil: 'load', timeout: TIMEOUT_MS });
    await waitForMenu(page);
    await attempt(manifest, 'front shell scene id', async () => {
      const scene = await readScene(page);
      assertThat(SCENES.includes(scene), `scene id must be ${SCENES.join(' or ')}, got ${scene || '(missing)'}`);
      manifest.sceneIds.push(scene);
      return { scene };
    });
    await attempt(manifest, 'one primary menu control', async () => {
      const controls = page.getByRole('button', { name: /^(?:New Skirmish|Continue)(?:\s|$)/i });
      let visibleCount = 0;
      for (let index = 0; index < await controls.count(); index += 1) if (await controls.nth(index).isVisible()) visibleCount += 1;
      assertThat(visibleCount === 1, `expected one visible New Skirmish or Continue control, found ${visibleCount}`);
      return { visibleCount };
    });
    await attempt(manifest, 'real utility buttons', async () => {
      const controls = [];
      for (const name of UTILITY_CONTROLS) {
        const button = await visibleButton(page, name);
        const details = await readTooltip(page, button);
        assertThat(details.tagName === 'BUTTON', `${name}: control is not a real button element`);
        assertThat(details.name.trim() !== '', `${name}: accessible name is empty`);
        assertThat(details.rect.width >= 44 && details.rect.height >= 44, `${name}: control is smaller than 44x44 CSS pixels`);
        assertThat((details.title || details.tooltip || details.description).trim() !== '', `${name}: title or tooltip is empty`);
        controls.push({ name, ...details });
      }
      manifest.controls = ['New Skirmish or Continue', ...controls.map(({ name }) => name)];
      return { controls };
    });
    await attempt(manifest, 'scene canvas backing dimensions', async () => {
      const canvas = await readCanvas(page);
      assertThat(canvas, 'scene canvas is missing');
      assertThat(canvas.width === 960 && canvas.height === 540, `scene canvas backing dimensions are ${canvas.width}x${canvas.height}, expected 960x540`);
      return canvas;
    });
    await attempt(manifest, 'document overflow at 1920x1080', async () => {
      const overflow = await readOverflow(page);
      assertThat(overflow.document.width <= overflow.viewport.width, `horizontal document overflow: ${overflow.document.width} > ${overflow.viewport.width}`);
      assertThat(overflow.document.height <= overflow.viewport.height, `vertical document overflow: ${overflow.document.height} > ${overflow.viewport.height}`);
      return overflow;
    });
    await attempt(manifest, 'Dispatches unread badge clears and persists', async () => {
      await waitForMenu(page);
      const initialBadge = await unreadBadge(page);
      assertThat(initialBadge.present && initialBadge.visible, `Dispatches: fresh profile has no visible DOM unread badge (${JSON.stringify(initialBadge)})`);
      const opener = await visibleButton(page, 'Dispatches');
      await opener.click();
      const panel = await visiblePanel(page);
      assertThat(panel, 'Dispatches: panel did not open');
      const afterOpen = await unreadBadge(page);
      assertThat(!afterOpen.visible, `Dispatches: unread badge remains visible after opening (${JSON.stringify(afterOpen)})`);
      await closeVisiblePanel(page);
      await page.reload({ waitUntil: 'load', timeout: TIMEOUT_MS });
      await waitForMenu(page);
      const afterReload = await unreadBadge(page);
      assertThat(!afterReload.visible, `Dispatches: unread badge returned after reload (${JSON.stringify(afterReload)})`);
      return { initialBadge, afterOpen, afterReload };
    });
    for (const name of PANEL_CONTROLS) {
      const panelResult = await attempt(manifest, `${name} panel opens and restores focus`, () => exercisePanel(page, name, output, name === 'Records'));
      if (panelResult?.file && !manifest.capturedFiles.includes(panelResult.file)) manifest.capturedFiles.push(panelResult.file);
    }
    await attempt(manifest, 'dialog traps keyboard focus and Escape restores opener', async () => {
      const opener = await visibleButton(page, 'Records');
      const openerHandle = await opener.elementHandle();
      await opener.click();
      const panel = await visiblePanel(page);
      assertThat(panel, 'Records: dialog did not open for keyboard check');
      await page.keyboard.press('Tab');
      const focusInside = await panel.evaluate((element) => element.contains(document.activeElement));
      assertThat(focusInside, 'Records: Tab moved focus outside the dialog');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => ![...document.querySelectorAll('[role="dialog"]')].some((candidate) => {
        if (!(candidate instanceof HTMLElement)) return false;
        const style = getComputedStyle(candidate);
        const rect = candidate.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      }), undefined, { timeout: TIMEOUT_MS });
      assertThat(await page.evaluate((element) => document.activeElement === element, openerHandle), 'Records: Escape did not return focus to opener');
      await openerHandle?.dispose();
      return { focusInside, escapeRestoredFocus: true };
    });
    await attempt(manifest, 'faction scene selection persists', async () => {
      await selectFaction(page, 'Gravemark', 'gravemark-quarry');
      await page.reload({ waitUntil: 'load', timeout: TIMEOUT_MS });
      await waitForMenu(page);
      assertThat(await readScene(page) === 'gravemark-quarry', 'Gravemark scene did not persist after reload');
      await selectFaction(page, 'Sunweaver', 'sunweaver-capital');
      await page.reload({ waitUntil: 'load', timeout: TIMEOUT_MS });
      await waitForMenu(page);
      assertThat(await readScene(page) === 'sunweaver-capital', 'Sunweaver scene did not return after selection');
      return { scenes: ['gravemark-quarry', 'sunweaver-capital'] };
    });
    await attempt(manifest, 'New Skirmish opens distinct setup action', async () => {
      await waitForMenu(page);
      const newSkirmish = await visibleButton(page, 'New Skirmish', { required: false });
      if (!newSkirmish) {
        const continueButton = await visibleButton(page, 'Continue');
        await continueButton.click();
      } else {
        await newSkirmish.click();
      }
      const startMatch = await visibleButton(page, 'Start Match');
      assertThat(startMatch, 'New Skirmish: Start Match setup action is missing');
      const primaryCount = await page.getByRole('button', { name: /^(?:New Skirmish|Continue)(?:\s|$)/i }).count();
      let visiblePrimaryCount = 0;
      for (let index = 0; index < primaryCount; index += 1) if (await page.getByRole('button', { name: /^(?:New Skirmish|Continue)(?:\s|$)/i }).nth(index).isVisible()) visiblePrimaryCount += 1;
      assertThat(visiblePrimaryCount === 0, 'setup keeps a duplicate visible main-menu primary control');
      const setup = await page.locator('[data-screen="setup"]:visible, [data-view="setup"]:visible, [aria-label*="setup" i]:visible, .setup-view:visible').count();
      assertThat(setup > 0, 'New Skirmish: setup view is not visible');
      await page.reload({ waitUntil: 'load', timeout: TIMEOUT_MS });
      await waitForMenu(page);
      return { setupVisible: setup > 0, startMatchVisible: true };
    });
    await attempt(manifest, 'no console or page errors', async () => {
      assertThat(browserErrors.length === 0, browserErrors.join('\n'));
      return { errors: browserErrors };
    });

    for (const dimension of DIMENSIONS) {
      await page.setViewportSize(dimension);
      for (const scene of SCENES) {
        await attempt(manifest, `screenshot ${scene} ${dimension.width}x${dimension.height}`, async () => {
          await page.goto(baseUrl, { waitUntil: 'load', timeout: TIMEOUT_MS });
          await waitForMenu(page);
          await ensureScene(page, scene);
          const canvas = await readCanvas(page);
          assertThat(canvas?.width === 960 && canvas?.height === 540, `${scene} ${dimension.width}x${dimension.height}: scene canvas is not 960x540`);
          const overflow = await readOverflow(page);
          assertThat(overflow.document.width <= overflow.viewport.width, `${scene} ${dimension.width}x${dimension.height}: horizontal overflow`);
          assertThat(overflow.document.height <= overflow.viewport.height, `${scene} ${dimension.width}x${dimension.height}: vertical overflow`);
          const file = path.join(output, `scene-${scene}-${dimension.width}x${dimension.height}.png`);
          await page.screenshot({ path: file, type: 'png' });
          manifest.capturedFiles.push(path.basename(file));
          if (!manifest.sceneIds.includes(scene)) manifest.sceneIds.push(scene);
          return { scene, dimension, file: path.basename(file), canvas, overflow };
        });
      }
    }
    await attempt(manifest, 'reduced motion contract', async () => {
      const reducedContext = await browser.newContext({ viewport: DIMENSIONS[0], deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const reducedPage = await reducedContext.newPage();
      try {
        await reducedPage.goto(baseUrl, { waitUntil: 'load', timeout: TIMEOUT_MS });
        await waitForMenu(reducedPage);
        const reduced = await reducedPage.evaluate(() => {
          const roots = [document.documentElement, document.body, document.querySelector('[data-front-shell]'), document.querySelector('.front-shell'), document.querySelector('#start-screen')].filter(Boolean);
          const marker = roots.map((root) => root?.getAttribute('data-reduced-motion') || '').find((value) => value !== '') || '';
          const matches = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          const sample = document.querySelector('button');
          const computed = sample ? getComputedStyle(sample) : null;
          const equivalent = Boolean(computed && computed.transitionDuration === '0s' && computed.animationDuration === '0s');
          return { marker, matches, equivalent };
        });
        assertThat(reduced.matches, 'reduced-motion media query was not emulated');
        assertThat(reduced.marker !== '' || reduced.equivalent, 'reduced-motion root marker or computed contract is missing');
        return reduced;
      } finally {
        await reducedContext.close();
      }
    });
    await attempt(manifest, 'QA routes do not write player profile data', async () => {
      const qaContext = await browser.newContext({ viewport: DIMENSIONS[0], deviceScaleFactor: 1 });
      const qaPage = await qaContext.newPage();
      try {
        const qaUrl = new URL(baseUrl);
        qaUrl.searchParams.set('qa', 'start-menu');
        await qaPage.goto(qaUrl.toString(), { waitUntil: 'load', timeout: TIMEOUT_MS });
        await waitForMenu(qaPage);
        const dispatches = await visibleButton(qaPage, 'Dispatches');
        await dispatches.click();
        const result = await qaPage.evaluate(() => ({
          stored: localStorage.getItem('starhaven.player-profile.v1'),
          seen: window.__STARHAVEN_QA__?.profile?.lastSeenDispatchVersion,
        }));
        assertThat(result.stored === null, 'QA route wrote the player-profile localStorage key');
        assertThat(result.seen === 0, `QA route changed the published profile to dispatch version ${result.seen}`);
        return result;
      } finally {
        await qaContext.close();
      }
    });
  } finally {
    if (browserErrors.length > 0) {
      manifest.errors.push(...browserErrors.map((error) => `browser: ${error}`));
    }
    await context.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let output;
  try {
    output = resolveOutput(args.out);
    fs.mkdirSync(output, { recursive: true });
  } catch (error) {
    console.error(`qa-front-end-rebuild: ${error?.message || String(error)}`);
    process.exitCode = 1;
    return;
  }

  const manifest = {
    tool: 'qa-front-end-rebuild',
    url: normalizeUrl(args.url),
    dimensions: DIMENSIONS,
    sceneIds: [],
    controls: [],
    assertions: [],
    capturedFiles: [],
    errors: [],
    status: 'FAIL',
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  let browser;
  let server;
  try {
    if (args.url === undefined) {
      server = await startServer();
      manifest.url = server.url;
    }
    browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
    await runContract(browser, manifest.url, output, manifest);
  } catch (error) {
    appendError(manifest, error);
  } finally {
    await browser?.close();
    await stopServer(server);
    manifest.finishedAt = new Date().toISOString();
    manifest.sceneIds = [...new Set(manifest.sceneIds)];
    manifest.status = manifest.errors.length === 0 && manifest.assertions.every((assertion) => assertion.status === 'PASS') ? 'PASS' : 'FAIL';
    fs.writeFileSync(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }
  console.log(`qa-front-end-rebuild: ${manifest.status}`);
  console.log(`qa-front-end-rebuild: manifest ${path.join(output, 'manifest.json')}`);
  if (manifest.status !== 'PASS') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
