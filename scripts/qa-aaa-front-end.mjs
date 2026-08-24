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
const DIMENSIONS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1366, height: 1024 },
  { width: 1180, height: 820 },
];
const PROFILE_STORAGE_KEY = 'starhaven.player-profile.v1';
const FACTIONS = ['sunweaver', 'gravemark'];
const SCENES = {
  sunweaver: 'sunweaver-capital',
  gravemark: 'gravemark-quarry',
};
const MODES = ['menu', 'loading'];
const LOADING_CONFIG = {
  map: 'helios-rift',
  difficulty: 'veteran',
  fogOfWar: false,
  speed: 1.25,
  tacticalPause: 'on-demand',
  seedMode: 'deterministic',
  seed: 424242,
};
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

async function createContext(browser, faction, viewport, reducedMotion = false) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  });
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

async function assertScene(page, faction, mode, viewport, errors) {
  await waitForArt(page, faction, mode);
  const details = await inspectCanvas(page);
  assertThat(details, `${faction}/${mode}: scene canvas is missing or has no 2D context`);
  assertThat(details.className.includes('front-end-scene__canvas'), `${faction}/${mode}: scene canvas class is missing`);
  assertThat(details.backingWidth === 960 && details.backingHeight === 540, `${faction}/${mode}: backing canvas is ${details.backingWidth}x${details.backingHeight}`);
  assertThat(details.viewportWidth === viewport.width && details.viewportHeight === viewport.height, `${faction}/${mode}: viewport is ${details.viewportWidth}x${details.viewportHeight}`);
  assertThat(details.cssWidth >= viewport.width - 1 && details.cssHeight >= viewport.height - 1, `${faction}/${mode}: scene does not fill the viewport (${details.cssWidth}x${details.cssHeight})`);
  assertThat(details.distinctColors >= 200, `${faction}/${mode}: only ${details.distinctColors} sampled colors; canvas appears unpainted`);
  assertThat(errors.length === 0, `${faction}/${mode}: browser errors:\n${errors.join('\n')}`);
  return details;
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
  for (const [field, value] of [
    ['playerFaction', config.playerFaction],
    ['aiFaction', config.aiFaction],
    ['difficulty', config.difficulty],
    ['fogOfWar', String(config.fogOfWar)],
    ['speed', String(config.speed)],
    ['tacticalPause', config.tacticalPause],
  ]) {
    await page.locator(`[data-config-field="${field}"][data-config-value="${value}"]`).click();
  }
  await page.locator('[data-config-field="seedMode"][data-config-value="deterministic"]').click();
  await page.locator('[data-seed-input]').fill(String(config.seed));
  await page.waitForFunction((expected) => {
    const actual = globalThis.__STARHAVEN_QA__?.config;
    return actual && Object.keys(expected).every((key) => actual[key] === expected[key]);
  }, config);
}

async function readLoadingDetails(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.front-loading-screen');
    const card = document.querySelector('.front-loading-card');
    const track = document.querySelector('[data-loading-segments]');
    const scene = root?.querySelector('.front-end-scene');
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const segments = [...(root?.querySelectorAll('.front-loading-segment') || [])];
    const segmentRects = segments.map(box);
    return {
      civ: root?.getAttribute('data-civ') || '',
      scene: scene?.getAttribute('data-scene') || '',
      faction: scene?.getAttribute('data-faction') || '',
      mode: scene?.getAttribute('data-mode') || '',
      sceneId: root?.getAttribute('data-scene-id') || '',
      artReady: scene?.getAttribute('data-art-ready') || '',
      screenCreated: root?.getAttribute('data-loading-screen-created') || '',
      sceneReady: root?.getAttribute('data-loading-scene-ready') || '',
      matchReady: root?.getAttribute('data-loading-match-ready') || '',
      stage: root?.getAttribute('data-loading-stage') || '',
      stageHistory: (root?.getAttribute('data-loading-stage-history') || '').split(',').filter(Boolean),
      stageObservations: globalThis.__FPE4_STAGE_OBSERVATIONS__ || [],
      card: card ? box(card) : null,
      track: track ? box(track) : null,
      segments: segments.length,
      visibleSegments: segments.filter((segment) => {
        const style = getComputedStyle(segment);
        const rect = segment.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      }).length,
      segmentStates: segments.reduce((states, segment) => {
        const state = segment.getAttribute('data-state') || '';
        states[state] = (states[state] || 0) + 1;
        return states;
      }, {}),
      integerRects: segmentRects.every((rect) => [rect.x, rect.y, rect.right, rect.bottom, rect.width, rect.height].every(Number.isInteger)),
      segmentRects,
      metadata: document.querySelector('[data-loading-meta]')?.textContent?.replace(/\s+/g, ' ').trim() || '',
      tip: document.querySelector('[data-loading-tip]')?.textContent?.trim() || '',
      sigil: document.querySelector('[data-faction-sigil] img')?.getAttribute('src') || '',
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      activeAnimation: getComputedStyle(document.querySelector('.front-loading-segment[data-state="active"]') || document.body).animationName,
      config: globalThis.__STARHAVEN_QA__?.config || null,
      overflow: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      },
    };
  });
}

