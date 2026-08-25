#!/usr/bin/env node
/**
 * Browser proof for the responsive FPE-2/FPE-3/FPE-4/FPE-5 pixel shell.
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
const ORIENTATIONS = ['landscape-left', 'landscape-right'];
const FACTIONS = ['sunweaver', 'gravemark'];
const SCENES = {
  sunweaver: 'sunweaver-capital',
  gravemark: 'gravemark-quarry',
};
const LOADING_SEGMENT_COUNT = 16;
const LOADING_CONFIG = {
  map: 'helios-rift',
  difficulty: 'veteran',
  fogOfWar: false,
  speed: 1.25,
  tacticalPause: 'on-demand',
  seedMode: 'deterministic',
  seed: 424242,
};
const PANEL_ACTIONS = ['tutorial', 'factions', 'settings', 'records', 'history', 'codex', 'dispatches'];
const PANEL_ACCENT_HEIGHTS = {
  tutorial: 1,
  factions: 1,
  settings: 1,
  history: 1,
  records: 2,
  codex: 2,
  dispatches: 2,
};
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
  page.on('requestfailed', (request) => errors.push(`requestfailed: ${request.url()} — ${request.failure()?.errorText || 'unknown'}`));
  page.on('response', (response) => {
    if (response.status() < 400) return;
    const url = response.url();
    if (/front-end-ui|front-end\/civilizations|manifest\.json|\.woff2(?:\?|$)|\.(?:svg|webp|png)(?:\?|$)/i.test(url)) {
      errors.push(`asset response ${response.status()}: ${url}`);
    }
  });
  return errors;
}

function pageUrl(baseUrl, { page = 'desktop.html', orientation = 'landscape-left', holdLoading = false } = {}) {
  const query = new URLSearchParams({ orientation });
  if (holdLoading) query.set('qa-hold-loading', '1');
  return `${baseUrl}/${page}?${query.toString()}`;
}

function orientationSuffix(orientation) {
  return orientation === 'landscape-right' ? '-landscape-right' : '';
}

async function waitForMenu(page, faction, orientation = 'landscape-left') {
  await page.locator('.menu-item[data-start-action="new-skirmish"]').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  await page.waitForFunction(({ expectedFaction, expectedScene, expectedOrientation }) => {
    const scene = document.querySelector('.front-end-scene');
    const sceneContainer = document.querySelector('.menu-scene');
    const root = document.querySelector('#start-screen');
    return scene?.getAttribute('data-art-ready') === 'true'
      && scene.getAttribute('data-faction') === expectedFaction
      && sceneContainer?.getAttribute('data-scene-id') === expectedScene
      && root?.dataset.civ === expectedFaction
      && document.documentElement.dataset.orientation === expectedOrientation;
  }, { expectedFaction: faction, expectedScene: SCENES[faction], expectedOrientation: orientation }, { timeout: TIMEOUT_MS });
}

function loadingConfig(faction) {
  return {
    playerFaction: faction,
    aiFaction: faction === 'sunweaver' ? 'gravemark' : 'sunweaver',
    ...LOADING_CONFIG,
  };
}

async function configureLoading(page, faction) {
  const config = loadingConfig(faction);
  await page.locator(`[data-config-field="playerFaction"][data-config-value="${config.playerFaction}"]`).click();
  await page.locator(`[data-config-field="aiFaction"][data-config-value="${config.aiFaction}"]`).click();
  await page.locator(`[data-config-field="difficulty"][data-config-value="${config.difficulty}"]`).click();
  await page.locator(`[data-config-field="fogOfWar"][data-config-value="${config.fogOfWar}"]`).click();
  await page.locator(`[data-config-field="speed"][data-config-value="${config.speed}"]`).click();
  await page.locator(`[data-config-field="tacticalPause"][data-config-value="${config.tacticalPause}"]`).click();
  await page.locator('[data-config-field="seedMode"][data-config-value="deterministic"]').click();
  await page.locator('[data-seed-input]').fill(String(config.seed));
  await page.waitForFunction((expected) => {
    const actual = globalThis.__STARHAVEN_QA__?.config;
    return actual && Object.keys(expected).every((key) => actual[key] === expected[key]);
  }, config, { timeout: TIMEOUT_MS });
}

async function readLoadingContract(page, faction, dimension, orientation) {
  return page.evaluate(({ expectedFaction, expectedScene, target, expectedConfig, segmentCount, expectedOrientation }) => {
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
    const root = document.querySelector('.front-loading-screen');
    const card = document.querySelector('.front-loading-card');
    const track = document.querySelector('[data-loading-segments]');
    const scene = root?.querySelector('.front-end-scene');
    const sceneContainer = root;
    const segments = [...(root?.querySelectorAll('.front-loading-segment') || [])];
    const segmentDetails = segments.map((segment) => ({
      state: segment.getAttribute('data-state') || '',
      visible: visible(segment),
      rect: rect(segment),
    }));
    const integerRect = (box) => box && [box.x, box.y, box.right, box.bottom, box.width, box.height].every(Number.isInteger);
    const stageHistory = (root?.getAttribute('data-loading-stage-history') || '').split(',').filter(Boolean);
    const meta = document.querySelector('[data-loading-meta]');
    const heading = document.querySelector('.front-loading-card h1');
    const kicker = document.querySelector('.front-loading-kicker');
    const tip = document.querySelector('.front-loading-tip');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const activeSegment = root?.querySelector('.front-loading-segment[data-state="active"]');
    const activeStyle = activeSegment ? getComputedStyle(activeSegment) : null;
    const cardRect = card ? rect(card) : null;
    const trackRect = track ? rect(track) : null;
    return {
      visible: visible(root),
      civ: root?.getAttribute('data-civ') || '',
      scene: scene?.getAttribute('data-scene') || '',
      faction: scene?.getAttribute('data-faction') || '',
      mode: scene?.getAttribute('data-mode') || '',
      artReady: scene?.getAttribute('data-art-ready') || '',
      sceneId: sceneContainer?.getAttribute('data-scene-id') || '',
      screenCreated: root?.getAttribute('data-loading-screen-created') || '',
      sceneReady: root?.getAttribute('data-loading-scene-ready') || '',
      matchReady: root?.getAttribute('data-loading-match-ready') || '',
      stage: root?.getAttribute('data-loading-stage') || '',
      stageHistory,
      segmentCount: segments.length,
      visibleSegmentCount: segmentDetails.filter((segment) => segment.visible).length,
      states: segmentDetails.reduce((counts, segment) => {
        counts[segment.state] = (counts[segment.state] || 0) + 1;
        return counts;
      }, {}),
      segmentRects: segmentDetails.map((segment) => segment.rect),
      segmentRectsInteger: segmentDetails.every((segment) => integerRect(segment.rect)),
      cardRect,
      trackRect,
      bottomSafeGap: cardRect ? window.innerHeight - cardRect.bottom : -Infinity,
      horizontalSafe: cardRect ? cardRect.x >= 24 && cardRect.right <= window.innerWidth - 24 : false,
      metadata: {
        text: meta?.textContent?.replace(/\s+/g, ' ').trim() || '',
        civilization: document.querySelector('[data-loading-civilization]')?.textContent?.trim() || '',
        difficulty: document.querySelector('[data-loading-difficulty]')?.textContent?.trim() || '',
        seed: document.querySelector('[data-loading-seed]')?.textContent?.trim() || '',
        tip: tip?.textContent?.trim() || '',
      },
      sigil: document.querySelector('[data-faction-sigil] img')?.getAttribute('src') || '',
      fonts: {
        displayUsed: heading ? getComputedStyle(heading).fontFamily : '',
        interfaceUsed: kicker ? getComputedStyle(kicker).fontFamily : '',
        bodyUsed: meta ? getComputedStyle(meta).fontFamily : '',
        tipUsed: tip ? getComputedStyle(tip).fontFamily : '',
      },
      motion: {
        reduced,
        activeAnimationName: activeStyle?.animationName || 'none',
        activeAnimationDuration: activeStyle?.animationDuration || '0s',
        activeAnimationTimingFunction: activeStyle?.animationTimingFunction || 'none',
      },
      stageObservations: globalThis.__FPE4_STAGE_OBSERVATIONS__ || [],
      config: globalThis.__STARHAVEN_QA__?.config || null,
      expectedConfig,
      expectedScene,
      target,
      segmentCountExpected: segmentCount,
      orientation: document.documentElement.dataset.orientation || '',
      expectedOrientation,
      overflow: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
      },
    };
  }, {
    expectedFaction: faction,
    expectedScene: SCENES[faction],
    target: dimension,
    expectedConfig: loadingConfig(faction),
    segmentCount: LOADING_SEGMENT_COUNT,
    expectedOrientation: orientation,
  });
}

function assertLoadingContract(details, faction, dimension, reducedMotion = false, orientation = 'landscape-left') {
  const expected = loadingConfig(faction);
  assertThat(details.visible, `${faction} ${dimension.width}x${dimension.height}: loading screen is not visible`);
  assertThat(details.civ === faction, `${faction}: loading data-civ is ${details.civ}`);
  assertThat(details.orientation === orientation, `${faction}: loading orientation is ${details.orientation}, expected ${orientation}`);
  assertThat(details.faction === faction && details.scene === SCENES[faction] && details.mode === 'loading', `${faction}: loading scene identity is incorrect`);
  assertThat(details.sceneId === SCENES[faction], `${faction}: loading container scene is ${details.sceneId}`);
  assertThat(details.artReady === 'true', `${faction}: authored loading scene is not ready`);
  assertThat(details.screenCreated === 'true' && details.sceneReady === 'true' && details.matchReady === 'true', `${faction}: loading lifecycle hooks are incomplete (${JSON.stringify(details)})`);
  assertThat(['1', '2', '3'].every((stage) => details.stageHistory.includes(stage)), `${faction}: loading stage history is ${details.stageHistory.join(',')}`);
  const observedStage = (stage) => details.stageObservations.find((observation) => observation.stage === stage);
  const stageOne = observedStage('1');
  const stageTwo = observedStage('2');
  const stageThree = observedStage('3');
  assertThat(stageOne?.states?.complete === 3 && stageOne?.states?.active === 1 && stageOne?.states?.future === 12, `${faction}: stage 1 segment DOM state was not observed (${JSON.stringify(details.stageObservations)})`);
  assertThat(stageTwo?.states?.complete === 9 && stageTwo?.states?.active === 1 && stageTwo?.states?.future === 6, `${faction}: stage 2 segment DOM state was not observed (${JSON.stringify(details.stageObservations)})`);
  assertThat(stageThree?.states?.complete === 16 && !stageThree?.states?.active && !stageThree?.states?.future, `${faction}: stage 3 segment DOM state was not observed (${JSON.stringify(details.stageObservations)})`);
  assertThat(details.stage === '3', `${faction}: held loading did not reach truthful match-ready stage`);
  assertThat(details.segmentCount === LOADING_SEGMENT_COUNT && details.visibleSegmentCount === LOADING_SEGMENT_COUNT, `${faction}: expected 16 visible loading segments, found ${details.segmentCount}/${details.visibleSegmentCount}`);
  assertThat(details.states.complete === LOADING_SEGMENT_COUNT && !details.states.active && !details.states.future, `${faction}: stage 3 segment states are not fully complete (${JSON.stringify(details.states)})`);
  assertThat(details.segmentRectsInteger, `${faction}: loading segment rectangle is fractional`);
  assertThat(details.cardRect && [details.cardRect.x, details.cardRect.y, details.cardRect.right, details.cardRect.bottom, details.cardRect.width, details.cardRect.height].every(Number.isInteger), `${faction}: loading card rectangle is fractional`);
  assertThat(details.trackRect && [details.trackRect.x, details.trackRect.y, details.trackRect.right, details.trackRect.bottom, details.trackRect.width, details.trackRect.height].every(Number.isInteger), `${faction}: loading track rectangle is fractional`);
  assertThat(details.cardRect?.width === 704, `${faction}: loading panel width is ${details.cardRect?.width}`);
  const expectedHeight = dimension.height <= 820 ? 144 : 152;
  assertThat(details.cardRect?.height === expectedHeight, `${faction} ${dimension.width}x${dimension.height}: loading panel height is ${details.cardRect?.height}, expected ${expectedHeight}`);
  assertThat(details.bottomSafeGap >= 24 && details.horizontalSafe, `${faction} ${dimension.width}x${dimension.height}: loading panel misses safe area`);
  assertThat(details.trackRect?.width === 640 && details.trackRect?.height === 20, `${faction}: loading segment track geometry is ${JSON.stringify(details.trackRect)}`);
  assertThat(details.metadata.civilization === (faction === 'sunweaver' ? 'Sunweaver' : 'Gravemark'), `${faction}: loading civilization metadata is ${details.metadata.civilization}`);
  assertThat(details.metadata.difficulty === 'Veteran', `${faction}: loading difficulty metadata is ${details.metadata.difficulty}`);
  assertThat(details.metadata.seed === 'Deterministic seed 424242', `${faction}: loading seed metadata is ${details.metadata.seed}`);
  assertThat(details.metadata.tip === 'Survey the center before you commit your first production line.', `${faction}: loading tip changed`);
  assertThat(details.sigil.includes(`${faction}-sigil.svg`), `${faction}: authored loading sigil is ${details.sigil}`);
  assertThat(/Pixelify Sans/i.test(details.fonts.displayUsed), `${faction}: loading status is not Pixelify Sans`);
  assertThat(/Silkscreen/i.test(details.fonts.interfaceUsed), `${faction}: loading kicker is not Silkscreen`);
  assertThat(/Kode Mono/i.test(details.fonts.bodyUsed) && /Kode Mono/i.test(details.fonts.tipUsed), `${faction}: loading body metadata/tip is not Kode Mono`);
  assertThat(Object.keys(expected).every((key) => details.config?.[key] === expected[key]), `${faction}: held loading config differs from submitted config (${JSON.stringify(details.config)})`);
  assertThat(details.overflow.documentWidth <= details.overflow.viewportWidth && details.overflow.documentHeight <= details.overflow.viewportHeight, `${faction} ${dimension.width}x${dimension.height}: loading document overflow`);
  assertThat(!details.motion.reduced || (details.motion.activeAnimationName === 'none' && details.motion.activeAnimationDuration === '0s'), `${faction}: Reduced Motion leaves loading activity animation active`);
  if (!details.motion.reduced && details.motion.activeAnimationName !== 'none') {
    assertThat(/steps\(/i.test(details.motion.activeAnimationTimingFunction), `${faction}: loading activity animation uses a non-stepped timing function`);
  }
  if (reducedMotion) assertThat(details.motion.reduced, `${faction}: Reduced Motion context was not active`);
}

async function runLoadingCase(browser, baseUrl, output, faction, dimension, manifest, { reducedMotion = false, orientation = 'landscape-left' } = {}) {
  const context = await browser.newContext({ viewport: dimension, deviceScaleFactor: 1, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await context.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: DEFAULT_PROFILE_KEY, value: profileValue(faction) });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = attachErrorCapture(page);
  try {
    await page.goto(pageUrl(baseUrl, { orientation, holdLoading: true }), { waitUntil: 'load', timeout: TIMEOUT_MS });
    await waitForMenu(page, faction, orientation);
    await page.locator('.menu-item[data-start-action="new-skirmish"]').click();
    await page.locator('.setup-view').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    await configureLoading(page, faction);
    await page.evaluate(() => {
      globalThis.__FPE4_STAGE_OBSERVATIONS__ = [];
      const capture = () => {
        const root = document.querySelector('.front-loading-screen');
        if (!(root instanceof HTMLElement)) return;
        const stage = root.getAttribute('data-loading-stage') || '';
        if (!stage) return;
        const states = [...root.querySelectorAll('.front-loading-segment')].reduce((counts, segment) => {
          const state = segment.getAttribute('data-state') || '';
          counts[state] = (counts[state] || 0) + 1;
          return counts;
        }, {});
        const observations = globalThis.__FPE4_STAGE_OBSERVATIONS__;
        if (observations.at(-1)?.stage !== stage) observations.push({ stage, states });
      };
      const observer = new MutationObserver(capture);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-loading-stage', 'data-loading-stage-history', 'data-state'],
      });
      globalThis.__FPE4_STAGE_OBSERVER__ = observer;
    });
    await page.locator('.primary-action[data-start-action="start-match"]').click();
    await page.locator('.front-loading-screen').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    await page.waitForFunction(() => document.querySelector('.front-loading-screen')?.getAttribute('data-loading-screen-created') === 'true', undefined, { timeout: TIMEOUT_MS });
    await page.waitForFunction(() => document.querySelector('.front-loading-screen')?.getAttribute('data-loading-scene-ready') === 'true', undefined, { timeout: TIMEOUT_MS });
    await page.waitForFunction(() => document.querySelector('.front-loading-screen')?.getAttribute('data-loading-match-ready') === 'true', undefined, { timeout: TIMEOUT_MS });
    const details = await readLoadingContract(page, faction, dimension, orientation);
    assertLoadingContract(details, faction, dimension, reducedMotion, orientation);
    const suffix = `${orientationSuffix(orientation)}${reducedMotion ? '-reduced-motion' : ''}`;
    const file = path.join(output, `loading-${faction}-${dimension.width}x${dimension.height}${suffix}.png`);
    await page.screenshot({ path: file, type: 'png' });
    manifest.captures.push(path.basename(file));
    assertThat(await page.locator('.front-loading-screen').isVisible(), `${faction}: loading hid before legal LOAD_READY`);
    const transition = await page.evaluate(() => globalThis.__STARHAVEN_QA__?.dispatch('LOAD_READY') ?? null);
    assertThat(transition?.accepted === true, `${faction}: legal LOAD_READY was rejected (${JSON.stringify(transition)})`);
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Playing', undefined, { timeout: TIMEOUT_MS });
    await page.locator('.front-loading-screen').waitFor({ state: 'hidden', timeout: TIMEOUT_MS });
    const finalProbe = await page.evaluate(() => globalThis.__STARHAVEN_QA__ ? JSON.parse(JSON.stringify(globalThis.__STARHAVEN_QA__)) : null);
    assertThat(finalProbe?.resetCount === 1, `${faction}: legal transition changed reset count to ${finalProbe?.resetCount}`);
    assertThat(errors.length === 0, `${faction} ${dimension.width}x${dimension.height}: loading browser/asset errors\n${errors.join('\n')}`);
    manifest.assertions.push({ name: `segmented loading ${faction} ${dimension.width}x${dimension.height} ${orientation}${reducedMotion ? ' Reduced Motion' : ''}`, status: 'PASS', details: { loading: details, finalProbe: { state: finalProbe?.state, resetCount: finalProbe?.resetCount, transitionHistory: finalProbe?.transitionHistory } } });
  } catch (error) {
    manifest.assertions.push({ name: `segmented loading ${faction} ${dimension.width}x${dimension.height} ${orientation}${reducedMotion ? ' Reduced Motion' : ''}`, status: 'FAIL', error: error?.message || String(error) });
    manifest.errors.push(error?.stack || error?.message || String(error));
  } finally {
    if (errors.length > 0) manifest.errors.push(...errors.map((error) => `browser: ${error}`));
    await context.close();
  }
}

async function readMenuContract(page, faction, dimension, orientation) {
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('700 80px "Pixelify Sans"'),
      document.fonts.load('700 14px "Silkscreen"'),
      document.fonts.load('400 14px "Kode Mono"'),
    ]);
  });
  return page.evaluate(({ expectedFaction, expectedScene, target, expectedOrientation }) => {
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
      document.querySelector('.menu-copy'),
      document.querySelector('.start-heading'),
      heading,
      footer,
    ].filter(Boolean).map((element) => ({ className: element.className, rect: rect(element) }));
    const wholePixel = (value) => Number.isInteger(value);
    const integerEdges = controls.every(({ rect: box }) => [box.x, box.y, box.right, box.bottom, box.width, box.height].every(wholePixel));
    return {
      faction: scene?.getAttribute('data-faction') || '',
      scene: sceneContainer?.getAttribute('data-scene-id') || '',
      artReady: scene?.getAttribute('data-art-ready') || '',
      rootCiv: root?.dataset.civ || '',
      orientation: document.documentElement.dataset.orientation || '',
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
      integerEdges,
      expectedOrientation,
    };
  }, { expectedFaction: faction, expectedScene: SCENES[faction], target: dimension, expectedOrientation: orientation });
}

function assertMenuContract(details, faction, dimension, orientation = 'landscape-left') {
  assertThat(details.artReady === 'true', `${faction} ${dimension.width}x${dimension.height}: authored scene is not ready`);
  assertThat(details.faction === faction, `${faction} ${dimension.width}x${dimension.height}: scene faction is ${details.faction}`);
  assertThat(details.scene === SCENES[faction], `${faction} ${dimension.width}x${dimension.height}: scene is ${details.scene}`);
  assertThat(details.rootCiv === faction, `${faction} ${dimension.width}x${dimension.height}: data-civ is ${details.rootCiv}`);
  assertThat(details.orientation === orientation, `${faction} ${dimension.width}x${dimension.height}: orientation is ${details.orientation}, expected ${orientation}`);
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
  assertThat(details.integerEdges, `${faction} ${dimension.width}x${dimension.height}: a shell edge is fractional`);
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

async function exerciseTooltipAndFocus(page, output, faction, dimension, manifest, orientation = 'landscape-left') {
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
  const file = path.join(output, `focused-tooltip-${faction}-${dimension.width}x${dimension.height}${orientationSuffix(orientation)}.png`);
  await page.screenshot({ path: file, type: 'png' });
  manifest.captures.push(path.basename(file));
}

async function readShellTiming(page, selector) {
  return page.evaluate((targetSelector) => {
    const element = document.querySelector(targetSelector);
    const style = element ? getComputedStyle(element) : null;
    return {
      selector: targetSelector,
      mediaMatches: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      transitionDuration: style?.transitionDuration || '0s',
      transitionTimingFunction: style?.transitionTimingFunction || 'none',
      animationName: style?.animationName || 'none',
      animationDuration: style?.animationDuration || '0s',
      animationTimingFunction: style?.animationTimingFunction || 'none',
    };
  }, selector);
}

function hasActiveDuration(value) {
  return String(value).split(',').some((duration) => Number.parseFloat(duration) > 0);
}

function assertMotionContract(details, label, reducedMotion = false) {
  assertThat(details, `${label}: representative element is missing`);
  if (reducedMotion) {
    assertThat(details.mediaMatches, `${label}: Reduced Motion media query was not active`);
    assertThat(!hasActiveDuration(details.transitionDuration), `${label}: transition remains active (${JSON.stringify(details)})`);
    assertThat(details.animationName === 'none' || !hasActiveDuration(details.animationDuration), `${label}: animation remains active (${JSON.stringify(details)})`);
    return;
  }
  if (hasActiveDuration(details.transitionDuration)) {
    assertThat(/steps\(/i.test(details.transitionTimingFunction), `${label}: transition timing is not stepped (${JSON.stringify(details)})`);
  }
  if (details.animationName !== 'none' && hasActiveDuration(details.animationDuration)) {
    assertThat(/steps\(/i.test(details.animationTimingFunction), `${label}: animation timing is not stepped (${JSON.stringify(details)})`);
  }
}

async function exercisePointerAndKeyboard(page, faction, manifest) {
  const target = page.locator('.menu-item[data-start-action="tutorial"]');
  await target.hover();
  await page.waitForTimeout(120);
  const hoverMotion = await page.evaluate(() => getComputedStyle(document.querySelector('.menu-item[data-start-action="tutorial"]')).transform);
  assertThat(/matrix\(1, 0, 0, 1, 2, 0\)/.test(hoverMotion), `${faction}: mouse hover did not apply the exact 2px pixel move (${hoverMotion})`);
  const box = await target.boundingBox();
  assertThat(box, `${faction}: representative mouse target has no box`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => /matrix\(1, 0, 0, 1, 0, 2\)/.test(getComputedStyle(document.querySelector('.menu-item[data-start-action="tutorial"]')).transform), undefined, { timeout: TIMEOUT_MS });
  const pressMotion = await page.evaluate(() => getComputedStyle(document.querySelector('.menu-item[data-start-action="tutorial"]')).transform);
  assertThat(/matrix\(1, 0, 0, 1, 0, 2\)/.test(pressMotion), `${faction}: mouse press did not apply the exact 2px pixel move (${pressMotion})`);
  await page.mouse.up();
  await page.locator('.start-panel').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  await page.keyboard.press('Escape');
  await page.locator('.start-panel').waitFor({ state: 'hidden', timeout: TIMEOUT_MS });

  const primary = page.locator('.menu-item[data-start-action="new-skirmish"]');
  await primary.focus();
  await page.keyboard.press('Tab');
  assertThat(await page.evaluate(() => document.activeElement?.getAttribute('data-start-action') === 'tutorial'), `${faction}: Tab did not reach the next menu control`);
  await page.keyboard.press('Enter');
  await page.locator('.start-panel').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  await page.keyboard.press('Escape');
  await page.locator('.start-panel').waitFor({ state: 'hidden', timeout: TIMEOUT_MS });
  assertThat(await page.evaluate(() => document.activeElement?.getAttribute('data-start-action') === 'tutorial'), `${faction}: keyboard Escape did not restore focus to the opener`);
  manifest.assertions.push({ name: `mouse hover/press and keyboard Tab/Enter/Escape (${faction})`, status: 'PASS' });
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
    const content = surface.querySelector('.panel-content');
    const contentRect = content instanceof HTMLElement ? box(content) : null;
    const accentStyle = getComputedStyle(surface, '::after');
    const integerEdges = [surfaceRect, ...controls.map(({ rect }) => rect)]
      .every((rect) => [rect.x, rect.y, rect.right, rect.bottom, rect.width, rect.height].every(Number.isInteger));
    return {
      panelKind: surface.getAttribute('data-panel-kind') || '',
      surfaceRect,
      contentRect,
      accent: {
        display: accentStyle.display,
        position: accentStyle.position,
        marginTop: accentStyle.marginTop,
        height: accentStyle.height,
        width: accentStyle.width,
      },
      controls,
      clipped,
      integerEdges,
      overflow: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
      },
    };
  }, selector);
}

function assertSurfaceContract(details, label, { minimumInset = 0, expectedWidth = null } = {}) {
  assertThat(details, `${label}: surface is missing`);
  assertThat(details.clipped.length === 0, `${label}: visible control is clipped (${JSON.stringify(details.clipped)})`);
  assertThat(details.integerEdges, `${label}: surface/control edge is fractional`);
  assertThat(details.controls.every(({ rect }) => rect.width >= 44 && rect.height >= 44), `${label}: a visible control is below 44x44 CSS pixels`);
  assertThat(details.overflow.documentWidth <= details.overflow.viewportWidth, `${label}: horizontal document overflow`);
  assertThat(details.overflow.documentHeight <= details.overflow.viewportHeight, `${label}: vertical document overflow`);
  if (expectedWidth !== null) {
    assertThat(details.surfaceRect.width === expectedWidth, `${label}: shared panel width changed (${details.surfaceRect.width}px)`);
  }
  if (minimumInset > 0) {
    const { surfaceRect } = details;
    assertThat(surfaceRect.x >= minimumInset && surfaceRect.y >= minimumInset, `${label}: surface starts inside the ${minimumInset}px safe inset`);
    assertThat(surfaceRect.right <= details.overflow.viewportWidth - minimumInset && surfaceRect.bottom <= details.overflow.viewportHeight - minimumInset, `${label}: surface exceeds the ${minimumInset}px safe inset`);
  }
}

function assertPanelGeometry(details, label, expectedPanelKind) {
  assertThat(details.panelKind === expectedPanelKind, `${label}: panel kind is ${JSON.stringify(details.panelKind)}, expected ${expectedPanelKind}`);
  assertThat(details.surfaceRect.width === 880, `${label}: shared panel width changed (${details.surfaceRect.width}px)`);
  assertThat(details.accent.display === 'block', `${label}: panel accent is not a block flex item (${JSON.stringify(details.accent)})`);
  assertThat(details.accent.position === 'static', `${label}: panel accent is not in flow (${JSON.stringify(details.accent)})`);
  assertThat(details.accent.marginTop === '16px', `${label}: panel accent baseline spacing changed (${JSON.stringify(details.accent)})`);
  assertThat(details.accent.height === `${PANEL_ACCENT_HEIGHTS[expectedPanelKind]}px`, `${label}: panel accent height is wrong (${JSON.stringify(details.accent)})`);
  assertThat(Number.parseFloat(details.accent.width) % 1 === 0, `${label}: panel accent width is fractional (${JSON.stringify(details.accent)})`);
}

async function openAndClosePanel(page, selector, label, { capturePath = null, expectedPanelKind = null } = {}) {
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
  assertSurfaceContract(details, label, { minimumInset: 24, expectedWidth: expectedPanelKind === null ? null : 880 });
  if (expectedPanelKind !== null) {
    assertPanelGeometry(details, label, expectedPanelKind);
    if (expectedPanelKind === 'history') {
      assertThat(details.surfaceRect.height <= 240, `${label}: Match History remains a compact panel (${details.surfaceRect.height}px high)`);
      assertThat(details.contentRect && details.surfaceRect.bottom - details.contentRect.bottom <= 48, `${label}: Match History has a large bottom void (${JSON.stringify({ surface: details.surfaceRect, content: details.contentRect })})`);
    }
  }
  assertMotionContract(await readShellTiming(page, '.panel-card'), `${label} normal motion`);
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
  return details;
}

async function readSetupContract(page, orientation) {
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('700 32px "Pixelify Sans"'),
      document.fonts.load('700 14px "Silkscreen"'),
      document.fonts.load('400 14px "Kode Mono"'),
    ]);
  });
  return page.evaluate((expectedOrientation) => {
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
    const geometry = [setup, heading, ...cards, ...controls, start, back].filter(Boolean).map((element) => rect(element));
    const integerEdges = geometry.every((box) => [box.x, box.y, box.right, box.bottom, box.width, box.height].every(Number.isInteger));
    const headingTitle = document.querySelector('.setup-heading h2');
    const label = document.querySelector('.setup-field legend');
    const status = document.querySelector('.setup-status');
    const explanation = document.querySelector('.faction-summary p');
    return {
      setupVisible: visible(setup),
      orientation: document.documentElement.dataset.orientation || '',
      expectedOrientation,
      setupRect: setup ? rect(setup) : null,
      headingRect: heading ? rect(heading) : null,
      cards: cards.map(rect),
      selected,
      controls: controlRects,
      clipped,
      integerEdges,
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
  }, orientation);
}

function assertSetupContract(details, faction, dimension, orientation = 'landscape-left') {
  const rival = faction === 'sunweaver' ? 'gravemark' : 'sunweaver';
  assertThat(details.setupVisible, `${faction} ${dimension.width}x${dimension.height}: setup view is not visible`);
  assertThat(details.orientation === orientation, `${faction} ${dimension.width}x${dimension.height}: setup orientation is ${details.orientation}, expected ${orientation}`);
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
  assertThat(details.integerEdges, `${faction} ${dimension.width}x${dimension.height}: setup frame/control edge is fractional`);
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

async function runSetupCase(browser, baseUrl, output, faction, dimension, manifest, orientation = 'landscape-left') {
  const context = await browser.newContext({ viewport: dimension, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: DEFAULT_PROFILE_KEY, value: profileValue(faction) });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = attachErrorCapture(page);
  try {
    await page.goto(pageUrl(baseUrl, { orientation }), { waitUntil: 'load', timeout: TIMEOUT_MS });
    await waitForMenu(page, faction, orientation);
    await page.locator('.menu-item[data-start-action="new-skirmish"]').click();
    await page.locator('.setup-view').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    const details = await readSetupContract(page, orientation);
    assertSetupContract(details, faction, dimension, orientation);
    assertMotionContract(await readShellTiming(page, '[data-config-field="difficulty"]'), `${faction} ${dimension.width}x${dimension.height} normal setup motion`);
    const suffix = orientationSuffix(orientation);
    const file = path.join(output, `setup-${faction}-${dimension.width}x${dimension.height}${suffix}.png`);
    await page.screenshot({ path: file, type: 'png' });
    manifest.captures.push(path.basename(file));
    await exerciseSetupInteractions(page, faction);
    const interacted = await readSetupContract(page, orientation);
    assertThat(interacted.seedVisible && interacted.seedValue === '424242' && !interacted.startDisabled, `${faction}: deterministic seed interaction did not finish valid`);
    await page.locator('.secondary-action[data-start-action="back"]').click();
    await page.locator('.menu-view').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    assertThat(errors.length === 0, `${faction} ${dimension.width}x${dimension.height}: setup browser errors\n${errors.join('\n')}`);
    manifest.assertions.push({ name: `match setup ${faction} ${dimension.width}x${dimension.height} ${orientation}`, status: 'PASS', details: { initial: details, interacted } });
  } catch (error) {
    manifest.assertions.push({ name: `match setup ${faction} ${dimension.width}x${dimension.height} ${orientation}`, status: 'FAIL', error: error?.message || String(error) });
    manifest.errors.push(error?.stack || error?.message || String(error));
  } finally {
    if (errors.length > 0) manifest.errors.push(...errors.map((error) => `browser: ${error}`));
    await context.close();
  }
}

async function runPanelEvidence(browser, baseUrl, output, manifest, orientation = 'landscape-left') {
  const dimension = { width: 1366, height: 1024 };
  const context = await browser.newContext({ viewport: dimension, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: DEFAULT_PROFILE_KEY, value: profileValue('sunweaver') });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = attachErrorCapture(page);
  try {
    await page.goto(pageUrl(baseUrl, { orientation }), { waitUntil: 'load', timeout: TIMEOUT_MS });
    await waitForMenu(page, 'sunweaver', orientation);
    const suffix = orientationSuffix(orientation);
    const panelGeometry = [];
    for (const action of PANEL_ACTIONS) {
      const selector = action === 'tutorial' || action === 'factions' || action === 'settings'
        ? `.menu-item[data-start-action="${action}"]`
        : `.utility-button[data-start-action="${action}"]`;
      const file = path.join(output, `panel-${action}-1366x1024${suffix}.png`);
      const details = await openAndClosePanel(page, selector, `${action} evidence`, { capturePath: file, expectedPanelKind: action });
      panelGeometry.push({
        kind: action,
        rect: details.surfaceRect,
        accent: details.accent,
        contentTailGap: details.contentRect ? details.surfaceRect.bottom - details.contentRect.bottom : null,
      });
      manifest.captures.push(path.basename(file));
    }
    assertThat(panelGeometry.length === PANEL_ACTIONS.length, `panel evidence did not collect all seven panel rectangles (${panelGeometry.length})`);
    assertThat(panelGeometry.every(({ rect }) => [rect.x, rect.y, rect.right, rect.bottom, rect.width, rect.height].every(Number.isInteger)), `panel evidence has a fractional panel rectangle (${JSON.stringify(panelGeometry)})`);
    assertThat(panelGeometry.every(({ rect }) => rect.width === 880), `panel evidence changed the shared 880px panel width (${JSON.stringify(panelGeometry)})`);
    const historyGeometry = panelGeometry.find(({ kind }) => kind === 'history');
    assertThat(historyGeometry && historyGeometry.rect.height <= 240, `panel evidence left Match History too tall (${JSON.stringify(historyGeometry)})`);
    assertThat(historyGeometry && historyGeometry.contentTailGap <= 48, `panel evidence left a large Match History bottom void (${JSON.stringify(historyGeometry)})`);
    manifest.assertions.push({ name: `seven panel rectangles stay 880px wide, whole-pixel, and Match History is compact (${orientation})`, status: 'PASS', details: { panelGeometry } });
    await page.setViewportSize({ width: 1180, height: 820 });
    await waitForMenu(page, 'sunweaver', orientation);
    const smallFile = path.join(output, `panel-records-1180x820${suffix}.png`);
    await openAndClosePanel(page, '.utility-button[data-start-action="records"]', 'records 1180x820 evidence', { capturePath: smallFile, expectedPanelKind: 'records' });
    manifest.captures.push(path.basename(smallFile));
    assertThat(errors.length === 0, `panel evidence browser errors\n${errors.join('\n')}`);
    manifest.assertions.push({ name: `all seven panels have evidence, focus containment, Escape close, and no clipping (${orientation})`, status: 'PASS', details: { panels: PANEL_ACTIONS, smallViewport: 'records' } });
  } catch (error) {
    manifest.assertions.push({ name: `all seven panels have evidence, focus containment, Escape close, and no clipping (${orientation})`, status: 'FAIL', error: error?.message || String(error) });
    manifest.errors.push(error?.stack || error?.message || String(error));
  } finally {
    if (errors.length > 0) manifest.errors.push(...errors.map((error) => `browser: ${error}`));
    await context.close();
  }
}

async function runTouchContract(browser, baseUrl, manifest, orientation = 'landscape-left') {
  const context = await browser.newContext({ viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 1, hasTouch: true });
  await context.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: DEFAULT_PROFILE_KEY, value: profileValue('sunweaver') });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = attachErrorCapture(page);
  try {
    await page.goto(pageUrl(baseUrl, { orientation }), { waitUntil: 'load', timeout: TIMEOUT_MS });
    await waitForMenu(page, 'sunweaver', orientation);
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
    manifest.assertions.push({ name: `touch context taps panel opener, setup segment, and close control (${orientation})`, status: 'PASS' });
  } catch (error) {
    manifest.assertions.push({ name: `touch context taps panel opener, setup segment, and close control (${orientation})`, status: 'FAIL', error: error?.message || String(error) });
    manifest.errors.push(error?.stack || error?.message || String(error));
  } finally {
    if (errors.length > 0) manifest.errors.push(...errors.map((error) => `browser: ${error}`));
    await context.close();
  }
}

async function runReducedMotionContract(browser, baseUrl, output, manifest, orientation = 'landscape-left') {
  const dimension = { width: 1366, height: 1024 };
  const context = await browser.newContext({ viewport: dimension, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await context.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: DEFAULT_PROFILE_KEY, value: profileValue('sunweaver') });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = attachErrorCapture(page);
  try {
    await page.goto(pageUrl(baseUrl, { orientation }), { waitUntil: 'load', timeout: TIMEOUT_MS });
    await waitForMenu(page, 'sunweaver', orientation);
    const menuMotion = await readShellTiming(page, '.menu-item[data-start-action="tutorial"]');
    assertMotionContract(menuMotion, 'Reduced Motion Main Menu', true);
    const menuFile = path.join(output, `menu-reduced-motion-1366x1024${orientationSuffix(orientation)}.png`);
    await page.screenshot({ path: menuFile, type: 'png' });
    manifest.captures.push(path.basename(menuFile));
    await page.locator('.menu-item[data-start-action="new-skirmish"]').click();
    await page.locator('.setup-view').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    const setupMotion = await readShellTiming(page, '[data-config-field="difficulty"]');
    assertMotionContract(setupMotion, 'Reduced Motion Match Setup', true);
    const setupFile = path.join(output, `setup-reduced-motion-1366x1024${orientationSuffix(orientation)}.png`);
    await page.screenshot({ path: setupFile, type: 'png' });
    manifest.captures.push(path.basename(setupFile));
    await page.locator('.secondary-action[data-start-action="back"]').click();
    await page.locator('.menu-view').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    await page.locator('.utility-button[data-start-action="records"]').click();
    await page.locator('.start-panel').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    const motion = await readShellTiming(page, '.panel-card');
    assertMotionContract(motion, 'Reduced Motion Panel', true);
    const file = path.join(output, `panel-reduced-motion-1366x1024${orientationSuffix(orientation)}.png`);
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
    manifest.assertions.push({ name: `Reduced Motion removes Main Menu, Match Setup, and panel movement (${orientation})`, status: 'PASS', details: motion });
  } catch (error) {
    manifest.assertions.push({ name: `Reduced Motion removes Main Menu, Match Setup, and panel movement (${orientation})`, status: 'FAIL', error: error?.message || String(error) });
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
  const newSkirmish = page.locator('.menu-item[data-start-action="new-skirmish"]');
  await newSkirmish.click();
  await page.locator('.setup-view').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  assertThat(await page.locator('.menu-view').isHidden(), 'New Skirmish left the Main Menu visible');
  await page.locator('.secondary-action[data-start-action="back"]').click();
  await page.locator('.menu-view').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  assertThat(await page.evaluate(() => document.activeElement?.getAttribute('data-start-action') === 'new-skirmish'), 'Back did not restore focus to New Skirmish');
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

async function runMenuCase(browser, baseUrl, output, faction, dimension, manifest, orientation = 'landscape-left') {
  const context = await browser.newContext({ viewport: dimension, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, value }) => {
    if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: DEFAULT_PROFILE_KEY, value: profileValue(faction) });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = attachErrorCapture(page);
  try {
    await page.goto(pageUrl(baseUrl, { orientation }), { waitUntil: 'load', timeout: TIMEOUT_MS });
    await waitForMenu(page, faction, orientation);
    const details = await readMenuContract(page, faction, dimension, orientation);
    assertMenuContract(details, faction, dimension, orientation);
    if (dimension.width === 1366 && dimension.height === 1024) {
      assertMotionContract(await readShellTiming(page, '.menu-item[data-start-action="tutorial"]'), `${faction} normal Main Menu motion`);
    }
    manifest.assertions.push({ name: `menu contract ${faction} ${dimension.width}x${dimension.height} ${orientation}`, status: 'PASS', details });
    const file = path.join(output, `menu-${faction}-${dimension.width}x${dimension.height}${orientationSuffix(orientation)}.png`);
    await page.screenshot({ path: file, type: 'png' });
    manifest.captures.push(path.basename(file));

    if (dimension.width === 1920 && dimension.height === 1080) {
      await exerciseTooltipAndFocus(page, output, faction, dimension, manifest, orientation);
    }
    if (dimension.width === 1366 && dimension.height === 1024) await exercisePointerAndKeyboard(page, faction, manifest);
    await exerciseControls(page);
    if (dimension.width === 1366 && dimension.height === 1024) await exerciseFactionChoice(page, faction);
    assertThat(errors.length === 0, `${faction} ${dimension.width}x${dimension.height}: browser errors\n${errors.join('\n')}`);
    manifest.assertions.push({ name: `interactions ${faction} ${dimension.width}x${dimension.height} ${orientation}`, status: 'PASS' });
  } catch (error) {
    manifest.assertions.push({
      name: `menu case ${faction} ${dimension.width}x${dimension.height} ${orientation}`,
      status: 'FAIL',
      error: error?.message || String(error),
    });
    manifest.errors.push(error?.stack || error?.message || String(error));
  } finally {
    if (errors.length > 0) manifest.errors.push(...errors.map((error) => `browser: ${error}`));
    await context.close();
  }
}

async function runDispatchPersistence(browser, baseUrl, output, manifest, orientation = 'landscape-left') {
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
    await page.goto(pageUrl(baseUrl, { orientation }), { waitUntil: 'load', timeout: TIMEOUT_MS });
    await waitForMenu(page, faction, orientation);
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
    await waitForMenu(page, faction, orientation);
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

async function runRotateGateCase(browser, baseUrl, output, dimension, manifest) {
  const context = await browser.newContext({ viewport: dimension, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = attachErrorCapture(page);
  try {
    await page.goto(pageUrl(baseUrl, { page: 'index.html', orientation: 'landscape-left' }), { waitUntil: 'load', timeout: TIMEOUT_MS });
    await page.locator('#rotate-gate').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    const details = await page.evaluate(() => {
      const visible = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
      };
      const rect = (element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
      };
      const gate = document.querySelector('#rotate-gate');
      const card = document.querySelector('.rotate-gate-card');
      const motif = document.querySelector('.rotate-gate-motif');
      const title = document.querySelector('.rotate-gate-card h1');
      const copy = document.querySelector('.rotate-gate-copy');
      const kicker = document.querySelector('.rotate-gate-kicker');
      const note = document.querySelector('.rotate-gate-note');
      const cardStyle = card ? getComputedStyle(card) : null;
      const cardHighlight = card ? getComputedStyle(card, '::before') : null;
      return {
        visible: visible(gate),
        appHidden: getComputedStyle(document.querySelector('#app')).visibility === 'hidden',
        text: gate?.textContent?.replace(/\s+/g, ' ').trim() || '',
        cardRect: card ? rect(card) : null,
        motifRect: motif ? rect(motif) : null,
        cardFrame: {
          border: cardStyle?.borderTopWidth || '',
          background: cardStyle?.backgroundColor || '',
          shadow: cardStyle?.boxShadow || '',
          chamfer: cardStyle?.clipPath || '',
          highlightBorder: cardHighlight?.borderTopWidth || '',
        },
        fonts: {
          display: title ? getComputedStyle(title).fontFamily : '',
          interface: kicker ? getComputedStyle(kicker).fontFamily : '',
          body: copy ? getComputedStyle(copy).fontFamily : '',
          note: note ? getComputedStyle(note).fontFamily : '',
        },
        integerEdges: [card, motif].filter(Boolean).map(rect).every((box) => [box.x, box.y, box.right, box.bottom, box.width, box.height].every(Number.isInteger)),
        overflow: {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          documentWidth: document.documentElement.scrollWidth,
          documentHeight: document.documentElement.scrollHeight,
        },
      };
    });
    assertThat(details.visible, `rotate gate ${dimension.width}x${dimension.height}: gate is not visible`);
    assertThat(details.appHidden, `rotate gate ${dimension.width}x${dimension.height}: app remains visible`);
    assertThat(/ROTATE THE IPAD TO LANDSCAPE TO COMMAND STARHAVEN/i.test(details.text), `rotate gate ${dimension.width}x${dimension.height}: orientation message is missing`);
    assertThat(details.cardRect?.width === 640 && details.cardRect?.height === 280, `rotate gate ${dimension.width}x${dimension.height}: frame geometry is ${JSON.stringify(details.cardRect)}`);
    assertThat(details.cardRect.x >= 24 && details.cardRect.right <= dimension.width - 24 && details.cardRect.y >= 24 && details.cardRect.bottom <= dimension.height - 24, `rotate gate ${dimension.width}x${dimension.height}: frame misses the safe inset`);
    assertThat(details.cardFrame.border === '2px' && details.cardFrame.highlightBorder === '1px', `rotate gate ${dimension.width}x${dimension.height}: hard frame weights are incorrect (${JSON.stringify(details.cardFrame)})`);
    assertThat(/4px 4px 0px/.test(details.cardFrame.shadow), `rotate gate ${dimension.width}x${dimension.height}: frame shadow is not hard 4px (${details.cardFrame.shadow})`);
    assertThat(/polygon\(8px 0px/.test(details.cardFrame.chamfer), `rotate gate ${dimension.width}x${dimension.height}: frame chamfer is not 8px`);
    assertThat(details.integerEdges, `rotate gate ${dimension.width}x${dimension.height}: frame edge is fractional`);
    assertThat(/Pixelify Sans/i.test(details.fonts.display), `rotate gate ${dimension.width}x${dimension.height}: title is not Pixelify Sans`);
    assertThat(/Silkscreen/i.test(details.fonts.interface) && /Silkscreen/i.test(details.fonts.note), `rotate gate ${dimension.width}x${dimension.height}: interface copy is not Silkscreen`);
    assertThat(/Kode Mono/i.test(details.fonts.body), `rotate gate ${dimension.width}x${dimension.height}: message is not Kode Mono`);
    assertThat(details.overflow.documentWidth <= dimension.width && details.overflow.documentHeight <= dimension.height, `rotate gate ${dimension.width}x${dimension.height}: document overflow`);
    const file = path.join(output, `rotate-gate-${dimension.width}x${dimension.height}.png`);
    await page.screenshot({ path: file, type: 'png' });
    manifest.captures.push(path.basename(file));
    assertThat(errors.length === 0, `rotate gate ${dimension.width}x${dimension.height}: browser/asset errors\n${errors.join('\n')}`);
    manifest.assertions.push({ name: `portrait rotate gate ${dimension.width}x${dimension.height}`, status: 'PASS', details });
  } catch (error) {
    manifest.assertions.push({ name: `portrait rotate gate ${dimension.width}x${dimension.height}`, status: 'FAIL', error: error?.message || String(error) });
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
    orientations: ORIENTATIONS,
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
    for (const orientation of ORIENTATIONS) {
      for (const faction of FACTIONS) {
        for (const dimension of DIMENSIONS) {
          await runMenuCase(browser, baseUrl, output, faction, dimension, manifest, orientation);
        }
      }
    }
    for (const orientation of ORIENTATIONS) {
      for (const faction of FACTIONS) {
        for (const dimension of DIMENSIONS) {
          await runSetupCase(browser, baseUrl, output, faction, dimension, manifest, orientation);
        }
      }
    }
    for (const orientation of ORIENTATIONS) {
      for (const faction of FACTIONS) {
        for (const dimension of DIMENSIONS) {
          await runLoadingCase(browser, baseUrl, output, faction, dimension, manifest, { orientation });
        }
      }
    }
    for (const orientation of ORIENTATIONS) {
      for (const faction of FACTIONS) {
        await runLoadingCase(browser, baseUrl, output, faction, { width: 1366, height: 1024 }, manifest, { reducedMotion: true, orientation });
      }
    }
    for (const orientation of ORIENTATIONS) {
      await runPanelEvidence(browser, baseUrl, output, manifest, orientation);
      await runTouchContract(browser, baseUrl, manifest, orientation);
      await runReducedMotionContract(browser, baseUrl, output, manifest, orientation);
      await runDispatchPersistence(browser, baseUrl, output, manifest, orientation);
    }
    for (const dimension of [{ width: 820, height: 1180 }, { width: 768, height: 1024 }]) {
      await runRotateGateCase(browser, baseUrl, output, dimension, manifest);
    }
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
    fs.writeFileSync(path.join(output, 'responsive-manifest.json'), `${JSON.stringify({
      tool: manifest.tool,
      status: manifest.status,
      dimensions: manifest.dimensions,
      orientations: manifest.orientations,
      portrait: [{ width: 820, height: 1180 }, { width: 768, height: 1024 }],
      captures: manifest.captures,
      generatedAt: manifest.finishedAt,
    }, null, 2)}\n`, 'utf8');
  }
  console.log(`qa-pixel-front-end: ${manifest.status}`);
  console.log(`qa-pixel-front-end: manifest ${path.join(output, 'manifest.json')}`);
  if (manifest.status !== 'PASS') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
