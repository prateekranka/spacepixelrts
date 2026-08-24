#!/usr/bin/env node
/**
 * Browser proof for the FPE-2 Main Menu and FPE-3 setup/panel pixel shell.
 *
 * Usage:
 *   npm run qa:pixel-front-end -- --out /absolute/evidence/folder
 *   npm run qa:pixel-front-end -- --url http://127.0.0.1:4173 --out /absolute/evidence/folder
 */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PROFILE_KEY = 'starhaven.player-profile.v1';
const DIMENSIONS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1366, height: 1024 },
  { width: 1180, height: 820 },
];
const FACTIONS = ['sunweaver', 'gravemark'];
const SCENES = {
  sunweaver: 'sunweaver-capital',
  gravemark: 'gravemark-quarry',
};
const PANEL_ACTIONS = ['tutorial', 'factions', 'settings', 'records', 'history', 'codex', 'dispatches'];
const TIMEOUT_MS = 30000;

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

function assertThat(condition, message) {
  if (!condition) throw new Error(message);
}

function resolveOutput(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error('--out is required. Provide an absolute, durable evidence folder.');
  }
  if (!path.isAbsolute(raw.trim())) {
    throw new Error('--out must be an absolute path so evidence remains durable.');
  }
  const output = path.resolve(raw.trim());
  if (output === REPO_ROOT) throw new Error('--out must not be the repository root.');
  return output;
}

function normalizeUrl(raw) {
  return String(raw || '').replace(/\/$/, '');
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  throw new Error(state.exited ? 'Vite preview exited before becoming reachable' : `Vite preview did not become reachable at ${url}`);
}

