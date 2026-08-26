#!/usr/bin/env node
// Starhaven self-view harness — one composited board for blind visual critics.
//
// Captures every ?qa= route (plus camera/selection extras) from a real dev-server
// boot, verifies each against the runtime probe, then composes ALL states into a
// single labeled board image so one critic pass can judge cross-state coherence:
// shared palette weight, unit scale, HUD density, faction identity.
//
// Outputs (directory must be outside the repo):
//   cells/<route>-<orientation>.png   raw per-route captures
//   self-view.png                     the single review board
//   manifest.json                     probe/metrics/gates per cell
//
// Usage: node scripts/self-view-harness.mjs --out /abs/path [--url http://...] [--seed 24291]
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_VIEWPORT = { width: 1366, height: 1024 };
const NAV_TIMEOUT_MS = 30000;
const PROBE_TIMEOUT_MS = 20000;
const PERF_WARMUP_MS = 2600; // > 120-frame probe ring @60fps so boot spikes flush
const FRAME_SAMPLE_MS = 800;
// Absolute p99 budget is enforced ONLY when --gate-p99=<ms> is passed. On hosts
// without a GPU (SwiftShader software WebGL) frame times are dominated by
// emulated rasterization, not game code, so the budget does not transfer.
const P99_BUDGET_MS = null;
const CELL_DISPLAY_W = 480; // board cell width in CSS px
const PALETTE_ADHERENCE_MIN = 0.35; // soft floor; below this a cell is flagged

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith('--')) continue;
    const eq = raw.indexOf('=');
    const key = eq === -1 ? raw.slice(2) : raw.slice(2, eq);
    if (eq !== -1) {
      opts[key] = raw.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next != null && !next.startsWith('--')) {
        opts[key] = next;
        i += 1;
      } else {
        opts[key] = true;
      }
    }
  }
  return opts;
}

function fail(message) {
  console.error(`self-view: ${message}`);
  process.exitCode = 1;
  process.exit(1);
}

function resolveOut(raw) {
  if (raw == null || raw === true || String(raw).trim() === '') {
    fail('--out is required (absolute path outside the repo)');
  }
  const abs = path.resolve(String(raw).trim());
  const rel = path.relative(REPO_ROOT, abs);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    fail(`--out must be outside the repository (${REPO_ROOT})`);
  }
  return abs;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- repo-source parsers (routes/states/palette stay in sync with src) ---

function parseQaScenarios() {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'src', 'qa-scenarios.ts'), 'utf8');
  const scenarios = [];
  const re = /makeScenario\(\s*'([a-z0-9-]+)',\s*'([A-Za-z]+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) scenarios.push({ id: m[1], expectedState: m[2] });
  if (scenarios.length === 0) fail('could not parse scenarios from src/qa-scenarios.ts');
  return scenarios;
}

function parsePalette() {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'src', 'palette.ts'), 'utf8');
  const tokens = [];
  const re = /(\w+):\s*'(#[0-9A-Fa-f]{6})'/g;
  let m;
  while ((m = re.exec(src)) !== null) tokens.push({ name: m[1], hex: m[2] });
  if (tokens.length === 0) fail('could not parse palette from src/palette.ts');
  return tokens;
}

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// --- dev server (pattern from qa-m0.mjs) ---

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('no local QA port'));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function startDevServer() {
  const port = await findOpenPort();
  const url = `http://127.0.0.1:${port}`;
  const viteBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'vite');
  const child = spawn(viteBin, ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'ignore', 'pipe'],
    env: process.env,
    detached: true,
  });
  const state = { child, exited: false, url };
  child.on('exit', () => { state.exited = true; });
  child.stderr.on('data', () => {});
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (state.exited) break;
    try {
      await fetch(url, { signal: AbortSignal.timeout(1200) });
      return state;
    } catch {}
    await delay(300);
  }
  await stopDevServer(state);
  throw new Error('dev server did not become reachable');
}

