#!/usr/bin/env node
// Forge Review Deck — capture CLI backend (npm run forge:review:capture).
//
// Serial proof-pack capture: every QA route x orientation, extras on opening,
// perspective triptych (when the FRD-2 review control is present), labeled
// contact board, console.txt, critic-brief.txt, optional proof.webm, and a
// schema-validated manifest. Exit code 0 only when manifest.valid && ok.
//
// usage:
//   node scripts/forge-capture.mjs --out=<abs dir outside repo> \
//     [--seed=424242] [--gate-p99=ms] [--clip] [--routes=a,b] \
//     [--orientations=landscape-left,landscape-right] [--url=http://...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startDevServer } from '../tools/forge-review/lib/server.mjs';
import { launchBrowser } from '../tools/forge-review/lib/browser.mjs';
import { loadPalette, loadPaletteRgb } from '../tools/forge-review/lib/pixels.mjs';
import { gitMeta } from '../tools/forge-review/lib/git-meta.mjs';
import { SCHEMA_VERSION, validateManifest, writeManifest } from '../tools/forge-review/lib/manifest.mjs';
import { buildConsoleTxt, composeCriticBrief } from '../tools/forge-review/lib/pack-artifacts.mjs';
import {
  DEFAULT_VIEWPORT,
  buildCapturePlan,
  parseScenarioTable,
  captureRouteCell,
  captureExtras,
  captureOverlayCells,
  capturePerspectiveTriptych,
  captureClip,
} from '../tools/forge-review/lib/capture.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SEED = 424242;
const MAX_SEED = 4294967295;
const ORIENTATION_IDS = ['landscape-left', 'landscape-right'];
const CELL_DISPLAY_W = 480; // board cell width in CSS px

const USAGE = `forge-capture — Forge Review Deck proof-pack capture backend

usage:
  node scripts/forge-capture.mjs --out=<abs dir outside repo> [options]

options:
  --out=<abs>             required; proof pack output dir (must be outside the repo)
  --seed=<0..4294967295>  requested deterministic seed (default ${DEFAULT_SEED})
  --gate-p99=<ms>         enforce an absolute gameWork p99 budget (default: none)
  --clip                  also record proof.webm (load -> freeze -> step -> overlay toggle)
  --routes=a,b,c          comma list of QA routes (default: all 13 from src/qa-scenarios.ts)
  --orientations=l,r      comma list of landscape-left, landscape-right (default both)
  --url=<base>            use an already-running dev server instead of spawning one
  --help                  print this message

exit codes:
  0  manifest valid AND all cells ok (no failures)
  1  anything else (validation errors, gates, runtime failures)
`;

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
  console.error(`forge-capture: ${message}`);
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

function parseSeed(raw) {
  if (raw == null || raw === true || String(raw).trim() === '') return DEFAULT_SEED;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > MAX_SEED) {
    fail(`--seed must be an integer in 0..${MAX_SEED} (got ${JSON.stringify(raw)})`);
  }
  return n;
}