function attachErrorCapture(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error?.message || String(error)}`));
  return errors;
}

function pageUrl(baseUrl) {
  return `${baseUrl}/desktop.html`;
}

async function waitForMenu(page, faction) {
  await page.locator('.menu-item[data-start-action="new-skirmish"]').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  await page.waitForFunction(({ expectedFaction, expectedScene }) => {
    const scene = document.querySelector('.front-end-scene');
    const sceneContainer = document.querySelector('.menu-scene');
    const root = document.querySelector('#start-screen');
    return scene?.getAttribute('data-art-ready') === 'true'
      && scene.getAttribute('data-faction') === expectedFaction
      && sceneContainer?.getAttribute('data-scene-id') === expectedScene
      && root?.dataset.civ === expectedFaction;
  }, { expectedFaction: faction, expectedScene: SCENES[faction] }, { timeout: TIMEOUT_MS });
}

async function readMenuContract(page, faction, dimension) {
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('700 80px "Pixelify Sans"'),
      document.fonts.load('700 14px "Silkscreen"'),
      document.fonts.load('400 14px "Kode Mono"'),
    ]);
  });
  return page.evaluate(({ expectedFaction, expectedScene, target }) => {
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) !== 0
        && rect.width > 0
        && rect.height > 0;
    };
    const rect = (element) => {
      const box = element.getBoundingClientRect();
      return {
        x: box.x,
        y: box.y,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      };
    };
    const scene = document.querySelector('.front-end-scene');
    const sceneContainer = document.querySelector('.menu-scene');
    const root = document.querySelector('#start-screen');
    const newAction = [...document.querySelectorAll('.menu-item[data-start-action="new-skirmish"]')].filter(visible);
    const primary = [...document.querySelectorAll('.menu-item[data-primary-action="true"]')].filter(visible);
    const menuItems = [...document.querySelectorAll('.menu-item')].filter(visible);
    const profile = document.querySelector('.profile-badge');
    const menuList = document.querySelector('.menu-list');
    const footer = document.querySelector('.start-footer');
    const utilityButtons = [...document.querySelectorAll('.utility-button')].filter(visible);
    const utilityDetails = utilityButtons.map((button) => {
      const tooltipId = button.getAttribute('aria-describedby') || '';
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      const icon = button.querySelector('.utility-icon');
      const iconStyle = icon ? getComputedStyle(icon) : null;
      const buttonRect = rect(button);
      return {
        tagName: button.tagName,
        label: button.getAttribute('aria-label') || '',
        tooltipId,
        tooltipExists: tooltip instanceof HTMLElement && tooltip.getAttribute('role') === 'tooltip',
        tooltipText: tooltip?.textContent?.trim() || '',
        iconMask: iconStyle?.maskImage || iconStyle?.webkitMaskImage || '',
        iconColor: iconStyle?.backgroundColor || '',
        buttonRect,
      };
    });
    const heading = document.querySelector('.start-heading h1');
    const kicker = document.querySelector('.start-kicker');
    const promise = document.querySelector('.start-promise');
    const note = document.querySelector('.start-note');
    const subtitle = document.querySelector('.menu-item small');
    const record = document.querySelector('.profile-badge em');
    const fonts = {
      displayLoaded: document.fonts.check('700 80px "Pixelify Sans"'),
      interfaceLoaded: document.fonts.check('700 14px "Silkscreen"'),
      bodyLoaded: document.fonts.check('400 14px "Kode Mono"'),
      displayUsed: heading ? getComputedStyle(heading).fontFamily : '',
      interfaceUsed: kicker ? getComputedStyle(kicker).fontFamily : '',
      promiseUsed: promise ? getComputedStyle(promise).fontFamily : '',
      noteUsed: note ? getComputedStyle(note).fontFamily : '',
      subtitleUsed: subtitle ? getComputedStyle(subtitle).fontFamily : '',
      recordUsed: record ? getComputedStyle(record).fontFamily : '',
      bodyUsed: root ? getComputedStyle(root).fontFamily : '',
    };
    const controls = [
      profile,
      menuList,
      ...menuItems,
      document.querySelector('.utility-dock'),
      ...utilityButtons,
    ].filter(Boolean).map((element) => ({ className: element.className, rect: rect(element) }));
    const wholePixel = (value) => Number.isInteger(value);
    const integerEdges = controls.every(({ rect: box }) => [box.x, box.y, box.right, box.bottom, box.width, box.height].every(wholePixel));
    return {
      faction: scene?.getAttribute('data-faction') || '',
      scene: sceneContainer?.getAttribute('data-scene-id') || '',
      artReady: scene?.getAttribute('data-art-ready') || '',
      rootCiv: root?.dataset.civ || '',
      primaryCount: primary.length,
      newActionCount: newAction.length,
      menuItemCount: menuItems.length,
      utilityCount: utilityButtons.length,
      utilityDetails,
      profileRect: profile ? rect(profile) : null,
      menuListRect: menuList ? rect(menuList) : null,
      footerRect: footer ? rect(footer) : null,
      footerBottomInset: footer ? window.innerHeight - footer.getBoundingClientRect().bottom : -Infinity,
      menuItemRects: menuItems.map(rect),
      dockRect: rect(document.querySelector('.utility-dock')),
      fonts,
      overflow: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
      },
      integerEdges: target.width === 1366 && target.height === 1024 ? integerEdges : null,
    };
  }, { expectedFaction: faction, expectedScene: SCENES[faction], target: dimension });
}

function assertMenuContract(details, faction, dimension) {
  assertThat(details.artReady === 'true', `${faction} ${dimension.width}x${dimension.height}: authored scene is not ready`);
  assertThat(details.faction === faction, `${faction} ${dimension.width}x${dimension.height}: scene faction is ${details.faction}`);
  assertThat(details.scene === SCENES[faction], `${faction} ${dimension.width}x${dimension.height}: scene is ${details.scene}`);
  assertThat(details.rootCiv === faction, `${faction} ${dimension.width}x${dimension.height}: data-civ is ${details.rootCiv}`);
  assertThat(details.primaryCount === 1 && details.newActionCount === 1, `${faction} ${dimension.width}x${dimension.height}: expected one visible New Skirmish primary action`);
  assertThat(details.utilityCount === 4, `${faction} ${dimension.width}x${dimension.height}: expected four utility buttons, found ${details.utilityCount}`);
  assertThat(details.utilityDetails.every((utility) => utility.tagName === 'BUTTON'), `${faction}: utility control is not a button`);
  assertThat(details.utilityDetails.every((utility) => utility.tooltipId && utility.tooltipExists && utility.tooltipText), `${faction}: utility tooltip relation is incomplete`);
  assertThat(details.utilityDetails.every((utility) => /\.svg/i.test(utility.iconMask) && utility.iconColor !== 'rgba(0, 0, 0, 0)'), `${faction}: an authored SVG icon is not painted`);
  assertThat(details.fonts.displayLoaded && details.fonts.interfaceLoaded && details.fonts.bodyLoaded, `${faction}: one or more local fonts did not load`);
  assertThat(/Pixelify Sans/i.test(details.fonts.displayUsed), `${faction}: display role is not Pixelify Sans`);
  assertThat(/Silkscreen/i.test(details.fonts.interfaceUsed), `${faction}: interface role is not Silkscreen`);
  assertThat(/Silkscreen/i.test(details.fonts.promiseUsed), `${faction}: visible promise is not Silkscreen`);
  assertThat(/Silkscreen/i.test(details.fonts.noteUsed), `${faction}: visible note is not Silkscreen`);
  assertThat(/Silkscreen/i.test(details.fonts.subtitleUsed), `${faction}: visible menu subtitle is not Silkscreen`);
  assertThat(/Silkscreen/i.test(details.fonts.recordUsed), `${faction}: visible profile record copy is not Silkscreen`);
  assertThat(/Kode Mono/i.test(details.fonts.bodyUsed), `${faction}: body role is not Kode Mono`);
  assertThat(details.utilityDetails.every((utility) => utility.buttonRect.width >= 52 && utility.buttonRect.height >= 52), `${faction}: dock touch target is below 52x52`);
  assertThat(details.menuItemRects.every((box) => box.width >= 420 && box.width <= 470 && box.height >= 52), `${faction}: menu target geometry is outside the frozen range`);
  assertThat(details.profileRect?.width === 448 && details.profileRect?.height === 64, `${faction}: profile card is not 448x64 (${JSON.stringify(details.profileRect)})`);
  assertThat(details.menuListRect?.width === 448, `${faction}: menu width is not 448 (${JSON.stringify(details.menuListRect)})`);
  assertThat(details.footerBottomInset >= 24, `${faction} ${dimension.width}x${dimension.height}: visible footer bottom inset is below 24px (${details.footerBottomInset})`);
  assertThat(details.overflow.documentWidth <= details.overflow.viewportWidth, `${faction} ${dimension.width}x${dimension.height}: horizontal document overflow`);
  assertThat(details.overflow.documentHeight <= details.overflow.viewportHeight, `${faction} ${dimension.width}x${dimension.height}: vertical document overflow`);
  if (details.integerEdges !== null) assertThat(details.integerEdges, `${faction}: a 1366x1024 shell edge is fractional`);
}

async function waitForTooltip(page, selector) {
  await page.waitForFunction((targetSelector) => {
    const button = document.querySelector(targetSelector);
    const id = button?.getAttribute('aria-describedby') || '';
    const tooltip = id ? document.getElementById(id) : null;
    if (!(tooltip instanceof HTMLElement)) return false;
    const style = getComputedStyle(tooltip);
    const box = tooltip.getBoundingClientRect();
    return style.visibility === 'visible' && Number(style.opacity) > 0 && box.width > 0 && box.height > 0;
  }, selector, { timeout: TIMEOUT_MS });
}

async function exerciseTooltipAndFocus(page, output, faction, dimension, manifest) {
  const selector = '.utility-button[data-start-action="records"]';
  const button = page.locator(selector);
  await button.hover();
  await waitForTooltip(page, selector);
  await page.keyboard.press('Tab');
  await button.focus();
  await waitForTooltip(page, selector);
  const focused = await page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) return null;
    const style = getComputedStyle(element);
    const tooltipId = element.getAttribute('aria-describedby') || '';
    const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
    const marker = document.querySelector('.menu-item:focus-visible .pixel-selection-marker');
    return {
      activeClass: element.className,
      outlineWidth: style.outlineWidth,
      outlineStyle: style.outlineStyle,
      tooltipVisible: tooltip instanceof HTMLElement && getComputedStyle(tooltip).visibility === 'visible',
      menuMarkerVisible: marker instanceof HTMLElement && getComputedStyle(marker).opacity !== '0',
    };
  });
  assertThat(focused?.activeClass.includes('utility-button'), `${faction}: keyboard focus did not reach the utility button`);
  assertThat(focused.outlineWidth === '2px' && focused.outlineStyle !== 'none', `${faction}: utility focus is not visibly outlined`);
  assertThat(focused.tooltipVisible, `${faction}: tooltip is not visible after keyboard focus`);
  const file = path.join(output, `focused-tooltip-${faction}-${dimension.width}x${dimension.height}.png`);
  await page.screenshot({ path: file, type: 'png' });
  manifest.captures.push(path.basename(file));
}

async function surfaceContract(page, selector) {
  return page.evaluate((surfaceSelector) => {
    const surface = document.querySelector(surfaceSelector);
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) !== 0
        && box.width > 0
        && box.height > 0;
    };
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    if (!(surface instanceof HTMLElement)) return null;
    const controls = [...surface.querySelectorAll('button, input')].filter(visible).map((element) => ({
      tagName: element.tagName,
      className: element.className,
      rect: box(element),
    }));
    const clipped = controls.filter(({ rect }) => rect.x < 0 || rect.y < 0 || rect.right > window.innerWidth || rect.bottom > window.innerHeight);
    const surfaceRect = box(surface);
    return {
      surfaceRect,
      controls,
      clipped,
      overflow: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
      },
    };
  }, selector);
}

function assertSurfaceContract(details, label, { minimumInset = 0 } = {}) {
  assertThat(details, `${label}: surface is missing`);
  assertThat(details.clipped.length === 0, `${label}: visible control is clipped (${JSON.stringify(details.clipped)})`);
  assertThat(details.controls.every(({ rect }) => rect.width >= 44 && rect.height >= 44), `${label}: a visible control is below 44x44 CSS pixels`);
  assertThat(details.overflow.documentWidth <= details.overflow.viewportWidth, `${label}: horizontal document overflow`);
  assertThat(details.overflow.documentHeight <= details.overflow.viewportHeight, `${label}: vertical document overflow`);
  if (minimumInset > 0) {
    const { surfaceRect } = details;
    assertThat(surfaceRect.x >= minimumInset && surfaceRect.y >= minimumInset, `${label}: surface starts inside the ${minimumInset}px safe inset`);
    assertThat(surfaceRect.right <= details.overflow.viewportWidth - minimumInset && surfaceRect.bottom <= details.overflow.viewportHeight - minimumInset, `${label}: surface exceeds the ${minimumInset}px safe inset`);
  }
}

async function openAndClosePanel(page, selector, label, { capturePath = null } = {}) {
  const opener = page.locator(selector);
  const openerHandle = await opener.elementHandle();
  await opener.click();
  const panel = page.locator('.start-panel');
  await panel.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  await page.waitForTimeout(160);
  const close = panel.locator('.panel-close');
  await close.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  assertThat(await close.getAttribute('aria-label') === 'Close', `${label}: Close button has no exact aria-label`);
  const details = await surfaceContract(page, '.panel-card');
  assertSurfaceContract(details, label, { minimumInset: 24 });
  if (capturePath) await page.screenshot({ path: capturePath, type: 'png' });

  const focusables = panel.locator('.panel-card button:not(:disabled), .panel-card input:not(:disabled), .panel-card select:not(:disabled), .panel-card textarea:not(:disabled), .panel-card [href], .panel-card [tabindex]:not([tabindex="-1"])');
  const focusableCount = await focusables.count();
  assertThat(focusableCount > 0, `${label}: no focusable control exists inside panel`);
  await page.evaluate(() => document.querySelector('.panel-close')?.focus());
  await page.keyboard.press('Tab');
  assertThat(await page.evaluate(() => document.querySelector('.panel-card')?.contains(document.activeElement)), `${label}: Tab escaped the panel`);
  await page.evaluate(() => {
    const elements = [...document.querySelectorAll('.panel-card button:not(:disabled), .panel-card input:not(:disabled), .panel-card select:not(:disabled), .panel-card textarea:not(:disabled), .panel-card [href], .panel-card [tabindex]:not([tabindex="-1"])')];
    elements.at(-1)?.focus();
  });
  await page.keyboard.press('Tab');
  const forwardWrapped = await page.evaluate(() => document.activeElement === document.querySelector('.panel-card button:not(:disabled), .panel-card input:not(:disabled), .panel-card select:not(:disabled), .panel-card textarea:not(:disabled), .panel-card [href], .panel-card [tabindex]:not([tabindex="-1"])'));
  assertThat(forwardWrapped, `${label}: Tab did not wrap from the last panel control`);
  await page.keyboard.press('Shift+Tab');
  const backwardWrapped = await page.evaluate(() => {
    const elements = [...document.querySelectorAll('.panel-card button:not(:disabled), .panel-card input:not(:disabled), .panel-card select:not(:disabled), .panel-card textarea:not(:disabled), .panel-card [href], .panel-card [tabindex]:not([tabindex="-1"])')];
    return document.activeElement === elements.at(-1);
  });
  assertThat(backwardWrapped, `${label}: Shift+Tab did not wrap from the first panel control`);
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden', timeout: TIMEOUT_MS });
  const restored = await page.evaluate((element) => document.activeElement === element, openerHandle);
  assertThat(restored, `${label}: Escape did not restore focus to the exact opener`);
  await openerHandle?.dispose();
}

async function readSetupContract(page) {
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('700 32px "Pixelify Sans"'),
      document.fonts.load('700 14px "Silkscreen"'),
      document.fonts.load('400 14px "Kode Mono"'),
    ]);
  });
  return page.evaluate(() => {
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) !== 0
        && rect.width > 0
        && rect.height > 0;
    };
    const rect = (element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    const setup = document.querySelector('.setup-view');
    const heading = document.querySelector('.setup-heading');
    const cards = [...document.querySelectorAll('.setup-card')].filter(visible);
    const selected = {};
    for (const button of document.querySelectorAll('[data-config-field].selected')) {
      const field = button.getAttribute('data-config-field');
      if (field) selected[field] = button.getAttribute('data-config-value') || '';
    }
    const controls = [...(setup?.querySelectorAll('button, input') || [])].filter(visible);
    const controlRects = controls.map((element) => ({
      tagName: element.tagName,
      className: element.className,
      rect: rect(element),
    }));
    const clipped = controlRects.filter(({ rect: box }) => box.x < 0 || box.y < 0 || box.right > window.innerWidth || box.bottom > window.innerHeight);
    const seedRow = document.querySelector('[data-seed-row]');
    const seedInput = document.querySelector('[data-seed-input]');
    const start = document.querySelector('[data-start-action="start-match"]');
    const back = document.querySelector('[data-start-action="back"]');
    const headingTitle = document.querySelector('.setup-heading h2');
    const label = document.querySelector('.setup-field legend');
    const status = document.querySelector('.setup-status');
    const explanation = document.querySelector('.faction-summary p');
    return {
      setupVisible: visible(setup),
      setupRect: setup ? rect(setup) : null,
      headingRect: heading ? rect(heading) : null,
      cards: cards.map(rect),
      selected,
      controls: controlRects,
      clipped,
      seedVisible: visible(seedRow),
      seedValue: seedInput?.value || '',
      seedInvalid: seedInput?.getAttribute('aria-invalid') || '',
      startDisabled: start instanceof HTMLButtonElement ? start.disabled : true,
      startRect: start ? rect(start) : null,
      backRect: back ? rect(back) : null,
      fonts: {
        displayLoaded: document.fonts.check('700 32px "Pixelify Sans"'),
        interfaceLoaded: document.fonts.check('700 14px "Silkscreen"'),
        bodyLoaded: document.fonts.check('400 14px "Kode Mono"'),
        displayUsed: headingTitle ? getComputedStyle(headingTitle).fontFamily : '',
        interfaceUsed: label ? getComputedStyle(label).fontFamily : '',
        statusUsed: status ? getComputedStyle(status).fontFamily : '',
        bodyUsed: explanation ? getComputedStyle(explanation).fontFamily : '',
        inputUsed: seedInput ? getComputedStyle(seedInput).fontFamily : '',
      },
      config: globalThis.__STARHAVEN_QA__?.config || null,
      overflow: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
      },
    };
  });
}

function assertSetupContract(details, faction, dimension) {
  const rival = faction === 'sunweaver' ? 'gravemark' : 'sunweaver';
  assertThat(details.setupVisible, `${faction} ${dimension.width}x${dimension.height}: setup view is not visible`);
  assertThat(details.cards.length === 2, `${faction} ${dimension.width}x${dimension.height}: expected two framed setup sections`);
  assertThat(details.selected.playerFaction === faction, `${faction}: player faction selection is ${details.selected.playerFaction}`);
  assertThat(details.selected.aiFaction === rival, `${faction}: AI faction selection is ${details.selected.aiFaction}`);
  assertThat(details.selected.difficulty === 'standard', `${faction}: default difficulty selection is ${details.selected.difficulty}`);
  assertThat(details.selected.fogOfWar === 'true', `${faction}: default fog selection is ${details.selected.fogOfWar}`);
  assertThat(details.selected.speed === '1', `${faction}: default speed selection is ${details.selected.speed}`);
  assertThat(details.selected.tacticalPause === 'enabled', `${faction}: default tactical pause selection is ${details.selected.tacticalPause}`);
  assertThat(details.selected.seedMode === 'random', `${faction}: default seed mode selection is ${details.selected.seedMode}`);
  assertThat(!details.seedVisible && !details.startDisabled, `${faction}: random-seed setup does not start in a valid state`);
  assertThat(details.clipped.length === 0, `${faction} ${dimension.width}x${dimension.height}: setup control is clipped (${JSON.stringify(details.clipped)})`);
  assertThat(details.controls.every(({ rect }) => rect.width >= 44 && rect.height >= 44), `${faction}: setup control is below 44x44 CSS pixels`);
  assertThat(details.overflow.documentWidth <= details.overflow.viewportWidth, `${faction} ${dimension.width}x${dimension.height}: setup horizontal overflow`);
  assertThat(details.overflow.documentHeight <= details.overflow.viewportHeight, `${faction} ${dimension.width}x${dimension.height}: setup vertical overflow`);
  assertThat(details.headingRect.x >= 32 && details.headingRect.right <= dimension.width - 32, `${faction}: setup header misses the 32px horizontal safe area`);
  assertThat(details.fonts.displayLoaded && details.fonts.interfaceLoaded && details.fonts.bodyLoaded, `${faction}: setup local fonts did not load`);
  assertThat(/Pixelify Sans/i.test(details.fonts.displayUsed), `${faction}: setup heading is not Pixelify Sans`);
  assertThat(/Silkscreen/i.test(details.fonts.interfaceUsed) && /Silkscreen/i.test(details.fonts.statusUsed), `${faction}: setup labels/status are not Silkscreen`);
  assertThat(/Kode Mono/i.test(details.fonts.bodyUsed) && /Kode Mono/i.test(details.fonts.inputUsed), `${faction}: setup explanations/input are not Kode Mono`);
}

async function exerciseSetupInteractions(page, faction) {
  const rival = faction === 'sunweaver' ? 'gravemark' : 'sunweaver';
  const clickSegment = async (field, value) => {
    await page.locator(`[data-config-field="${field}"][data-config-value="${value}"]`).click();
    await page.waitForFunction(({ expectedField, expectedValue }) => {
      const selected = document.querySelector(`[data-config-field="${expectedField}"][data-config-value="${expectedValue}"].selected`);
      return Boolean(selected);
    }, { expectedField: field, expectedValue: value }, { timeout: TIMEOUT_MS });
  };

  await clickSegment('difficulty', 'veteran');
  await clickSegment('fogOfWar', 'false');
  await clickSegment('speed', '1.25');
  await clickSegment('tacticalPause', 'on-demand');

  await page.locator(`[data-config-field="aiFaction"][data-config-value="${faction}"]`).click();
  await page.waitForFunction(({ expectedPlayer, expectedAi }) => {
    const config = globalThis.__STARHAVEN_QA__?.config;
    return config?.playerFaction === expectedPlayer && config?.aiFaction === expectedAi;
  }, { expectedPlayer: rival, expectedAi: faction }, { timeout: TIMEOUT_MS });
  const mirrorAnnouncement = await page.locator('.setup-live').textContent();
  assertThat(/Player civilization changed to/i.test(mirrorAnnouncement || ''), 'mirror-swap announcement is missing');

  await clickSegment('seedMode', 'deterministic');
  const seedRow = page.locator('[data-seed-row]');
  await seedRow.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  const seedInput = page.locator('[data-seed-input]');
  await seedInput.fill('-1');
  await page.waitForFunction(() => {
    const input = document.querySelector('[data-seed-input]');
    const start = document.querySelector('[data-start-action="start-match"]');
    return input?.getAttribute('aria-invalid') === 'true'
      && start instanceof HTMLButtonElement
      && start.disabled;
  }, undefined, { timeout: TIMEOUT_MS });
  assertThat(/unsigned 32-bit|cannot be negative|cannot exceed/i.test((await page.locator('.setup-status').textContent()) || ''), 'invalid seed copy is missing');

  await seedInput.fill('424242');
  await page.waitForFunction(() => {
    const input = document.querySelector('[data-seed-input]');
    const start = document.querySelector('[data-start-action="start-match"]');
    return input?.getAttribute('aria-invalid') === 'false'
      && input?.getAttribute('value') === null
      && (input instanceof HTMLInputElement && input.value === '424242')
      && start instanceof HTMLButtonElement
      && !start.disabled
      && globalThis.__STARHAVEN_QA__?.config?.seed === 424242;
  }, undefined, { timeout: TIMEOUT_MS });
  assertThat(await seedInput.inputValue() === '424242', 'valid deterministic seed was not retained');
  assertThat(await page.locator('[data-config-field="seedMode"][data-config-value="deterministic"]').getAttribute('aria-pressed') === 'true', 'deterministic seed mode is not selected');
}

async function runSetupCase(browser, baseUrl, output, faction, dimension, manifest) {
  const context = await browser.newContext({ viewport: dimension, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: DEFAULT_PROFILE_KEY, value: profileValue(faction) });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = attachErrorCapture(page);
  try {
    await page.goto(pageUrl(baseUrl), { waitUntil: 'load', timeout: TIMEOUT_MS });
    await waitForMenu(page, faction);
    await page.locator('.menu-item[data-start-action="new-skirmish"]').click();
    await page.locator('.setup-view').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    const details = await readSetupContract(page);
    assertSetupContract(details, faction, dimension);
    const file = path.join(output, `setup-${faction}-${dimension.width}x${dimension.height}.png`);
    await page.screenshot({ path: file, type: 'png' });
    manifest.captures.push(path.basename(file));
    await exerciseSetupInteractions(page, faction);
    const interacted = await readSetupContract(page);
    assertThat(interacted.seedVisible && interacted.seedValue === '424242' && !interacted.startDisabled, `${faction}: deterministic seed interaction did not finish valid`);
    await page.locator('.secondary-action[data-start-action="back"]').click();
    await page.locator('.menu-view').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    assertThat(errors.length === 0, `${faction} ${dimension.width}x${dimension.height}: setup browser errors\n${errors.join('\n')}`);
    manifest.assertions.push({ name: `match setup ${faction} ${dimension.width}x${dimension.height}`, status: 'PASS', details: { initial: details, interacted } });
  } catch (error) {
    manifest.assertions.push({ name: `match setup ${faction} ${dimension.width}x${dimension.height}`, status: 'FAIL', error: error?.message || String(error) });
    manifest.errors.push(error?.stack || error?.message || String(error));
  } finally {
    if (errors.length > 0) manifest.errors.push(...errors.map((error) => `browser: ${error}`));
    await context.close();
  }
}

async function runPanelEvidence(browser, baseUrl, output, manifest) {
  const dimension = { width: 1366, height: 1024 };
  const context = await browser.newContext({ viewport: dimension, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: DEFAULT_PROFILE_KEY, value: profileValue('sunweaver') });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = attachErrorCapture(page);
  try {
    await page.goto(pageUrl(baseUrl), { waitUntil: 'load', timeout: TIMEOUT_MS });
    await waitForMenu(page, 'sunweaver');
    for (const action of PANEL_ACTIONS) {
      const selector = action === 'tutorial' || action === 'factions' || action === 'settings'
        ? `.menu-item[data-start-action="${action}"]`
        : `.utility-button[data-start-action="${action}"]`;
      const file = path.join(output, `panel-${action}-1366x1024.png`);
      await openAndClosePanel(page, selector, `${action} evidence`, { capturePath: file });
      manifest.captures.push(path.basename(file));
    }
    await page.setViewportSize({ width: 1180, height: 820 });
    await waitForMenu(page, 'sunweaver');
    const smallFile = path.join(output, 'panel-records-1180x820.png');
    await openAndClosePanel(page, '.utility-button[data-start-action="records"]', 'records 1180x820 evidence', { capturePath: smallFile });
    manifest.captures.push(path.basename(smallFile));
    assertThat(errors.length === 0, `panel evidence browser errors\n${errors.join('\n')}`);
    manifest.assertions.push({ name: 'all seven panels have evidence, focus containment, Escape close, and no clipping', status: 'PASS', details: { panels: PANEL_ACTIONS, smallViewport: 'records' } });
  } catch (error) {
    manifest.assertions.push({ name: 'all seven panels have evidence, focus containment, Escape close, and no clipping', status: 'FAIL', error: error?.message || String(error) });
    manifest.errors.push(error?.stack || error?.message || String(error));
  } finally {
    if (errors.length > 0) manifest.errors.push(...errors.map((error) => `browser: ${error}`));
    await context.close();
  }
}

async function runTouchContract(browser, baseUrl, manifest) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 1, hasTouch: true });
  await context.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: DEFAULT_PROFILE_KEY, value: profileValue('sunweaver') });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = attachErrorCapture(page);
  try {
    await page.goto(pageUrl(baseUrl), { waitUntil: 'load', timeout: TIMEOUT_MS });
    await waitForMenu(page, 'sunweaver');
    await page.tap('.menu-item[data-start-action="tutorial"]');
    await page.locator('.start-panel').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    await page.tap('.panel-close');
    await page.locator('.start-panel').waitFor({ state: 'hidden', timeout: TIMEOUT_MS });
    await page.tap('.menu-item[data-start-action="new-skirmish"]');
    await page.locator('.setup-view').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    await page.tap('[data-config-field="difficulty"][data-config-value="cadet"]');
    await page.waitForFunction(() => Boolean(document.querySelector('[data-config-field="difficulty"][data-config-value="cadet"].selected')), undefined, { timeout: TIMEOUT_MS });
    await page.tap('.secondary-action[data-start-action="back"]');
    await page.locator('.menu-view').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    assertThat(errors.length === 0, `touch contract browser errors\n${errors.join('\n')}`);
    manifest.assertions.push({ name: 'touch context taps panel opener, setup segment, and close control', status: 'PASS' });
  } catch (error) {
    manifest.assertions.push({ name: 'touch context taps panel opener, setup segment, and close control', status: 'FAIL', error: error?.message || String(error) });
    manifest.errors.push(error?.stack || error?.message || String(error));
  } finally {
    if (errors.length > 0) manifest.errors.push(...errors.map((error) => `browser: ${error}`));
    await context.close();
  }
}

async function runReducedMotionContract(browser, baseUrl, output, manifest) {
  const dimension = { width: 1366, height: 1024 };
  const context = await browser.newContext({ viewport: dimension, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await context.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: DEFAULT_PROFILE_KEY, value: profileValue('sunweaver') });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = attachErrorCapture(page);
  try {
    await page.goto(pageUrl(baseUrl), { waitUntil: 'load', timeout: TIMEOUT_MS });
    await waitForMenu(page, 'sunweaver');
    await page.locator('.utility-button[data-start-action="records"]').click();
    await page.locator('.start-panel').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    const motion = await page.evaluate(() => {
      const panel = document.querySelector('.panel-card');
      const style = panel ? getComputedStyle(panel) : null;
      return {
        mediaMatches: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        animationName: style?.animationName || '',
        animationDuration: style?.animationDuration || '',
        transitionDuration: style?.transitionDuration || '',
      };
    });
    assertThat(motion.mediaMatches, 'Reduced Motion media query was not active');
    assertThat(motion.animationName === 'none' && motion.animationDuration === '0s', `decorative panel animation remains under Reduced Motion (${JSON.stringify(motion)})`);
    const file = path.join(output, 'panel-reduced-motion-1366x1024.png');
    await page.screenshot({ path: file, type: 'png' });
    manifest.captures.push(path.basename(file));
    await page.keyboard.press('Escape');
    await page.locator('.start-panel').waitFor({ state: 'hidden', timeout: TIMEOUT_MS });
    await page.locator('.menu-item[data-start-action="factions"]').click();
    await page.locator('.faction-choice[data-faction-choice="gravemark"]').click();
    await page.waitForFunction(() => document.querySelector('#start-screen')?.dataset.civ === 'gravemark'
      && document.querySelector('.front-end-scene')?.getAttribute('data-faction') === 'gravemark', undefined, { timeout: TIMEOUT_MS });
    await page.keyboard.press('Escape');
    await page.locator('.start-panel').waitFor({ state: 'hidden', timeout: TIMEOUT_MS });
    assertThat(errors.length === 0, `Reduced Motion browser errors\n${errors.join('\n')}`);
    manifest.assertions.push({ name: 'Reduced Motion removes panel animation while preserving faction state changes', status: 'PASS', details: motion });
  } catch (error) {
    manifest.assertions.push({ name: 'Reduced Motion removes panel animation while preserving faction state changes', status: 'FAIL', error: error?.message || String(error) });
    manifest.errors.push(error?.stack || error?.message || String(error));
  } finally {
    if (errors.length > 0) manifest.errors.push(...errors.map((error) => `browser: ${error}`));
    await context.close();
  }
}

async function exerciseControls(page) {
  for (const action of ['tutorial', 'factions', 'settings']) {
    await openAndClosePanel(page, `.menu-item[data-start-action="${action}"]`, action);
  }
  for (const action of ['records', 'history', 'codex', 'dispatches']) {
    await openAndClosePanel(page, `.utility-button[data-start-action="${action}"]`, action);
  }
  await page.locator('.menu-item[data-start-action="new-skirmish"]').click();
  await page.locator('.setup-view').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  assertThat(await page.locator('.menu-view').isHidden(), 'New Skirmish left the Main Menu visible');
  await page.locator('.secondary-action[data-start-action="back"]').click();
  await page.locator('.menu-view').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
}

async function exerciseFactionChoice(page, faction) {
  const rival = faction === 'sunweaver' ? 'gravemark' : 'sunweaver';
  await page.locator('.menu-item[data-start-action="factions"]').click();
  await page.locator(`.faction-choice[data-faction-choice="${rival}"]`).click();
  await page.waitForFunction((expected) => document.querySelector('#start-screen')?.dataset.civ === expected, rival, { timeout: TIMEOUT_MS });
  await page.locator('.panel-close').click();
  await page.locator('.start-panel').waitFor({ state: 'hidden', timeout: TIMEOUT_MS });
  await page.waitForFunction((expected) => document.querySelector('.front-end-scene')?.getAttribute('data-faction') === expected, rival, { timeout: TIMEOUT_MS });
  const stored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), DEFAULT_PROFILE_KEY);
  assertThat(stored.preferredFaction === rival, `Factions: preferred faction ${rival} did not persist after close`);
}

async function runMenuCase(browser, baseUrl, output, faction, dimension, manifest) {
  const context = await browser.newContext({ viewport: dimension, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, value }) => {
    if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: DEFAULT_PROFILE_KEY, value: profileValue(faction) });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = attachErrorCapture(page);
  try {
    await page.goto(pageUrl(baseUrl), { waitUntil: 'load', timeout: TIMEOUT_MS });
    await waitForMenu(page, faction);
    const details = await readMenuContract(page, faction, dimension);
    assertMenuContract(details, faction, dimension);
    manifest.assertions.push({ name: `menu contract ${faction} ${dimension.width}x${dimension.height}`, status: 'PASS', details });
    const file = path.join(output, `menu-${faction}-${dimension.width}x${dimension.height}.png`);
    await page.screenshot({ path: file, type: 'png' });
    manifest.captures.push(path.basename(file));

    if (dimension.width === 1920 && dimension.height === 1080) {
      await exerciseTooltipAndFocus(page, output, faction, dimension, manifest);
    }
    await exerciseControls(page);
    if (dimension.width === 1366 && dimension.height === 1024) await exerciseFactionChoice(page, faction);
    assertThat(errors.length === 0, `${faction} ${dimension.width}x${dimension.height}: browser errors\n${errors.join('\n')}`);
    manifest.assertions.push({ name: `interactions ${faction} ${dimension.width}x${dimension.height}`, status: 'PASS' });
  } catch (error) {
    manifest.assertions.push({
      name: `menu case ${faction} ${dimension.width}x${dimension.height}`,
      status: 'FAIL',
      error: error?.message || String(error),
    });
    manifest.errors.push(error?.stack || error?.message || String(error));
  } finally {
    if (errors.length > 0) manifest.errors.push(...errors.map((error) => `browser: ${error}`));
    await context.close();
  }
}

async function runDispatchPersistence(browser, baseUrl, output, manifest) {
  const faction = 'sunweaver';
  const dimension = { width: 1366, height: 1024 };
  const context = await browser.newContext({ viewport: dimension, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, value }) => {
    if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: DEFAULT_PROFILE_KEY, value: profileValue(faction) });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = attachErrorCapture(page);
  try {
    await page.goto(pageUrl(baseUrl), { waitUntil: 'load', timeout: TIMEOUT_MS });
    await waitForMenu(page, faction);
    const badge = page.locator('[data-dispatch-badge]');
    assertThat(await badge.isVisible(), 'Dispatches badge is not visible on a fresh profile');
    await page.locator('.utility-button[data-start-action="dispatches"]').click();
    await page.locator('.start-panel').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    await page.waitForFunction(() => {
      const badgeElement = document.querySelector('[data-dispatch-badge]');
      return badgeElement instanceof HTMLElement && getComputedStyle(badgeElement).display === 'none';
    }, undefined, { timeout: TIMEOUT_MS });
    await page.locator('.panel-close').click();
    await page.locator('.start-panel').waitFor({ state: 'hidden', timeout: TIMEOUT_MS });
    await page.reload({ waitUntil: 'load', timeout: TIMEOUT_MS });
    await waitForMenu(page, faction);
    assertThat(!(await badge.isVisible()), 'Dispatches badge returned after profile reload');
    const stored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), DEFAULT_PROFILE_KEY);
    assertThat(stored.lastSeenDispatchVersion === 1, `Dispatches profile path stored version ${stored.lastSeenDispatchVersion}`);
    assertThat(errors.length === 0, `Dispatch persistence browser errors\n${errors.join('\n')}`);
    manifest.assertions.push({ name: 'Dispatches badge clears and persists through profile storage', status: 'PASS', details: { lastSeenDispatchVersion: stored.lastSeenDispatchVersion } });
  } catch (error) {
    manifest.assertions.push({ name: 'Dispatches badge clears and persists through profile storage', status: 'FAIL', error: error?.message || String(error) });
    manifest.errors.push(error?.stack || error?.message || String(error));
  } finally {
    if (errors.length > 0) manifest.errors.push(...errors.map((error) => `browser: ${error}`));
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
    console.error(`qa-pixel-front-end: ${error?.message || String(error)}`);
    process.exitCode = 1;
    return;
  }

  const manifest = {
    tool: 'qa-pixel-front-end',
    url: normalizeUrl(args.url),
    dimensions: DIMENSIONS,
    factions: FACTIONS,
    assertions: [],
    captures: [],
    errors: [],
    status: 'FAIL',
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  let browser;
  let preview;
  try {
    preview = args.url ? null : await startPreview();
    const baseUrl = normalizeUrl(args.url || preview.url);
    manifest.url = baseUrl;
    browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
    for (const faction of FACTIONS) {
      for (const dimension of DIMENSIONS) {
        await runMenuCase(browser, baseUrl, output, faction, dimension, manifest);
      }
    }
    for (const faction of FACTIONS) {
      for (const dimension of DIMENSIONS) {
        await runSetupCase(browser, baseUrl, output, faction, dimension, manifest);
      }
    }
    await runPanelEvidence(browser, baseUrl, output, manifest);
    await runTouchContract(browser, baseUrl, manifest);
    await runReducedMotionContract(browser, baseUrl, output, manifest);
    await runDispatchPersistence(browser, baseUrl, output, manifest);
  } catch (error) {
    manifest.errors.push(error?.stack || error?.message || String(error));
  } finally {
    await browser?.close();
    await stopPreview(preview);
    manifest.finishedAt = new Date().toISOString();
    manifest.status = manifest.errors.length === 0
      && manifest.assertions.length > 0
      && manifest.assertions.every((assertion) => assertion.status === 'PASS')
      ? 'PASS'
      : 'FAIL';
    fs.writeFileSync(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }
  console.log(`qa-pixel-front-end: ${manifest.status}`);
  console.log(`qa-pixel-front-end: manifest ${path.join(output, 'manifest.json')}`);
  if (manifest.status !== 'PASS') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