async function stopDevServer(server) {
  if (!server || !server.child || server.stopped) return;
  server.stopped = true;
  const child = server.child;
  const kill = (signal) => {
    if (child.pid == null || child.exitCode !== null || child.signalCode !== null) return;
    try { process.kill(-child.pid, signal); } catch { try { child.kill(signal); } catch {} }
  };
  if (!server.exited) {
    kill('SIGTERM');
    await Promise.race([once(child, 'exit').catch(() => {}), delay(3000)]);
    kill('SIGKILL');
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
}

// --- capture ---

async function launchBrowser() {
  const attempts = [
    { channel: 'chrome' },
    { executablePath: '/usr/bin/chromium' },
    {},
  ];
  let lastErr;
  for (const opts of attempts) {
    try {
      return await chromium.launch({ headless: true, ...opts, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('no chromium available');
}

async function settleFrames(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function captureRoute(context, { url, shotPath, samplePerf, p99Budget = null }) {
  const result = { url, ok: true, errors: [], probeState: null, seed: null, p99Ms: null, fps: null };
  const page = await context.newPage();
  try {
    page.on('console', (msg) => { if (msg.type() === 'error') result.errors.push(`console.error: ${msg.text()}`); });
    page.on('pageerror', (err) => result.errors.push(`pageerror: ${err?.message ?? String(err)}`));
    await page.setViewportSize(DEFAULT_VIEWPORT);
    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(() => Boolean(globalThis.__STARHAVEN_QA__), null, { timeout: PROBE_TIMEOUT_MS });
    const qa = await page.evaluate(() => JSON.parse(JSON.stringify(globalThis.__STARHAVEN_QA__)));
    result.probeState = qa?.state ?? qa?.stateName ?? null;
    const cfg = qa?.config ?? {};
    result.seed = cfg.seed ?? null;
    await settleFrames(page);
    if (samplePerf) {
      await page.waitForTimeout(PERF_WARMUP_MS);
      const deltas = await page.evaluate(
        (durationMs) =>
          new Promise((resolve) => {
            const samples = [];
            let last = performance.now();
            const end = last + durationMs;
            function tick(now) {
              if (now >= end) { resolve(samples); return; }
              samples.push(now - last);
              last = now;
              requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
          }),
        FRAME_SAMPLE_MS,
      );
      const p99 = (() => {
        if (!deltas.length) return null;
        const sorted = [...deltas].sort((a, b) => a - b);
        return sorted[Math.min(sorted.length - 1, Math.ceil(0.99 * sorted.length) - 1)];
      })();
      result.p99Ms = p99 == null ? null : Math.round(p99 * 100) / 100;
      const gameP99 = await page.evaluate(() => globalThis.__STARHAVEN_QA__?.p99FrameMs ?? null);
      const effective = gameP99 != null ? gameP99 : result.p99Ms;
      result.p99GateMs = p99Budget;
      if (p99Budget != null && !(effective < p99Budget)) {
        result.errors.push(`game-work p99 ${effective}ms exceeds ${p99Budget}ms`);
      }
      result.fps = await page.evaluate(() => globalThis.__STARHAVEN_QA__?.fps ?? null);
    }
    await page.screenshot({ path: shotPath, type: 'png' });
  } catch (err) {
    result.errors.push(`runtime: ${err?.message ?? String(err)}`);
  } finally {
    try { await page.close(); } catch {}
  }
  result.ok = result.errors.length === 0;
  return result;
}

// --- pixel analysis ---

function analyzeCell(file, paletteRgb) {
  const png = PNG.sync.read(fs.readFileSync(file));
  let min = 255, max = 0, sum = 0, count = 0, lit = 0;
  const colorCounts = new Map();
  for (let y = 0; y < png.height; y += 7) {
    for (let x = 0; x < png.width; x += 7) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum < min) min = lum;
      if (lum > max) max = lum;
      sum += lum;
      count += 1;
      if (lum > 10) lit += 1;
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
    }
  }
  let adherent = 0;
  for (const [key, n] of colorCounts) {
    const r = ((key >> 10) & 31) << 3;
    const g = ((key >> 5) & 31) << 3;
    const b = (key & 31) << 3;
    let best = Infinity;
    for (const [pr, pg, pb] of paletteRgb) {
      const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (d < best) best = d;
    }
    if (best <= 1600) adherent += n; // within 40 RGB units of some palette token
  }
  return {
    width: png.width,
    height: png.height,
    minLuma: Math.round(min * 100) / 100,
    maxLuma: Math.round(max * 100) / 100,
    meanLuma: Math.round((sum / Math.max(1, count)) * 100) / 100,
    litRatio: Math.round((lit / Math.max(1, count)) * 10000) / 10000,
    distinctColors: colorCounts.size,
    paletteAdherence: Math.round((adherent / Math.max(1, count)) * 10000) / 10000,
  };
}

// --- board composition (in-browser for crisp labels) ---

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function composeBoard(page, { cells, palette, extras, meta, outFile }) {
  const dataUrl = (file) => (fs.existsSync(file) ? `data:image/png;base64,${fs.readFileSync(file).toString('base64')}` : '');
  const cellHtml = (entry, section) => {
    const failed = !entry.ok || entry.gates.length > 0;
    const metricBits = [
      escapeHtml(entry.probeState ?? 'no-probe'),
      entry.p99Ms != null ? `p99 ${entry.p99Ms}ms` : null,
      entry.image ? `pal ${Math.round(entry.image.paletteAdherence * 100)}%` : null,
    ].filter(Boolean);
    return `
      <div class="cell ${failed ? 'fail' : ''}">
        <img src="${dataUrl(entry.file)}" />
        <div class="cap">
          <div class="name">${escapeHtml(entry.label)}</div>
          <div class="meta">${metricBits.join(' · ')}</div>
          ${entry.gates.length ? `<div class="gate">${escapeHtml(entry.gates.join(' | '))}</div>` : ''}
        </div>
        <div class="tag">${escapeHtml(section)}</div>
      </div>`;
  };
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; background: #0B0A12; color: #F0E7D2; font: 12px/1.35 ui-monospace, Menlo, Consolas, monospace; }
  .wrap { padding: 18px 20px 24px; width: ${(CELL_DISPLAY_W + 14) * 4 + 8}px; box-sizing: content-box; }
  h1 { font-size: 15px; margin: 0 0 2px; letter-spacing: .06em; }
  .sub { color: #9CA6A5; font-size: 11px; margin-bottom: 14px; }
  h2 { font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: #D09A4E; margin: 18px 0 8px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px 14px; }
  .cell { position: relative; border: 1px solid #2A203B; background: #171326; }
  .cell.fail { border-color: #B84B45; }
  .cell img { display: block; width: 100%; height: auto; }
  .cap { padding: 5px 7px 6px; }
  .name { font-weight: 700; font-size: 11px; }
  .meta { color: #9CA6A5; font-size: 10px; margin-top: 1px; }
  .gate { color: #B84B45; font-size: 10px; margin-top: 2px; }
  .tag { position: absolute; top: 4px; left: 4px; background: rgba(11,10,18,.78); color: #D6B98A;
         font-size: 9px; padding: 1px 5px; letter-spacing: .08em; }
  .swatches { display: flex; flex-wrap: wrap; gap: 6px; }
  .sw { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #2A203B; padding: 2px 6px 2px 2px; }
  .chip { width: 16px; height: 16px; display: inline-block; }
  .sw span { font-size: 10px; color: #D4D8D0; }
</style></head><body>
<div class="wrap">
  <h1>STARHAVEN SELF-VIEW</h1>
  <div class="sub">${escapeHtml(meta.line)}</div>
  <h2>Palette (${palette.length})</h2>
  <div class="swatches">${palette.map((t) => `<div class="sw"><span class="chip" style="background:${t.hex}"></span><span>${escapeHtml(t.name)}</span></div>`).join('')}</div>
  <h2>Routes (${cells.length})</h2>
  <div class="grid">${cells.map((c) => cellHtml(c, c.orientation)).join('')}</div>
  <h2>Camera &amp; selection</h2>
  <div class="grid">${extras.map((c) => cellHtml(c, c.label)).join('')}</div>
</div>
</body></html>`;
  await page.setViewportSize({ width: 1560, height: 900 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(250);
  await page.screenshot({ path: outFile, fullPage: true });
}

// --- main ---

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const outDir = resolveOut(argv.out);
  const scenarios = parseQaScenarios();
  const palette = parsePalette();
  const paletteRgb = palette.map((t) => hexToRgb(t.hex));
  const seed = argv.seed && argv.seed !== true ? Number(argv.seed) : 24291;
  const p99Budget = argv['gate-p99'] != null && argv['gate-p99'] !== true ? Number(argv['gate-p99']) : P99_BUDGET_MS;

  const cellsDir = path.join(outDir, 'cells');
  fs.mkdirSync(cellsDir, { recursive: true });

  const manifest = {
    tool: 'self-view-harness',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: { out: outDir, providedUrl: Boolean(argv.url && argv.url !== true), seed },
    routes: [],
    extras: [],
    board: null,
    failures: [],
    fatal: null,
    ok: false,
  };

  let server = null;
  let browser = null;
  try {
    let baseUrl = argv.url && argv.url !== true ? String(argv.url).replace(/\/+$/, '') : null;
    if (!baseUrl) {
      console.log('self-view: starting dev server');
      server = await startDevServer();
      baseUrl = server.url;
    }
    console.log(`self-view: base ${baseUrl}`);

    browser = await launchBrowser();
    const context = await browser.newContext({ viewport: DEFAULT_VIEWPORT, deviceScaleFactor: 1 });

    for (const scenario of scenarios) {
      const orientation = 'landscape-left';
      const file = path.join(cellsDir, `${scenario.id}-${orientation}.png`);
      const url = `${baseUrl}/?qa=${encodeURIComponent(scenario.id)}&orientation=${orientation}`;
      const cap = await captureRoute(context, { url, shotPath: file, samplePerf: true, p99Budget });
      const entry = {
        label: scenario.id,
        orientation,
        expectedState: scenario.expectedState,
        probeState: cap.probeState,
        seed: cap.seed,
        p99Ms: cap.p99Ms,
        fps: cap.fps,
        url: cap.url,
        file,
        errors: cap.errors,
        gates: [],
        image: null,
        ok: false,
      };
      if (cap.probeState !== scenario.expectedState) entry.gates.push(`state ${cap.probeState} != ${scenario.expectedState}`);
      if (fs.existsSync(file)) {
        try {
          entry.image = analyzeCell(file, paletteRgb);
          if (entry.image.maxLuma <= 6) entry.gates.push('capture black');
          else if (entry.image.litRatio < 0.002) entry.gates.push('capture empty');
          if (entry.image.paletteAdherence < PALETTE_ADHERENCE_MIN) entry.gates.push(`palette adherence ${entry.image.paletteAdherence}`);
        } catch (err) {
          entry.gates.push(`analyze: ${err?.message ?? err}`);
        }
      } else {
        entry.gates.push('capture missing');
      }
      entry.ok = entry.gates.length === 0 && cap.errors.length === 0;
      manifest.routes.push(entry);
      for (const e of entry.gates) manifest.failures.push(`${scenario.id}: ${e}`);
      for (const e of cap.errors) manifest.failures.push(`${scenario.id}: ${e}`);
      console.log(`self-view: ${scenario.id} ok=${entry.ok}${entry.gates.length ? ` gates=[${entry.gates.join('; ')}]` : ''}`);
    }

    const extraSpecs = [
      { id: 'ui-free', query: 'ui=0', mutate: null },
      { id: 'selected-scout', query: '', selectScout: true },
      { id: 'close', halfH: 5 },
      { id: 'far', halfH: 18 },
    ];
    for (const spec of extraSpecs) {
      const file = path.join(cellsDir, `extra-${spec.id}.png`);
      let url = `${baseUrl}/?qa=opening&orientation=landscape-left`;
      if (spec.query) url += `&${spec.query}`;
      const cap = await captureRoute(context, { url, shotPath: file, samplePerf: false });
      if (spec.halfH != null || spec.selectScout) {
        const page = await context.newPage();
        try {
          await page.setViewportSize(DEFAULT_VIEWPORT);
          await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
          await page.waitForFunction(() => Boolean(globalThis.__STARHOLD_INPUT__), null, { timeout: PROBE_TIMEOUT_MS });
          await page.evaluate((value) => {
            const input = globalThis.__STARHOLD_INPUT__;
            if (value && value.halfH != null) input.halfH = value.halfH;
            if (value && value.selectScout) input.focusScout();
          }, { halfH: spec.halfH ?? null, selectScout: Boolean(spec.selectScout) });
          await settleFrames(page);
          await page.screenshot({ path: file, type: 'png' });
          cap.errors.length = 0;
          cap.ok = true;
        } catch (err) {
          cap.errors.push(`mutate: ${err?.message ?? String(err)}`);
          cap.ok = false;
        } finally {
          try { await page.close(); } catch {}
        }
      }
      const entry = {
        label: spec.id,
        url,
        file,
        errors: cap.errors,
        gates: [],
        image: null,
        ok: false,
      };
      if (fs.existsSync(file)) {
        try {
          entry.image = analyzeCell(file, paletteRgb);
          if (entry.image.maxLuma <= 6) entry.gates.push('capture black');
        } catch (err) {
          entry.gates.push(`analyze: ${err?.message ?? err}`);
        }
      } else {
        entry.gates.push('capture missing');
      }
      entry.ok = entry.gates.length === 0 && cap.errors.length === 0;
      manifest.extras.push(entry);
      for (const e of entry.gates) manifest.failures.push(`extra-${spec.id}: ${e}`);
      for (const e of cap.errors) manifest.failures.push(`extra-${spec.id}: ${e}`);
      console.log(`self-view: extra ${spec.id} ok=${entry.ok}`);
    }

    const boardFile = path.join(outDir, 'self-view.png');
    const boardPage = await context.newPage();
    try {
      await composeBoard(boardPage, {
        cells: manifest.routes,
        extras: manifest.extras,
        palette,
        meta: {
          line: `${scenarios.length} routes · seed ${manifest.routes[0]?.seed ?? seed} · ${DEFAULT_VIEWPORT.width}x${DEFAULT_VIEWPORT.height} · palette ${palette.length} tokens · ${new Date().toISOString().slice(0, 19)}Z`,
        },
        outFile: boardFile,
      });
      manifest.board = { file: boardFile, ok: fs.existsSync(boardFile) };
    } finally {
      try { await boardPage.close(); } catch {}
    }

    manifest.ok = manifest.failures.length === 0 && manifest.board?.ok === true;
  } catch (err) {
    manifest.fatal = err?.stack ?? String(err);
    manifest.ok = false;
  } finally {
    try { if (browser) await browser.close(); } catch {}
    try { await stopDevServer(server); } catch {}
    manifest.finishedAt = new Date().toISOString();
    const manifestPath = path.join(outDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const passed = manifest.routes.filter((r) => r.ok).length;
    console.log('--- self-view summary ---');
    console.log(`ok=${manifest.ok} routes=${manifest.routes.length}/${passed} extras=${manifest.extras.filter((e) => e.ok).length}/${manifest.extras.length}`);
    console.log(`board=${manifest.board?.file ?? 'n/a'}`);
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
  console.error(`self-view: fatal: ${err?.stack ?? err}`);
  process.exitCode = 1;
});