function parseList(raw, validValues, what) {
  const values = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (values.length === 0) fail(`--${what} needs at least one value`);
  for (const v of values) {
    if (!validValues.includes(v)) {
      fail(`--${what} has unknown value "${v}" (expected one of ${validValues.join(', ')})`);
    }
  }
  return values;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- board composition (in-browser for crisp labels; proven CSS from self-view) ---

async function composeBoard(page, { routes, extras, perspectives, palette, meta, outFile }) {
  const dataUrl = (file) =>
    file && fs.existsSync(file) ? `data:image/png;base64,${fs.readFileSync(file).toString('base64')}` : '';
  const cellHtml = (entry) => {
    const failed = !entry.ok;
    const gates = entry.gates ?? [];
    const metricBits = [
      entry.actualState ?? 'no-probe',
      entry.tick != null ? `tick ${entry.tick}` : null,
      entry.image ? `pal ${Math.round(entry.image.paletteAdherence * 100)}%` : null,
      entry.perf?.gameWorkP99Ms != null ? `gP99 ${entry.perf.gameWorkP99Ms}ms` : null,
    ].filter(Boolean);
    const failLabel = gates.length ? `FAIL ${gates.join(' | ')}` : 'FAIL';
    return `
      <div class="cell ${failed ? 'fail' : ''}">
        <img src="${dataUrl(entry.image?.file)}" alt="${escapeHtml(entry.id)}" />
        <div class="cap">
          <div class="name">${escapeHtml(entry.id)}${failed ? ` <span class="badge">${escapeHtml(failLabel)}</span>` : ''}</div>
          <div class="meta">${metricBits.join(' · ')}</div>
        </div>
        <div class="tag">${escapeHtml(entry.kind)}</div>
      </div>`;
  };
  const section = (title, cells) =>
    cells.length
      ? `<h2>${escapeHtml(title)} (${cells.length})</h2><div class="grid">${cells.map(cellHtml).join('')}</div>`
      : `<h2>${escapeHtml(title)} (0)</h2><div class="grid empty">(none captured)</div>`;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; background: #0B0A12; color: #F0E7D2; font: 12px/1.35 ui-monospace, Menlo, Consolas, monospace; }
  .wrap { padding: 18px 20px 24px; width: ${(CELL_DISPLAY_W + 14) * 4 + 8}px; box-sizing: content-box; }
  h1 { font-size: 15px; margin: 0 0 2px; letter-spacing: .06em; }
  .sub { color: #9CA6A5; font-size: 11px; margin-bottom: 14px; }
  h2 { font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: #D09A4E; margin: 18px 0 8px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px 14px; }
  .grid.empty { color: #9CA6A5; font-size: 11px; }
  .cell { position: relative; border: 1px solid #2A203B; background: #171326; }
  .cell.fail { border-color: #B84B45; }
  .cell img { display: block; width: 100%; height: auto; min-height: 40px; }
  .cap { padding: 5px 7px 6px; }
  .name { font-weight: 700; font-size: 11px; }
  .badge { color: #B84B45; font-weight: 700; font-size: 10px; }
  .meta { color: #9CA6A5; font-size: 10px; margin-top: 1px; }
  .tag { position: absolute; top: 4px; left: 4px; background: rgba(11,10,18,.78); color: #D6B98A;
         font-size: 9px; padding: 1px 5px; letter-spacing: .08em; }
  .swatches { display: flex; flex-wrap: wrap; gap: 6px; }
  .sw { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #2A203B; padding: 2px 6px 2px 2px; }
  .chip { width: 16px; height: 16px; display: inline-block; }
  .sw span { font-size: 10px; color: #D4D8D0; }
</style></head><body>
<div class="wrap">
  <h1>STARHAVEN FORGE REVIEW</h1>
  <div class="sub">${escapeHtml(meta.line)}</div>
  <h2>Palette (${palette.length})</h2>
  <div class="swatches">${palette.map((t) => `<div class="sw"><span class="chip" style="background:${t.hex}"></span><span>${escapeHtml(t.name)}</span></div>`).join('')}</div>
  ${section('Routes', routes)}
  ${section('Extras', extras)}
  ${section('Perspectives', perspectives)}
</div>
</body></html>`;
  await page.setViewportSize({ width: 1560, height: 900 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(250);
  await page.screenshot({ path: outFile, fullPage: true });
}

// --- main -------------------------------------------------------------------

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  if (argv.help || argv.h === true) {
    process.stdout.write(USAGE);
    return;
  }
  const outDir = resolveOut(argv.out);
  const seed = parseSeed(argv.seed);
  const gateP99 = argv['gate-p99'] != null && argv['gate-p99'] !== true ? Number(argv['gate-p99']) : null;
  const clip = argv.clip === true || argv.clip === 'true';
  const orientations = argv.orientations ? parseList(argv.orientations, ORIENTATION_IDS, 'orientations') : [...ORIENTATION_IDS];

  const table = parseScenarioTable(REPO_ROOT);
  const routes = argv.routes
    ? parseList(argv.routes, table.map((s) => s.id), 'routes')
    : table.map((s) => s.id);
  const palette = loadPalette(REPO_ROOT);
  const paletteRgb = loadPaletteRgb(REPO_ROOT);
  const git = gitMeta(REPO_ROOT);

  const consoleSeq = { n: 0 };
  const webglInfo = { renderer: null, softwareRenderer: false };
  const plan = buildCapturePlan(routes, orientations);

  const manifest = {
    tool: 'forge-review-capture',
    schemaVersion: SCHEMA_VERSION,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    git,
    args: {
      out: outDir,
      seed,
      gateP99,
      clip,
      routes: [...routes],
      orientations: [...orientations],
      url: argv.url && argv.url !== true ? String(argv.url) : null,
    },
    requestedSeed: seed,
    actualSeed: null,
    viewport: { ...DEFAULT_VIEWPORT, deviceScaleFactor: 1 },
    environment: { browser: 'chromium', webglRenderer: '', softwareRenderer: false },
    pack: {
      routes: [],
      extras: [],
      perspectives: [],
      board: null,
      consoleTxt: null,
      criticBrief: null,
      clip: null,
      clipReadback: null,
    },
    failures: [],
    ok: false,
  };

  const cellsDir = path.join(outDir, 'cells');
  fs.mkdirSync(cellsDir, { recursive: true });

  let server = null;
  let browser = null;
  try {
    let baseUrl = argv.url && argv.url !== true ? String(argv.url).replace(/\/+$/, '') : null;
    if (!baseUrl) {
      console.log('forge-capture: starting dev server');
      server = await startDevServer({ repoRoot: REPO_ROOT });
      baseUrl = server.url;
    }
    console.log(`forge-capture: base ${baseUrl}`);

    browser = await launchBrowser();
    manifest.environment.browser = browser.browserType().name();
    const context = await browser.newContext({
      viewport: { width: DEFAULT_VIEWPORT.width, height: DEFAULT_VIEWPORT.height },
      deviceScaleFactor: 1,
    });

    // 4. Routes x orientations, strictly serial.
    for (const { route, orientation } of plan) {
      const scenario = table.find((s) => s.id === route);
      const file = path.join(cellsDir, `${route}-${orientation}.png`);
      const url = `${baseUrl}/?qa=${encodeURIComponent(route)}&qa-seed=${seed}&orientation=${orientation}&forge=1&forge-panel=0`;
      const cell = await captureRouteCell(context, {
        id: route,
        kind: 'route',
        orientation,
        url,
        requestedSeed: seed,
        expectedState: scenario.expectedState,
        paletteRgb,
        gateP99,
        shotPath: file,
        webglInfo,
        consoleSeq,
        requireForgeMetrics: true,
      });
      manifest.pack.routes.push(cell);
      if (manifest.actualSeed == null && cell.actualSeed != null) manifest.actualSeed = cell.actualSeed;
      for (const g of cell.gates) manifest.failures.push(`${route} ${orientation}: ${g}`);
      for (const e of cell.errors) manifest.failures.push(`${route} ${orientation}: ${e}`);
      console.log(`forge-capture: ${route} ${orientation} ok=${cell.ok}${cell.gates.length ? ` gates=[${cell.gates.join('; ')}]` : ''}`);
    }

    // 5. Extras on opening / landscape-left (only when opening was requested).
    if (routes.includes('opening')) {
      const openingCam = table.find((s) => s.id === 'opening').camera;
      const extraResult = await captureExtras(context, {
        baseUrl,
        seed,
        scenarioCamera: openingCam,
        paletteRgb,
        gateP99,
        consoleSeq,
        webglInfo,
        outDir,
      });
      manifest.pack.extras.push(...extraResult.cells);
      for (const cell of extraResult.cells) {
        for (const g of cell.gates) manifest.failures.push(`${cell.id}: ${g}`);
        for (const e of cell.errors) manifest.failures.push(`${cell.id}: ${e}`);
        console.log(`forge-capture: ${cell.id} ok=${cell.ok}${cell.gates.length ? ` gates=[${cell.gates.join('; ')}]` : ''}`);
      }
      for (const f of extraResult.failures) manifest.failures.push(f);

      const overlayResult = await captureOverlayCells(context, {
        baseUrl,
        seed,
        paletteRgb,
        gateP99,
        consoleSeq,
        webglInfo,
        outDir,
      });
      manifest.pack.extras.push(...overlayResult.cells);
      for (const cell of overlayResult.cells) {
        for (const g of cell.gates) manifest.failures.push(`${cell.id}: ${g}`);
        for (const e of cell.errors) manifest.failures.push(`${cell.id}: ${e}`);
        console.log(`forge-capture: ${cell.id} ok=${cell.ok}${cell.gates.length ? ` gates=[${cell.gates.join('; ')}]` : ''}`);
      }
      if (overlayResult.failure) manifest.failures.push(overlayResult.failure);
    } else {
      console.log('forge-capture: extras skipped (route "opening" not in --routes)');
    }

    // 6. Perspective triptych (requires FRD-2 review control under vite dev).
    const perspResult = await capturePerspectiveTriptych(context, {
      baseUrl,
      seed,
      paletteRgb,
      gateP99,
      consoleSeq,
      webglInfo,
      outDir,
    });
    manifest.pack.perspectives.push(...perspResult.cells);
    for (const cell of perspResult.cells) {
      for (const g of cell.gates) manifest.failures.push(`${cell.id}: ${g}`);
      for (const e of cell.errors) manifest.failures.push(`${cell.id}: ${e}`);
      console.log(`forge-capture: ${cell.id} ok=${cell.ok}${cell.gates.length ? ` gates=[${cell.gates.join('; ')}]` : ''}`);
    }
    if (perspResult.failure) {
      manifest.failures.push(perspResult.failure);
      console.log(`forge-capture: perspectives skipped (${perspResult.failure})`);
    }

    // 7. Board.
    const boardFile = path.join(outDir, 'board.png');
    const boardPage = await context.newPage();
    try {
      const totalCells =
        manifest.pack.routes.length + manifest.pack.extras.length + manifest.pack.perspectives.length;
      await composeBoard(boardPage, {
        routes: manifest.pack.routes,
        extras: manifest.pack.extras,
        perspectives: manifest.pack.perspectives,
        palette,
        meta: {
          line: `${totalCells} cells · seed ${manifest.requestedSeed}${manifest.actualSeed != null ? ` (actual ${manifest.actualSeed})` : ''} · ${DEFAULT_VIEWPORT.width}x${DEFAULT_VIEWPORT.height} · palette ${palette.length} tokens · git ${git.commit.slice(0, 7)} · ${new Date().toISOString().slice(0, 19)}Z`,
        },
        outFile: boardFile,
      });
    } finally {
      try {
        await boardPage.close();
      } catch {
        /* already closed */
      }
    }
    manifest.pack.board = fs.existsSync(boardFile) ? boardFile : null;
    if (!manifest.pack.board) manifest.failures.push('board.png not written');

    // 8. Clip (before console.txt so clip console messages are included).
    let clipConsole = [];
    if (clip) {
      const clipResult = await captureClip(browser, { baseUrl, seed, outDir, consoleSeq });
      manifest.pack.clip = clipResult.file;
      manifest.pack.clipReadback = clipResult.clipReadback ?? null;
      clipConsole = clipResult.consoleLog ?? [];
      if (clipResult.failure) manifest.failures.push(clipResult.failure);
      if (clipResult.errors?.length) {
        for (const err of clipResult.errors) manifest.failures.push(`clip: ${err}`);
      }
      if (!clipResult.file) manifest.failures.push('clip-missing');
      if (!clipResult.clipReadback?.seedMatch) manifest.failures.push('clip-readback-seed');
      console.log(
        `forge-capture: clip=${clipResult.file ?? 'not written'} readback=${clipResult.clipReadback?.seedMatch ?? false}${clipResult.failure ? ` (${clipResult.failure})` : ''}`,
      );
    }

    // 9. console.txt (all console messages + page errors across the run, including clip).
    const consoleFile = path.join(outDir, 'console.txt');
    fs.writeFileSync(consoleFile, buildConsoleTxt(manifest, clipConsole));
    manifest.pack.consoleTxt = consoleFile;

    // 10. critic-brief.txt (objective; no builder visual verdicts).
    manifest.environment.webglRenderer = webglInfo.renderer ?? '';
    manifest.environment.softwareRenderer = Boolean(webglInfo.softwareRenderer);
    manifest.finishedAt = new Date().toISOString();
    const briefFile = path.join(outDir, 'critic-brief.txt');
    fs.writeFileSync(
      briefFile,
      `${composeCriticBrief({
        manifest,
        gateP99,
        renderer: manifest.environment.webglRenderer,
        softwareRenderer: manifest.environment.softwareRenderer,
        routes,
        orientations,
        totalRouteCount: table.length,
      })}\n`,
    );
    manifest.pack.criticBrief = briefFile;

    manifest.ok =
      manifest.failures.length === 0 &&
      manifest.pack.board != null &&
      manifest.pack.consoleTxt != null &&
      manifest.pack.criticBrief != null &&
      (!clip ||
        (manifest.pack.clip != null &&
          fs.existsSync(manifest.pack.clip) &&
          fs.statSync(manifest.pack.clip).size > 0 &&
          manifest.pack.clipReadback?.seedMatch === true &&
          manifest.pack.clipReadback?.capturedPane === true));
  } catch (err) {
    manifest.failures.push(`fatal: ${err?.stack ?? String(err)}`);
  } finally {
    try {
      if (browser) await browser.close();
    } catch {
      /* already closed */
    }
    try {
      if (server) await server.stop();
    } catch {
      /* already stopped */
    }
    manifest.finishedAt = new Date().toISOString();
    // Strip capture-internal fields before persisting (console.txt holds them).
    for (const group of [manifest.pack.routes, manifest.pack.extras, manifest.pack.perspectives]) {
      for (const cell of group) delete cell.allConsole;
    }
    const validation = validateManifest(manifest);
    if (!validation.valid) {
      for (const e of validation.errors) console.error(`forge-capture: manifest invalid: ${e}`);
    }
    const manifestPath = writeManifest(path.join(outDir, 'manifest.json'), manifest);

    // Summary.
    const allCells = [
      ...manifest.pack.routes,
      ...manifest.pack.extras,
      ...manifest.pack.perspectives,
    ];
    const passed = allCells.filter((c) => c.ok).length;
    const gameWorks = allCells.map((c) => c.perf?.gameWorkP99Ms ?? 0);
    const rafs = allCells.map((c) => c.perf?.rafP99Ms ?? 0);
    const fps = allCells.map((c) => c.perf?.fps ?? 0).filter((f) => f > 0);
    console.log('--- forge-capture summary ---');
    console.log(`ok=${manifest.ok} manifestValid=${validation.valid}`);
    console.log(`cells=${passed}/${allCells.length} (routes ${manifest.pack.routes.filter((c) => c.ok).length}/${manifest.pack.routes.length}, extras ${manifest.pack.extras.filter((c) => c.ok).length}/${manifest.pack.extras.length}, perspectives ${manifest.pack.perspectives.filter((c) => c.ok).length}/${manifest.pack.perspectives.length})`);
    console.log(`seed requested=${manifest.requestedSeed} actual=${manifest.actualSeed}`);
    console.log(`worst gameWorkP99Ms=${gameWorks.length ? Math.max(...gameWorks) : 'n/a'} worst rafP99Ms=${rafs.length ? Math.max(...rafs) : 'n/a'}`);
    console.log(`fps range=${fps.length ? `${Math.min(...fps).toFixed(1)}..${Math.max(...fps).toFixed(1)}` : 'n/a'}`);
    console.log(`softwareRenderer=${manifest.environment.softwareRenderer} renderer=${manifest.environment.webglRenderer || '(unavailable)'}`);
    if (manifest.failures.length) {
      console.log('failures:');
      for (const f of manifest.failures) console.log(`  - ${f}`);
    }
    console.log('paths:');
    console.log(`  manifest=${manifestPath}`);
    console.log(`  board=${manifest.pack.board ?? 'n/a'}`);
    console.log(`  console=${manifest.pack.consoleTxt ?? 'n/a'}`);
    console.log(`  brief=${manifest.pack.criticBrief ?? 'n/a'}`);
    console.log(`  clip=${manifest.pack.clip ?? 'n/a'}`);
    process.exitCode = validation.valid && manifest.ok ? 0 : 1;
  }
}

main().catch((err) => {
  console.error(`forge-capture: fatal: ${err?.stack ?? err}`);
  process.exitCode = 1;
});
