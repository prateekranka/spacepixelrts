#!/usr/bin/env node
/**
 * qa-forge-trace.mjs — real-Chromium QA of the Forge Trace timeline (docs/FORGE_TRACE.md §12).
 *
 * One process, in order:
 *   1. generate a deterministic trace via the tsx worker (seed 24301, standard, sunweaver vs gravemark)
 *   2. validate trace.json shape in-process (schemaVersion 1, tool, events/checkpoints/terminalResult)
 *   3. build timeline.html via scripts/forge-trace-view.mjs with a Review Deck base URL
 *   4. launch Chromium (channel chrome, bundled fallback) and open the built file:// timeline
 *   5. confirm required tracks (both team blocks, economy resources, lumen, terminal) + test hook
 *   6. select a milestone event; details tick must match the real trace
 *   7. toggle an event-type filter off and on; no console errors
 *   8. setZoom(4) + panTo(3000); no errors
 *   9. frameRef (seed 24301, policyId) + Copy button presence
 *  10. prev/next failure navigation (adaptive: this seed has zero severity-failure events,
 *      warnings are reported out-of-stream in summary.json classifications)
 *  11. controlled failing fixture (events:null): build-time rejection + page-level missing-data
 *      banner, page never blanks, stays responsive, no uncaught pageerrors
 *  12. timeline.png of the good view, nonblank gate via pngjs
 *  13. manifest.json (steps checklist, consoleErrors, ok)
 *
 * Exit code 1 on any failed step, named reason printed. file:// only — no dev server, no --serve.
 *
 * Usage: node scripts/qa-forge-trace.mjs --out=<absolute dir outside the repo>
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = '/tmp/ftr-qa-selftest';
const VIEWPORT = { width: 1366, height: 1024 };
const SEED = 24301;
const DIFFICULTY = 'standard';
const PLAYER = 'sunweaver';
const RIVAL = 'gravemark';
const REVIEW_BASE_URL = 'http://127.0.0.1:5199';
const PROBE_TIMEOUT_MS = 30000;
const NAV_TIMEOUT_MS = 30000;
const WORKER_TIMEOUT_MS = 300000;
const DATA_TOKEN = '/*__FORGE_TRACE_DATA__*/null';
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
const VIEW_SCRIPT = path.join(REPO_ROOT, 'scripts', 'forge-trace-view.mjs');
const WORKER_SCRIPT = path.join(REPO_ROOT, 'scripts', 'forge-trace-worker.mts');

function parseArgs(argv) {
  const result = {};
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const equals = raw.indexOf('=');
    if (equals >= 0) result[raw.slice(2, equals)] = raw.slice(equals + 1);
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

function analyzePng(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  if (png.width !== VIEWPORT.width || png.height !== VIEWPORT.height) {
    throw new Error(`${path.basename(file)} is ${png.width}x${png.height}, expected ${VIEWPORT.width}x${VIEWPORT.height}`);
  }
  let maxLuma = 0;
  let lit = 0;
  let samples = 0;
  for (let index = 0; index < png.data.length; index += 28) {
    const luma = 0.2126 * png.data[index] + 0.7152 * png.data[index + 1] + 0.0722 * png.data[index + 2];
    maxLuma = Math.max(maxLuma, luma);
    if (luma > 10) lit++;
    samples++;
  }
  const litRatio = samples > 0 ? lit / samples : 0;
  if (!(maxLuma > 6 && litRatio >= 0.002)) {
    throw new Error(`${path.basename(file)} is black or empty (maxLuma=${maxLuma}, litRatio=${litRatio})`);
  }
  return { width: png.width, height: png.height, maxLuma: Math.round(maxLuma * 100) / 100, litRatio: Math.round(litRatio * 10000) / 10000 };
}

function runSync(cmd, args, opts) {
  return spawnSync(cmd, args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...opts });
}