function assertLoadingDetails(details, faction, dimension, reducedMotion) {
  const config = loadingConfig(faction);
  const expectedCivilization = faction === 'sunweaver' ? 'Sunweaver' : 'Gravemark';
  const expectedHeight = dimension.height <= 820 ? 144 : 152;
  assertThat(details.civ === faction && details.faction === faction && details.mode === 'loading', `${faction}: loading faction/mode dataset is incorrect`);
  assertThat(details.scene === SCENES[faction] && details.sceneId === SCENES[faction] && details.artReady === 'true', `${faction}: authored loading scene identity/readiness is incorrect`);
  assertThat(details.screenCreated === 'true' && details.sceneReady === 'true' && details.matchReady === 'true', `${faction}: loading lifecycle hooks are incomplete`);
  assertThat(['1', '2', '3'].every((stage) => details.stageHistory.includes(stage)) && details.stage === '3', `${faction}: loading stage truth is ${details.stageHistory.join(',')} / ${details.stage}`);
  const observedStage = (stage) => details.stageObservations.find((observation) => observation.stage === stage);
  const stageOne = observedStage('1');
  const stageTwo = observedStage('2');
  const stageThree = observedStage('3');
  assertThat(stageOne?.states?.complete === 3 && stageOne?.states?.active === 1 && stageOne?.states?.future === 12, `${faction}: AAA did not observe stage 1 segment states (${JSON.stringify(details.stageObservations)})`);
  assertThat(stageTwo?.states?.complete === 9 && stageTwo?.states?.active === 1 && stageTwo?.states?.future === 6, `${faction}: AAA did not observe stage 2 segment states (${JSON.stringify(details.stageObservations)})`);
  assertThat(stageThree?.states?.complete === 16 && !stageThree?.states?.active && !stageThree?.states?.future, `${faction}: AAA did not observe stage 3 segment states (${JSON.stringify(details.stageObservations)})`);
  assertThat(details.segments === 16 && details.visibleSegments === 16 && details.segmentStates.complete === 16, `${faction}: loading segments are not 16 complete visible cells`);
  assertThat(details.integerRects, `${faction}: loading segment rectangles are not integer geometry`);
  assertThat(details.card?.width === 704 && details.card?.height === expectedHeight, `${faction} ${dimension.width}x${dimension.height}: loading panel is ${JSON.stringify(details.card)}`);
  assertThat(details.card.x >= 24 && details.card.right <= dimension.width - 24 && dimension.height - details.card.bottom >= 24, `${faction} ${dimension.width}x${dimension.height}: loading panel misses safe area`);
  assertThat(details.track?.width === 640 && details.track?.height === 20, `${faction}: loading track is ${JSON.stringify(details.track)}`);
  assertThat(details.metadata === `${expectedCivilization} · Veteran · Deterministic seed 424242`, `${faction}: loading metadata is ${details.metadata}`);
  assertThat(details.tip === 'Survey the center before you commit your first production line.', `${faction}: loading tip changed`);
  assertThat(details.sigil.includes(`${faction}-sigil.svg`), `${faction}: authored sigil is ${details.sigil}`);
  assertThat(Object.keys(config).every((key) => details.config?.[key] === config[key]), `${faction}: loading config changed (${JSON.stringify(details.config)})`);
  assertThat(details.overflow.width <= dimension.width && details.overflow.height <= dimension.height, `${faction}: loading document overflow`);
  if (reducedMotion) assertThat(details.reducedMotion && details.activeAnimation === 'none', `${faction}: Reduced Motion loading animation is ${details.activeAnimation}`);
}

function evidenceFile(faction, mode, viewport, reducedMotion = false) {
  const suffix = reducedMotion ? '-reduced-motion' : '';
  const dimension = `${viewport.width}x${viewport.height}`;
  return path.join(OUTPUT_DIR, `${faction}-${mode}-${dimension}${suffix}.png`);
}

