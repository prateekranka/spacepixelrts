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
const DEFAULT_BASE = 'http://127.0.0.1:5173';
const DEFAULT_ROUTES =
  'start-menu,match-setup,opening,scouting,tech-choice,midgame-sunweaver,midgame-gravemark,battle,victory,loading,tactical-pause,defeat,results'.split(',');
const DEFAULT_ORIENTATIONS = 'landscape-left,landscape-right'.split(',');
const DEFAULT_VIEWPORT = { width: 1366, height: 1024 };
const DEFAULT_SEED = 0x5eed;
const SERVER_BOOT_TIMEOUT_MS = 120000;
const NAV_TIMEOUT_MS = 30000;
const PROBE_TIMEOUT_MS = 20000;
const FRAME_SAMPLE_MS = 1000;
const PERF_WARMUP_MS = 2300;
const P99_BUDGET_MS = 8;
const HALF_H_CLOSE = 5;
const HALF_H_FAR = 18;
const EXPECTED_STATES = {
  'start-menu': 'MainMenu',
  'match-setup': 'MatchSetup',
  opening: 'Playing',
  scouting: 'Playing',
  'tech-choice': 'Playing',
  'midgame-sunweaver': 'Playing',
  'midgame-gravemark': 'Playing',
  battle: 'Playing',
  victory: 'Victory',
  loading: 'Loading',
  'tactical-pause': 'TacticalPause',
  defeat: 'Defeat',
  results: 'Results',
};

function parseArgs(argv) {
  const opts = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const eq = raw.indexOf('=');
    const key = eq === -1 ? raw.slice(2) : raw.slice(2, eq);
    const value = eq === -1 ? true : raw.slice(eq + 1);
    opts[key] = value;
  }
  return opts;
}

function fail(message) {
  console.error(`qa-m0: ${message}`);
  process.exitCode = 1;
  process.exit(1);
}

function parseViewport(spec) {
  const fallback = spec == null || spec === true ? null : String(spec);
  if (fallback == null) return { ...DEFAULT_VIEWPORT };
  const m = /^(\d{2,5})[xX](\d{2,5})$/.exec(fallback.trim());
  if (!m) fail(`invalid --viewport "${fallback}" (expected WxH)`);
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (width < 64 || width > 8192 || height < 64 || height > 8192) fail(`viewport out of range: ${fallback}`);
  return { width, height };
}

function parseList(spec, fallback) {
  if (spec == null || spec === true) return [...fallback];
  const parts = String(spec)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) fail(`list argument produced an empty set`);
  return parts;
}

function parseSeed(spec) {
  if (spec == null || spec === true) return DEFAULT_SEED;
  const n = Number(String(spec).trim());
  if (!Number.isFinite(n) || n < 0) fail(`invalid --seed "${spec}"`);
  return n;
}

function resolveOut(raw) {
  if (raw == null || raw === true || String(raw).trim() === '') fail('--out is required (absolute path outside the repo)');
  const supplied = String(raw).trim();
  if (!path.isAbsolute(supplied)) fail('--out must be an absolute path');
  const abs = path.resolve(supplied);
  const rel = path.relative(REPO_ROOT, abs);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    fail(`--out must be outside the repository working directory (${REPO_ROOT})`);
  }
  return abs;
}

function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startDevServer() {
  const port = await findOpenPort();
  const url = `http://127.0.0.1:${port}`;
  const viteBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'vite');
  const child = spawn(viteBin, ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    detached: true,
  });
  const state = { child, exited: false, url };
  child.on('exit', () => {
    state.exited = true;
  });
  const pump = (stream, label) => {
    stream.setEncoding('utf8');
    let pending = '';
    stream.on('data', (chunk) => {
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop();
      for (const line of lines) {
        if (line.trim()) console.log(`${label} ${line}`);
      }
    });
    stream.on('end', () => {
      if (pending.trim()) console.log(`${label} ${pending}`);
    });
  };
  pump(child.stdout, '[dev]');
  pump(child.stderr, '[dev:err]');
  const deadline = Date.now() + SERVER_BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (state.exited) break;
    try {
      await fetch(url, { signal: AbortSignal.timeout(1200) });
      state.ready = true;
      return state;
    } catch {}
    await delay(300);
  }
  await stopDevServer(state);
  throw new Error(state.exited ? 'dev server exited before becoming reachable' : `dev server did not become reachable at ${url}`);
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