function outputTail(out, lines) {
  const text = String(out || '').trim();
  if (!text) return '';
  return '\n' + text.split('\n').slice(-lines).join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = resolveOut(args.out);
  fs.mkdirSync(out, { recursive: true });

  const manifest = {
    tool: 'qa-forge-trace',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: {
      out,
      seed: SEED,
      difficulty: DIFFICULTY,
      player: PLAYER,
      rival: RIVAL,
      viewport: VIEWPORT,
      reviewBaseUrl: REVIEW_BASE_URL,
      protocol: 'file://',
    },
    steps: {},
    checks: {},
    captures: {},
    consoleErrors: [],
    errors: [],
    ok: false,
  };

  let browser = null;
  const goodConsoleErrors = [];
  const goodPageErrors = [];
  const brokenConsoleErrors = [];
  const brokenPageErrors = [];

  function mark(name, ok, detail) {
    manifest.steps[name] = { ok: Boolean(ok), detail: String(detail ?? '') };
    console.log(`FTR-QA: [${name}] ${ok ? 'PASS' : 'FAIL'} — ${detail}`);
    if (!ok) throw new Error(`step ${name} failed: ${detail}`);
  }

  try {
    /* ---------- 1. deterministic trace generation ---------- */
    const traceRunDir = path.join(out, 'trace-run');
    const traceFile = path.join(traceRunDir, 'trace.json');
    fs.mkdirSync(traceRunDir, { recursive: true });
    const worker = runSync(TSX_BIN, [
      WORKER_SCRIPT, 'single',
      `--seed=${SEED}`, `--difficulty=${DIFFICULTY}`,
      `--player=${PLAYER}`, `--rival=${RIVAL}`,
      `--out=${traceRunDir}`,
    ], { timeout: WORKER_TIMEOUT_MS });
    if (worker.error) {
      throw new Error(`worker spawn error: ${worker.error.message}`);
    }
    if (worker.status !== 0) {
      throw new Error(`worker exited ${worker.status ?? worker.signal}${outputTail(worker.stderr || worker.stdout, 15)}`);
    }
    if (!fs.existsSync(traceFile)) {
      throw new Error(`worker exited 0 but ${traceFile} is missing${outputTail(worker.stdout, 15)}`);
    }
    const workerLine = String(worker.stdout || '').split('\n').find((l) => l.includes('forge-trace: seed=')) ?? worker.stdout.trim().split('\n').slice(-1)[0] ?? '';
    mark('01-generate-trace', true, workerLine);

    /* ---------- 2. schema validation in-process ---------- */
    const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
    const shapeOk = trace && typeof trace === 'object' && !Array.isArray(trace)
      && trace.schemaVersion === 1 && trace.tool === 'forge-trace'
      && Array.isArray(trace.events) && trace.events.length > 0
      && Array.isArray(trace.checkpoints) && trace.checkpoints.length > 0
      && trace.terminalResult && typeof trace.terminalResult === 'object';
    if (!shapeOk) {
      throw new Error(`trace.json schema mismatch: schemaVersion=${trace?.schemaVersion} tool=${trace?.tool} events=${Array.isArray(trace?.events) ? trace.events.length : trace?.events} checkpoints=${Array.isArray(trace?.checkpoints) ? trace.checkpoints.length : trace?.checkpoints} terminalResult=${Boolean(trace?.terminalResult)}`);
    }
    const severityCounts = {};
    for (const e of trace.events) severityCounts[e.severity] = (severityCounts[e.severity] || 0) + 1;
    const failureEvents = trace.events.filter((e) => e.severity === 'failure');
    const warningEvents = trace.events.filter((e) => e.severity === 'warning');
    let summaryWarnings = 0;
    const summaryFile = path.join(traceRunDir, 'summary.json');
    if (fs.existsSync(summaryFile)) {
      const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
      if (Array.isArray(summary.classifications)) {
        summaryWarnings = summary.classifications.filter((c) => c && c.severity === 'warning').length;
      }
    }
    manifest.checks.trace = {
      schemaVersion: trace.schemaVersion,
      tool: trace.tool,
      events: trace.events.length,
      checkpoints: trace.checkpoints.length,
      terminalResult: trace.terminalResult,
      severityCounts,
      failureEvents: failureEvents.length,
      warningEventsInStream: warningEvents.length,
      summaryWarnings,
      playerFaction: trace.playerFaction,
      rivalFaction: trace.rivalFaction,
    };
    mark('02-schema', true, `schemaVersion=1 events=${trace.events.length} checkpoints=${trace.checkpoints.length} terminal=ok severities=${JSON.stringify(severityCounts)}`);

    /* ---------- 3. build timeline via forge-trace-view.mjs ---------- */
    const viewDir = path.join(out, 'view');
    const timelineFile = path.join(viewDir, 'timeline.html');
    const viewRun = runSync(process.execPath, [
      VIEW_SCRIPT,
      `--trace=${traceFile}`,
      `--out=${viewDir}`,
      `--review-base-url=${REVIEW_BASE_URL}`,
    ]);
    if (viewRun.status !== 0) {
      throw new Error(`forge-trace-view.mjs exited ${viewRun.status ?? viewRun.signal}${outputTail(viewRun.stderr || viewRun.stdout, 15)}`);
    }
    if (!fs.existsSync(timelineFile)) {
      throw new Error(`forge-trace-view.mjs exited 0 but ${timelineFile} is missing`);
    }
    mark('03-build-timeline', true, path.basename(timelineFile) + ` (${trace.events.length} events embedded)`);

    /* ---------- 4. Chromium launch + open file:// timeline ---------- */
    let launchMode = 'bundled';
    try {
      browser = await chromium.launch({
        channel: 'chrome',
        headless: true,
        args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
      });
      launchMode = 'chrome';
    } catch {
      browser = await chromium.launch({
        headless: true,
        args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
      });
    }
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(PROBE_TIMEOUT_MS);
    page.on('console', (message) => {
      if (message.type() === 'error') goodConsoleErrors.push(`console.error: ${message.text()}`);
    });
    page.on('pageerror', (error) => goodPageErrors.push(`pageerror: ${error?.message ?? String(error)}`));
    await page.goto(pathToFileURL(timelineFile).href, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(() => window.__FORGE_TIMELINE_TEST__ && window.__FORGE_TRACE_DATA__ && Array.isArray(window.__FORGE_TRACE_DATA__.events) && window.__FORGE_TRACE_DATA__.events.length > 0, null, { timeout: PROBE_TIMEOUT_MS });
    await settle(page);
    if (goodConsoleErrors.length || goodPageErrors.length) {
      throw new Error(`console/page errors at load: ${[...goodConsoleErrors, ...goodPageErrors].join(' | ')}`);
    }
    mark('04-launch-chromium', true, `channel=${launchMode} viewport=${VIEWPORT.width}x${VIEWPORT.height} zero console errors`);

    /* ---------- 5. required tracks + test hook ---------- */
    const hookProbe = await page.evaluate(() => {
      const h = window.__FORGE_TIMELINE_TEST__;
      const probe = { version: h ? h.version : null, keys: h ? Object.keys(h).sort() : [] };
      if (h) for (const k of Object.keys(h)) probe[`has:${k}`] = typeof h[k] === 'function';
      return probe;
    });
    const requiredHook = ['selectEventByIndex', 'setFilter', 'setZoom', 'panTo', 'getSelectedDetails', 'failureCount', 'search'];
    const missingHook = requiredHook.filter((k) => hookProbe[`has:${k}`] !== true);
    if (hookProbe.version !== 1 || missingHook.length) {
      throw new Error(`test hook incomplete: version=${hookProbe.version} missing=${missingHook.join(',')} keys=${hookProbe.keys.join(',')}`);
    }
    const tracks = await page.evaluate(() => {
      const text = (sel) => document.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      const count = (rowId) => {
        const el = document.querySelector(`.grow.track[data-row="${rowId}"] .count`);
        const n = el ? parseInt(el.textContent, 10) : NaN;
        return Number.isFinite(n) ? n : -1;
      };
      return {
        teamA: text('.grow.team[data-team="A"]'),
        teamB: text('.grow.team[data-team="B"]'),
        teamALabel: text('#team-A-label'),
        teamBLabel: text('#team-B-label'),
        rowARes: text('.grow.track[data-row="A.res"]'),
        rowBRes: text('.grow.track[data-row="B.res"]'),
        rowSLumen: text('.grow.track[data-row="S.lumen"]'),
        rowSTerminal: text('.grow.track[data-row="S.terminal"]'),
        countARes: count('A.res'),
        countBRes: count('B.res'),
        countSLumen: count('S.lumen'),
        countSTerminal: count('S.terminal'),
      };
    });
    const teamOk = tracks.teamA.toUpperCase().includes('SUNWEAVER') && tracks.teamB.toUpperCase().includes('GRAVEMARK');
    const trackOk = tracks.rowARes.includes('Ore') && tracks.rowBRes.includes('Ore')
      && tracks.rowSLumen.includes('Lumen') && tracks.rowSTerminal.includes('Terminal')
      && tracks.countARes > 0 && tracks.countBRes > 0 && tracks.countSLumen > 0 && tracks.countSTerminal > 0;
    if (!teamOk || !trackOk) {
      throw new Error(`track layout missing: ${JSON.stringify(tracks)}`);
    }
    manifest.checks.tracks = tracks;
    manifest.checks.hook = hookProbe;
    mark('05-tracks', true, `A=${tracks.teamA} B=${tracks.teamB} res=${tracks.countARes}/${tracks.countBRes} lumen=${tracks.countSLumen} terminal=${tracks.countSTerminal} hook v${hookProbe.version}`);

    /* ---------- 6. select a milestone event; details tick must match the real trace ---------- */
    const sortedEvents = [...trace.events].sort((a, b) => (a.tick - b.tick) || ((a.seq ?? 0) - (b.seq ?? 0)));
    const expected0 = sortedEvents[0];
    const tickSet = new Set(trace.events.map((e) => e.tick));
    const details0 = await page.evaluate(() => window.__FORGE_TIMELINE_TEST__.selectEventByIndex(0));
    if (!details0 || typeof details0 !== 'object') {
      throw new Error(`selectEventByIndex(0) returned ${JSON.stringify(details0)}`);
    }
    if (details0.tick !== expected0.tick || details0.eventId !== expected0.eventId || details0.type !== expected0.type) {
      throw new Error(`selected details mismatch: got tick=${details0.tick} id=${details0.eventId} type=${details0.type}; expected tick=${expected0.tick} id=${expected0.eventId} type=${expected0.type}`);
    }
    if (!tickSet.has(details0.tick)) {
      throw new Error(`selected tick ${details0.tick} not present in trace.json event ticks`);
    }
    manifest.checks.selected = { details0, expected: { tick: expected0.tick, eventId: expected0.eventId, type: expected0.type } };
    mark('06-select-milestone', true, `${details0.type} tick=${details0.tick} eventId=${details0.eventId} matches trace.json`);

    /* ---------- 7. toggle an event-type filter off then on ---------- */
    const errsBeforeFilter = goodConsoleErrors.length + goodPageErrors.length;
    const filterOff = await page.evaluate(() => window.__FORGE_TIMELINE_TEST__.setFilter('order-change', false));
    const filterOn = await page.evaluate(() => window.__FORGE_TIMELINE_TEST__.setFilter('order-change', true));
    const filterDom = await page.evaluate(() => {
      const cb = document.querySelector('#type-list input[data-type="order-change"]');
      return { checked: cb ? cb.checked : null, exists: Boolean(cb) };
    });
    if (!filterOff || filterOff.enabled !== false || !filterOn || filterOn.enabled !== true || filterDom.exists !== true || filterDom.checked !== true) {
      throw new Error(`filter toggle misbehaved: off=${JSON.stringify(filterOff)} on=${JSON.stringify(filterOn)} dom=${JSON.stringify(filterDom)}`);
    }
    if (goodConsoleErrors.length + goodPageErrors.length !== errsBeforeFilter) {
      throw new Error(`console errors appeared after filter toggle: ${[...goodConsoleErrors, ...goodPageErrors].join(' | ')}`);
    }
    manifest.checks.filterToggle = { off: filterOff, on: filterOn, dom: filterDom };
    mark('07-filter-toggle', true, `order-change off->on ok (checkbox checked=${filterDom.checked})`);

    /* ---------- 8. zoom and pan ---------- */
    const errsBeforeZoom = goodConsoleErrors.length + goodPageErrors.length;
    const zoom = await page.evaluate(() => window.__FORGE_TIMELINE_TEST__.setZoom(4));
    const pan = await page.evaluate(() => window.__FORGE_TIMELINE_TEST__.panTo(3000));
    const zoomState = await page.evaluate(() => window.__FORGE_TIMELINE_TEST__.getState());
    if (!zoom || typeof zoom.pxPerSec !== 'number' || !pan || typeof pan.viewLeftTick !== 'number' || typeof zoomState.viewLeftTick !== 'number') {
      throw new Error(`zoom/pan misbehaved: zoom=${JSON.stringify(zoom)} pan=${JSON.stringify(pan)} state=${JSON.stringify(zoomState)}`);
    }
    if (goodConsoleErrors.length + goodPageErrors.length !== errsBeforeZoom) {
      throw new Error(`console errors appeared after zoom/pan: ${[...goodConsoleErrors, ...goodPageErrors].join(' | ')}`);
    }
    manifest.checks.zoomPan = { zoom, pan, state: zoomState };
    mark('08-zoom-pan', true, `setZoom(4)->pxPerSec=${zoom.pxPerSec} panTo(3000)->viewLeftTick=${pan.viewLeftTick}`);

    /* ---------- 9. frame reference + Copy button ---------- */
    const details9 = await page.evaluate(() => window.__FORGE_TIMELINE_TEST__.selectEventByIndex(0));
    const frame = details9?.frameRef ?? null;
    const expectedPolicyId = expected0.frameRef && typeof expected0.frameRef.policyId === 'string' ? expected0.frameRef.policyId : null;
    if (!frame || typeof frame !== 'object') {
      throw new Error(`getSelectedDetails().frameRef missing: ${JSON.stringify(details9)}`);
    }
    if (frame.seed !== SEED || typeof frame.policyId !== 'string' || frame.policyId.length === 0) {
      throw new Error(`frameRef wrong: ${JSON.stringify(frame)} (expected seed ${SEED}, nonempty policyId string)`);
    }
    if (expectedPolicyId && frame.policyId !== expectedPolicyId) {
      throw new Error(`frameRef.policyId=${frame.policyId} differs from trace event's ${expectedPolicyId}`);
    }
    const copyProbe = await page.evaluate(() => {
      const byId = document.getElementById('copy-fr');
      const byText = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').toLowerCase().includes('copy'));
      const deck = document.getElementById('open-deck');
      return {
        copyById: Boolean(byId),
        copyByText: Boolean(byText),
        copyText: byText ? byText.textContent.trim() : '',
        openDeckHref: deck ? deck.getAttribute('href') : null,
      };
    });
    if (!copyProbe.copyById && !copyProbe.copyByText) {
      throw new Error(`no Copy frame reference button in details panel: ${JSON.stringify(copyProbe)}`);
    }
    if (!copyProbe.openDeckHref || !copyProbe.openDeckHref.includes(`qa-seed=${SEED}`) || !copyProbe.openDeckHref.includes('forge-tick=')) {
      throw new Error(`open-deck review link malformed: ${copyProbe.openDeckHref}`);
    }
    manifest.checks.frameRef = { frame, copyProbe };
    mark('09-frame-ref', true, `seed=${frame.seed} policyId=${frame.policyId} copyButton=${copyProbe.copyById ? '#copy-fr' : copyProbe.copyText} deckLink=ok`);

    /* ---------- 10. prev/next failure navigation ---------- */
    const hookFailureCount = await page.evaluate(() => window.__FORGE_TIMELINE_TEST__.failureCount());
    const badgeBefore = await page.evaluate(() => document.getElementById('fail-badge')?.textContent ?? '');
    const failureTicks = new Set(failureEvents.map((e) => e.tick));
    const nav = await page.evaluate(() => {
      const out = [];
      const prev = document.getElementById('fail-prev');
      const next = document.getElementById('fail-next');
      if (prev) { prev.click(); out.push('prev'); }
      if (next) { next.click(); out.push('next'); }
      return out;
    });
    let navSelected = null;
    if (hookFailureCount > 0) {
      const picks = [];
      for (let i = 0; i < Math.min(hookFailureCount, 8); i++) {
        picks.push(await page.evaluate(() => window.__FORGE_TIMELINE_TEST__.getSelectedDetails()));
        await page.evaluate(() => document.getElementById('fail-next')?.click());
      }
      navSelected = picks;
      for (const d of picks) {
        if (!d || !failureTicks.has(d.tick)) {
          throw new Error(`failure navigation selected tick ${d?.tick} not in failure events ${JSON.stringify(d)}`);
        }
      }
    }
    const badgeAfter = await page.evaluate(() => document.getElementById('fail-badge')?.textContent ?? '');
    if (!/^\d+\/\d+$/.test(badgeAfter)) {
      throw new Error(`fail badge malformed: "${badgeAfter}"`);
    }
    if (goodConsoleErrors.length + goodPageErrors.length !== errsBeforeZoom) {
      throw new Error(`console errors appeared during failure navigation: ${[...goodConsoleErrors, ...goodPageErrors].join(' | ')}`);
    }
    manifest.checks.failureNav = {
      hookFailureCount,
      badgeBefore,
      badgeAfter,
      traceFailureEvents: failureEvents.length,
      traceWarningEvents: warningEvents.length,
      summaryWarnings,
      navClicks: nav,
      selectedOnFailures: navSelected,
    };
    mark('10-failure-nav', true, `failures=${hookFailureCount} badge=${badgeAfter} warnings(summary)=${summaryWarnings} navClicks=${nav.join(',')} (no severity-failure events in stream; warnings are out-of-stream classifications)`);

    /* ---------- 11. controlled failing fixture ---------- */
    const brokenTrace = { schemaVersion: 1, tool: 'forge-trace', events: null };
    const brokenTraceFile = path.join(out, 'broken-trace.json');
    const viewBrokenDir = path.join(out, 'view-broken');
    fs.writeFileSync(brokenTraceFile, JSON.stringify(brokenTrace));
    fs.mkdirSync(viewBrokenDir, { recursive: true });
    const brokenBuild = runSync(process.execPath, [VIEW_SCRIPT, `--trace=${brokenTraceFile}`, `--out=${viewBrokenDir}`]);
    if (brokenBuild.status === 0) {
      throw new Error('forge-trace-view.mjs ACCEPTED events:null — build-time validation should reject malformed traces');
    }
    /* page-level fixture: same token substitution the view tool performs, bypassing its build gate,
       so the browser resilience path (embedded malformed payload) can be exercised. */
    const templateHtml = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'forge-timeline.html'), 'utf8');
    if (templateHtml.split(DATA_TOKEN).length - 1 !== 1) {
      throw new Error('template data token count != 1');
    }
    const brokenTimelineFile = path.join(viewBrokenDir, 'timeline.html');
    fs.writeFileSync(brokenTimelineFile, templateHtml.replace(DATA_TOKEN, JSON.stringify(brokenTrace)));
    const brokenPage = await context.newPage();
    brokenPage.setDefaultTimeout(PROBE_TIMEOUT_MS);
    brokenPage.on('console', (message) => {
      if (message.type() === 'error') brokenConsoleErrors.push(`console.error: ${message.text()}`);
    });
    brokenPage.on('pageerror', (error) => brokenPageErrors.push(`pageerror: ${error?.message ?? String(error)}`));
    await brokenPage.goto(pathToFileURL(brokenTimelineFile).href, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await settle(brokenPage);
    const brokenState = await brokenPage.evaluate(() => {
      const banners = [...document.querySelectorAll('#banners .banner')].map((b) => b.textContent.trim());
      return {
        bodyTextLength: document.body.innerText.length,
        bodyText: document.body.innerText.slice(0, 400),
        bannersShown: document.getElementById('banners')?.classList.contains('show') ?? false,
        banners,
        errorPanelShown: document.getElementById('error-panel')?.classList.contains('show') ?? false,
        errorMsg: document.getElementById('error-msg')?.textContent ?? '',
        responsive: (1 + 1) === 2,
      };
    });
    const bannerText = (brokenState.banners || []).join(' ').toLowerCase();
    const bannerOk = brokenState.bannersShown && brokenState.banners.length > 0
      && /(no events|missing|error|nothing to render)/.test(bannerText);
    if (brokenState.bodyTextLength <= 0 || !brokenState.responsive) {
      throw new Error(`broken view blanked or unresponsive: ${JSON.stringify(brokenState)}`);
    }
    if (!bannerOk) {
      throw new Error(`broken view missing data banner: ${JSON.stringify(brokenState)}`);
    }
    if (brokenPageErrors.length > 0) {
      throw new Error(`uncaught pageerrors on broken view: ${brokenPageErrors.join(' | ')}`);
    }
    manifest.checks.broken = {
      buildExit: brokenBuild.status,
      buildStderr: String(brokenBuild.stderr || '').trim().split('\n').slice(-1)[0] ?? '',
      state: brokenState,
      consoleErrors: [...brokenConsoleErrors],
    };
    mark('11-broken-fixture', true, `view tool rejected events:null (exit ${brokenBuild.status}); page shows ${brokenState.banners.length} banner(s): "${brokenState.banners.join(' | ')}" body=${brokenState.bodyTextLength}ch responsive=yes pageerrors=0`);

    /* ---------- 12. screenshot of the good view ---------- */
    await page.evaluate(() => window.__FORGE_TIMELINE_TEST__.selectEventByIndex(0));
    await settle(page);
    const pngFile = path.join(out, 'timeline.png');
    await page.screenshot({ path: pngFile, type: 'png' });
    const pngStats = analyzePng(pngFile);
    manifest.captures.timeline = { file: 'timeline.png', image: pngStats };
    mark('12-screenshot', true, `timeline.png ${pngStats.width}x${pngStats.height} maxLuma=${pngStats.maxLuma} litRatio=${pngStats.litRatio}`);

    /* ---------- final gates ---------- */
    if (goodConsoleErrors.length || goodPageErrors.length) {
      throw new Error(`console/page errors on good view: ${[...goodConsoleErrors, ...goodPageErrors].join(' | ')}`);
    }
    manifest.consoleErrors = [...goodConsoleErrors, ...goodPageErrors];
    manifest.ok = true;
  } catch (error) {
    manifest.errors.push(error?.stack ?? String(error));
  } finally {
    try { if (browser) await browser.close(); } catch {}
    manifest.finishedAt = new Date().toISOString();
    manifest.consoleErrors = [...goodConsoleErrors, ...goodPageErrors];
    const manifestPath = path.join(out, 'manifest.json');
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log('--- qa-forge-trace summary ---');
    const failedSteps = Object.entries(manifest.steps).filter(([, s]) => !s.ok).map(([name]) => name);
    console.log(`ok=${manifest.ok} steps=${Object.keys(manifest.steps).length} failedSteps=${failedSteps.length ? failedSteps.join(',') : 'none'} consoleErrors=${manifest.consoleErrors.length} events=${manifest.checks.trace?.events ?? 'n/a'}`);
    console.log(`manifest=${manifestPath}`);
    if (manifest.errors.length) {
      for (const error of manifest.errors) console.log(`  - ${String(error).split('\n')[0]}`);
    }
    if (!manifest.ok) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