async function captureMenu(browser, baseUrl, faction, viewport) {
  const context = await createContext(browser, faction, viewport);
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = attachErrorCapture(page);
  try {
    await page.goto(`${baseUrl}/desktop.html`, { waitUntil: 'load', timeout: TIMEOUT_MS });
    await page.getByRole('button', { name: /^New Skirmish(?:\s|$)/i }).waitFor({ state: 'visible' });
    await delay(600);
    const details = await assertScene(page, faction, 'menu', viewport, errors);
    const file = evidenceFile(faction, 'menu', viewport);
    await page.screenshot({ path: file, type: 'png' });
    return { faction, mode: 'menu', viewport, file, details };
  } finally {
    await context.close();
  }
}

async function captureLoading(browser, baseUrl, faction, viewport, reducedMotion = false) {
  const context = await createContext(browser, faction, viewport, reducedMotion);
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  const errors = attachErrorCapture(page);
  try {
    await page.goto(`${baseUrl}/desktop.html?qa-hold-loading=1`, { waitUntil: 'load', timeout: TIMEOUT_MS });
    await page.getByRole('button', { name: /^New Skirmish(?:\s|$)/i }).click();
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
    await configureLoading(page, faction);
    await page.getByRole('button', { name: /^Start Match(?:\s|$)/i }).click();
    await page.locator('.front-loading-screen').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('.front-loading-screen')?.getAttribute('data-loading-scene-ready') === 'true');
    await page.waitForFunction(() => document.querySelector('.front-loading-screen')?.getAttribute('data-loading-match-ready') === 'true');
    const details = await assertScene(page, faction, 'loading', viewport, errors);
    const loading = await readLoadingDetails(page);
    assertLoadingDetails(loading, faction, viewport, reducedMotion);
    const file = evidenceFile(faction, 'loading', viewport, reducedMotion);
    await page.screenshot({ path: file, type: 'png' });
    assertThat(await page.locator('.front-loading-screen').isVisible(), `${faction}: loading hid before LOAD_READY`);
    const transition = await page.evaluate(() => globalThis.__STARHAVEN_QA__?.dispatch('LOAD_READY') ?? null);
    assertThat(transition?.accepted === true, `${faction}: LOAD_READY rejected (${JSON.stringify(transition)})`);
    await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Playing');
    await page.locator('.front-loading-screen').waitFor({ state: 'hidden' });
    const finalProbe = await page.evaluate(() => globalThis.__STARHAVEN_QA__ ? JSON.parse(JSON.stringify(globalThis.__STARHAVEN_QA__)) : null);
    assertThat(finalProbe?.resetCount === 1, `${faction}: reset count after LOAD_READY is ${finalProbe?.resetCount}`);
    assertThat(errors.length === 0, `${faction}/${viewport.width}x${viewport.height}: browser/asset errors:\n${errors.join('\n')}`);
    return { faction, mode: 'loading', viewport, file, details: { scene: details, loading, finalProbe } };
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
      for (const viewport of DIMENSIONS) {
        for (const mode of MODES) {
          try {
            const result = mode === 'menu'
              ? await captureMenu(browser, server.url, faction, viewport)
              : await captureLoading(browser, server.url, faction, viewport);
            results.push({ ...result, status: 'PASS' });
          } catch (error) {
            const message = error?.stack || error?.message || String(error);
            failures.push(`${faction}/${mode}/${viewport.width}x${viewport.height}: ${message}`);
            results.push({ faction, mode, viewport, status: 'FAIL', error: message });
          }
        }
      }
      try {
        const result = await captureLoading(browser, server.url, faction, { width: 1366, height: 1024 }, true);
        results.push({ ...result, status: 'PASS' });
      } catch (error) {
        const message = error?.stack || error?.message || String(error);
        failures.push(`${faction}/loading/reduced-motion: ${message}`);
        results.push({ faction, mode: 'loading', reducedMotion: true, status: 'FAIL', error: message });
      }
    }
  } finally {
    await browser?.close();
    await stopPreview(server);
  }

  console.log('AAA front-end QA results');
  console.log('status | faction | mode | viewport | sampled colors | screenshot');
  for (const result of results) {
    const colors = result.details?.distinctColors ?? 'n/a';
    const viewport = result.viewport ? `${result.viewport.width}x${result.viewport.height}` : 'n/a';
    console.log(`${result.status} | ${result.faction} | ${result.mode}${result.reducedMotion ? ' reduced-motion' : ''} | ${viewport} | ${colors} | ${result.file ?? 'not written'}`);
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