async function stopDevServer(server) {
  if (!server || !server.child || server.stopped) return;
  server.stopped = true;
  const child = server.child;
  const sendSignal = (signal) => {
    if (child.pid == null || child.exitCode !== null || child.signalCode !== null) return;
    try {
      process.kill(-child.pid, signal);
    } catch {
      try {
        child.kill(signal);
      } catch {}
    }
  };
  if (!server.exited) {
    sendSignal('SIGTERM');
    const graceful = await Promise.race([
      once(child, 'exit').then(
        () => true,
        () => true,
      ),
      delay(4000).then(() => false),
    ]);
    if (!graceful && !server.exited && child.exitCode === null && child.signalCode === null) {
      sendSignal('SIGKILL');
      await Promise.race([
        once(child, 'exit').catch(() => {}),
        delay(2000),
      ]);
    }
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
}

function normalizeBaseUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl));
  } catch {
    fail(`invalid --url "${rawUrl}"`);
  }
  const base = `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, '');
  return base || DEFAULT_BASE;
}

async function settleFrames(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

function toNumberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function summarizeProbe(qa) {
  if (!qa || typeof qa !== 'object') return null;
  const cfg = qa.config && typeof qa.config === 'object' ? qa.config : {};
  return {
    scenario: qa.scenario ?? qa.scenarioName ?? qa.name ?? null,
    state: qa.state ?? qa.stateName ?? qa.phase ?? null,
    seed: toNumberOrNull(cfg.seed ?? qa.seed ?? cfg.seedHex),
    fps: toNumberOrNull(qa.fps),
    p99FrameMs: toNumberOrNull(qa.p99FrameMs),
    config: Object.keys(cfg).length ? cfg : null,
    rawKeys: Object.keys(qa),
  };
}

function verifyProbe(result, route, expectedSeed) {
  const probe = result.probe;
  if (!probe) {
    result.errors.push('probe missing: __STARHAVEN_QA__ did not expose scenario/state');
    return;
  }
  if (probe.scenario !== route) {
    result.errors.push(`probe scenario mismatch: ${JSON.stringify(probe.scenario)} != ${JSON.stringify(route)}`);
  }
  if (typeof probe.state !== 'string' || probe.state.length === 0) {
    result.errors.push(`probe state missing: ${JSON.stringify(probe.state)}`);
  } else if (probe.state !== EXPECTED_STATES[route]) {
    result.errors.push(`probe state mismatch: ${probe.state} != ${EXPECTED_STATES[route]}`);
  }
  if (probe.seed !== expectedSeed) {
    result.errors.push(`probe seed mismatch: ${JSON.stringify(probe.seed)} != ${expectedSeed}`);
  }
  const config = probe.config;
  if (!config || config.map !== 'helios-rift' || config.seedMode !== 'deterministic') {
    result.errors.push('probe config is not canonical deterministic Helios Rift');
  }
  if (!config || !['sunweaver', 'gravemark'].includes(config.playerFaction) ||
      !['sunweaver', 'gravemark'].includes(config.aiFaction) ||
      config.playerFaction === config.aiFaction) {
    result.errors.push('probe faction config is invalid');
  }
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

function round2(n) {
  return n == null ? null : Math.round(n * 100) / 100;
}

function analyzePng(file, expectedWidth, expectedHeight) {
  const png = PNG.sync.read(fs.readFileSync(file));
  if (png.width !== expectedWidth || png.height !== expectedHeight) {
    throw new Error(`png size ${png.width}x${png.height} != ${expectedWidth}x${expectedHeight}`);
  }
  const data = png.data;
  let min = 255;
  let max = 0;
  let sum = 0;
  let count = 0;
  let lit = 0;
  for (let i = 0; i < data.length; i += 28) {
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (lum < min) min = lum;
    if (lum > max) max = lum;
    sum += lum;
    count += 1;
    if (lum > 10) lit += 1;
  }
  const mean = count ? sum / count : 0;
  const report = {
    width: png.width,
    height: png.height,
    minLuma: round2(min),
    maxLuma: round2(max),
    meanLuma: round2(mean),
    litRatio: round2(count ? lit / count : 0),
  };
  if (max <= 6) throw new Error(`png looks black (maxLuma ${report.maxLuma})`);
  if (report.litRatio < 0.002) throw new Error(`png looks empty (litRatio ${report.litRatio})`);
  if (mean < 4) throw new Error(`png low-range (meanLuma ${report.meanLuma})`);
  return report;
}

function buildContactSheet(files, cellW, cellH, columns, rows, outFile) {
  const sheet = new PNG({ width: cellW * columns, height: cellH * rows });
  files.forEach((file, index) => {
    const img = PNG.sync.read(fs.readFileSync(file));
    const col = index % columns;
    const row = Math.floor(index / columns);
    const dx = col * cellW;
    const dy = row * cellH;
    const sxRatio = img.width / cellW;
    const syRatio = img.height / cellH;
    for (let y = 0; y < cellH; y++) {
      const sy = Math.min(img.height - 1, Math.floor(y * syRatio));
      for (let x = 0; x < cellW; x++) {
        const sx = Math.min(img.width - 1, Math.floor(x * sxRatio));
        const si = (sy * img.width + sx) * 4;
        const di = ((dy + y) * sheet.width + (dx + x)) * 4;
        sheet.data[di] = img.data[si];
        sheet.data[di + 1] = img.data[si + 1];
        sheet.data[di + 2] = img.data[si + 2];
        sheet.data[di + 3] = img.data[si + 3];
      }
    }
  });
  fs.writeFileSync(outFile, PNG.sync.write(sheet));
}

async function capturePage(context, { url, label, shotPath, viewport, expectedSeed, verifyScenario, mutateHalfH, samplePerf }) {
  const page = await context.newPage();
  const result = {
    label,
    url,
    ok: true,
    errors: [],
    probe: null,
    p99Ms: null,
    rafP99Ms: null,
    fps: null,
    frames: 0,
    draws: null,
    entities: null,
    heapUsedBytes: null,
    screenshot: shotPath ? path.basename(shotPath) : null,
    image: null,
  };
  try {
    page.on('console', (msg) => {
      if (msg.type() === 'error') result.errors.push(`console.error: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      result.errors.push(`pageerror: ${err?.message ?? String(err)}`);
    });
    await page.setViewportSize(viewport);
    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(() => Boolean(globalThis.__STARHAVEN_QA__), null, { timeout: PROBE_TIMEOUT_MS });
    const qa = await page.evaluate(() => JSON.parse(JSON.stringify(globalThis.__STARHAVEN_QA__)));
    result.probe = summarizeProbe(qa);
    if (verifyScenario) verifyProbe(result, verifyScenario, expectedSeed);
    await settleFrames(page);
    if (mutateHalfH != null) {
      await page.evaluate((value) => {
        const input = globalThis.__STARHOLD_INPUT__;
        if (!input) throw new Error('__STARHOLD_INPUT__ missing');
        input.halfH = value;
      }, mutateHalfH);
      await settleFrames(page);
    }
    if (samplePerf) {
      await page.waitForTimeout(PERF_WARMUP_MS);
      const deltas = await page.evaluate(
        (durationMs) =>
          new Promise((resolve) => {
            const samples = [];
            let last = performance.now();
            const end = last + durationMs;
            function tick(now) {
              if (now >= end) {
                resolve(samples);
                return;
              }
              samples.push(now - last);
              last = now;
              requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
          }),
        FRAME_SAMPLE_MS,
      );
      result.frames = deltas.length;
      const p99 = percentile(deltas, 0.99);
      result.rafP99Ms = p99 == null ? null : round2(p99);
      const stats = await page.evaluate(() => {
        const q = globalThis.__STARHAVEN_QA__;
        const pick = (...keys) => {
          for (const key of keys) {
            const v = q?.[key];
            if (v != null) return v;
          }
          return null;
        };
        return {
          draws: pick('draws', 'frameDraws') ?? q?.stats?.draws ?? q?.metrics?.draws ?? null,
          entities: pick('entities', 'entityCount') ?? q?.stats?.entities ?? q?.stats?.entityCount ?? q?.metrics?.entities ?? null,
          p99FrameMs: pick('p99FrameMs'),
          fps: pick('fps'),
          heap:
            typeof performance !== 'undefined' && performance.memory
              ? performance.memory.usedJSHeapSize
              : null,
        };
      });
      result.draws = toNumberOrNull(stats.draws);
      result.entities = toNumberOrNull(stats.entities);
      result.p99Ms = toNumberOrNull(stats.p99FrameMs);
      result.fps = toNumberOrNull(stats.fps);
      result.heapUsedBytes = toNumberOrNull(stats.heap);
      if (result.p99Ms == null || !(result.p99Ms < P99_BUDGET_MS)) {
        result.errors.push(`game-work p99 ${result.p99Ms}ms exceeds budget ${P99_BUDGET_MS}ms`);
      }
    }
    if (shotPath) {
      await page.screenshot({ path: shotPath, type: 'png' });
      result.image = analyzePng(shotPath, viewport.width, viewport.height);
    }
  } catch (err) {
    result.errors.push(`runtime: ${err?.message ?? String(err)}`);
  } finally {
    try {
      await page.close();
    } catch {}
  }
  result.ok = result.errors.length === 0;
  return result;
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const outDir = resolveOut(argv.out);
  let baseUrl = argv.url && argv.url !== true ? normalizeBaseUrl(argv.url) : null;
  const viewport = parseViewport(argv.viewport);
  const orientations = parseList(argv.orientations, DEFAULT_ORIENTATIONS);
  const seed = parseSeed(argv.seed);
  const routes = argv.route && argv.route !== true ? [String(argv.route)] : [...DEFAULT_ROUTES];

  const screensDir = path.join(outDir, 'screens');
  const extrasDir = path.join(outDir, 'extras');
  fs.mkdirSync(screensDir, { recursive: true });
  fs.mkdirSync(extrasDir, { recursive: true });

  const manifest = {
    tool: 'qa-m0',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: { out: outDir, urlProvided: Boolean(argv.url), baseUrl, viewport, seed, routes, orientations },
    spawnedDevServer: !argv.url,
    runs: [],
    extras: {},
    contactSheet: { ok: false, skipped: false, file: null, error: null },
    failures: [],
    fatal: null,
    ok: false,
  };

  let server = null;
  let browser = null;

  try {
    if (!argv.url) {
      console.log(`qa-m0: starting dev server (${REPO_ROOT})`);
      server = await startDevServer();
      baseUrl = server.url;
      manifest.args.baseUrl = baseUrl;
      console.log(`qa-m0: dev server ready at ${baseUrl}`);
    }

    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
    });
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
    });

    for (const route of routes) {
      for (const orientation of orientations) {
        const label = `${route}@${orientation}`;
        const shotPath = path.join(screensDir, `${slug(route)}-${slug(orientation)}.png`);
        const url = `${baseUrl}?qa=${encodeURIComponent(route)}&orientation=${encodeURIComponent(orientation)}`;
        const result = await capturePage(context, {
          url,
          label,
          shotPath,
          viewport,
          expectedSeed: seed,
          verifyScenario: route,
          samplePerf: true,
        });
        manifest.runs.push(result);
        for (const err of result.errors) manifest.failures.push(`${label}: ${err}`);
        console.log(`qa-m0: ${label} ok=${result.ok} p99=${result.p99Ms}ms frames=${result.frames}`);
      }
    }

    const extras = [];
    extras.push(
      await capturePage(context, {
        url: `${baseUrl}?qa=opening&orientation=landscape-left&ui=0`,
        label: 'gameplay-ui-free',
        shotPath: path.join(extrasDir, 'gameplay-ui-free.png'),
        viewport,
        expectedSeed: seed,
        verifyScenario: 'opening',
        samplePerf: false,
      }),
    );
    for (const [name, halfH] of [
      ['gameplay-close', HALF_H_CLOSE],
      ['gameplay-far', HALF_H_FAR],
    ]) {
      extras.push(
        await capturePage(context, {
          url: `${baseUrl}?qa=opening&orientation=landscape-left`,
          label: name,
          shotPath: path.join(extrasDir, `${name}.png`),
          viewport,
          expectedSeed: seed,
          verifyScenario: 'opening',
          mutateHalfH: halfH,
          samplePerf: false,
        }),
      );
    }
    for (const extra of extras) {
      manifest.extras[extra.label] = extra;
      for (const err of extra.errors) manifest.failures.push(`${extra.label}: ${err}`);
    }

    const sheetSources = ['start-menu', 'match-setup', 'opening', 'victory'].map((route) => ({
      route,
      file: path.join(screensDir, `${slug(route)}-landscape-left.png`),
    }));
    const sheetRoutes = sheetSources.map((entry) => entry.route);
    const subsetRun = sheetRoutes.some((route) => !routes.includes(route));
    const missing = sheetSources.filter((entry) => !fs.existsSync(entry.file)).map((entry) => entry.route);
    if (subsetRun) {
      manifest.contactSheet.ok = true;
      manifest.contactSheet.skipped = true;
    } else if (missing.length) {
      manifest.contactSheet.error = `missing landscape-left captures: ${missing.join(', ')}`;
      manifest.failures.push(`contact-sheet: ${manifest.contactSheet.error}`);
    } else {
      try {
        const cellW = Math.ceil(viewport.width / 2);
        const cellH = Math.ceil(viewport.height / 2);
        buildContactSheet(
          sheetSources.map((entry) => entry.file),
          cellW,
          cellH,
          2,
          2,
          path.join(extrasDir, 'contact-sheet.png'),
        );
        manifest.contactSheet.ok = true;
        manifest.contactSheet.file = 'extras/contact-sheet.png';
      } catch (err) {
        manifest.contactSheet.error = err?.message ?? String(err);
        manifest.failures.push(`contact-sheet: ${manifest.contactSheet.error}`);
      }
    }

    manifest.ok = manifest.failures.length === 0;
  } catch (err) {
    manifest.fatal = err?.stack ?? String(err);
    manifest.ok = false;
  } finally {
    try {
      if (browser) await browser.close();
    } catch {}
    try {
      await stopDevServer(server);
    } catch {}
    manifest.finishedAt = new Date().toISOString();
    const manifestPath = path.join(outDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const runsOk = manifest.runs.filter((r) => r.ok).length;
    const p99Values = manifest.runs.map((r) => r.p99Ms).filter((v) => typeof v === 'number');
    const worstP99 = p99Values.length ? Math.max(...p99Values) : null;
    console.log('--- qa-m0 summary ---');
    console.log(`ok=${manifest.ok} runs=${manifest.runs.length} passed=${runsOk} failed=${manifest.runs.length - runsOk}`);
    console.log(`worstP99=${worstP99 == null ? 'n/a' : `${worstP99}ms`} budget=${P99_BUDGET_MS}ms`);
    console.log(`extras=${Object.keys(manifest.extras).length} contactSheet=${manifest.contactSheet.ok ? 'ok' : 'failed'}`);
    console.log(`manifest=${manifestPath}`);
    if (manifest.failures.length) {
      console.log('failures:');
      for (const f of manifest.failures) console.log(`  - ${f}`);
    }
    if (manifest.fatal) console.error(manifest.fatal);
    if (!manifest.ok) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`qa-m0: fatal: ${err?.stack ?? err}`);
  process.exitCode = 1;
});
