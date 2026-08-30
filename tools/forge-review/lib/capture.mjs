// Forge Review Deck — serial capture driver + clip recorder.
//
// One browser context; pages opened/closed one at a time; every cell:
// navigate -> wait probe -> (settle / perf sample) -> composited screenshot ->
// analyze -> close page. No parallel pages. Extras reuse a shared loaded page
// when safe; the perspective triptych reuses one frozen page; the clip records
// a short webm sequence.
import fs from 'node:fs';
import path from 'node:path';
import { analyzePng, isBlack, isEmpty } from './pixels.mjs';

export const DEFAULT_VIEWPORT = { width: 1366, height: 1024 };
export const NAV_TIMEOUT_MS = 30000;
export const PROBE_TIMEOUT_MS = 20000;
export const PERF_WARMUP_MS = 2600; // > 120-frame probe ring @60fps so boot spikes flush
export const FRAME_SAMPLE_MS = 800;
export const PALETTE_ADHERENCE_MIN = 0.35;

// --- small pure helpers -----------------------------------------------------

/** Ordered unique (route x orientation) plan; route-major, stable order. */
export function buildCapturePlan(routes, orientations) {
  const seen = new Set();
  const plan = [];
  for (const route of routes) {
    for (const orientation of orientations) {
      const key = `${route}\u0000${orientation}`;
      if (seen.has(key)) continue;
      seen.add(key);
      plan.push({ route, orientation });
    }
  }
  return plan;
}

/**
 * Parse the makeScenario table from src/qa-scenarios.ts:
 * [{ id, expectedState, camera: { x, z, halfH } }] in file order.
 */
export function parseScenarioTable(repoRoot) {
  const src = fs.readFileSync(path.join(repoRoot, 'src', 'qa-scenarios.ts'), 'utf8');
  const re =
    /makeScenario\(\s*'([a-z0-9-]+)',\s*'([A-Za-z]+)',\s*[A-Z_]+,?\s*\{ id: 'cam-[a-z0-9-]+', x: ([0-9.]+), z: ([0-9.]+), halfH: ([0-9.]+) \}/g;
  const table = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    table.push({
      id: m[1],
      expectedState: m[2],
      camera: { x: Number(m[3]), z: Number(m[4]), halfH: Number(m[5]) },
    });
  }
  if (table.length === 0) throw new Error('could not parse scenarios from src/qa-scenarios.ts');
  return table;
}

export function settleFrames(page, count = 2) {
  const chain = (n) =>
    page.evaluate(
      (remaining) =>
        new Promise((resolve) => {
          const step = () => {
            if (remaining <= 0) {
              resolve();
              return;
            }
            remaining -= 1;
            requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }),
      count,
    );
  return chain(count);
}

/** Collect rAF-spacing deltas over durationMs (compositor frame spacing). */
export function measureRafSpacing(page, durationMs) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const samples = [];
        let last = performance.now();
        const end = last + duration;
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
    durationMs,
  );
}

/** p99 of rAF-spacing deltas, rounded to 2dp (0 when no samples). */
export function p99Of(deltas) {
  if (!deltas.length) return 0;
  const sorted = [...deltas].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(0.99 * sorted.length) - 1)] * 100) / 100;
}

/** JSON round-trip of the runtime QA probe (frozen copy, never the live object). */
export async function readQa(page) {
  try {
    return await page.evaluate(() =>
      JSON.parse(JSON.stringify(globalThis.__STARHAVEN_QA__ ?? null)),
    );
  } catch {
    return null;
  }
}

/**
 * WebGL renderer string from a FRESH offscreen canvas created and removed in
 * the page — never touches the game canvas. Returns '' on any failure.
 */
export async function readWebglRenderer(page) {
  try {
    return await page.evaluate(() => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const gl =
          canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        let renderer = '';
        if (gl) {
          const ext = gl.getExtension('WEBGL_debug_renderer_info');
          renderer = ext
            ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
            : String(gl.getParameter(gl.RENDERER));
          gl.getExtension('WEBGL_lose_context')?.loseContext();
        }
        canvas.remove();
        return renderer;
      } catch {
        return '';
      }
    });
  } catch {
    return '';
  }
}

export function isSoftwareRenderer(rendererString) {
  return /swiftshader|llvmpipe|software/i.test(rendererString ?? '');
}

// --- cell model -------------------------------------------------------------

function newCell(opts) {
  const {
    id,
    kind = 'route',
    orientation,
    url,
    requestedSeed,
    expectedState = null,
    perspective = 'player',
    cameraMode = 'normal',
    gateP99 = null,
  } = opts;
  const cell = {
    id,
    kind,
    orientation,
    url,
    requestedSeed,
    actualSeed: null,
    expectedState,
    actualState: null,
    tick: null,
    perspective,
    cameraMode,
    camera: { x: 0, z: 0, halfH: 0 },
    selection: [],
    config: null,
    image: null,
    perf: { fps: 0, gameWorkP99Ms: 0, rafP99Ms: 0 },
    draws: null,
    entities: { live: 0, total: 0 },
    errors: [],
    gates: [],
    ok: false,
    allConsole: [],
  };
  if (gateP99 != null) cell.p99GateMs = gateP99;
  return cell;
}

/**
 * Attach ONE console/pageerror listener per page, routing each message to the
 * cell returned by getCell() (so shared pages can re-target the current cell).
 * Every message is kept (for console.txt) with a global sequence number;
 * only console.error / pageerror become cell errors (and thus gate failures).
 */
function attachPageLoggers(page, getCell, consoleSeq) {
  page.on('console', (msg) => {
    const cell = getCell();
    if (!cell) return;
    const entry = { type: msg.type(), text: msg.text() };
    if (consoleSeq) entry.seq = consoleSeq.n++;
    cell.allConsole.push(entry);
    if (msg.type() === 'error') cell.errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    const cell = getCell();
    if (!cell) return;
    const entry = { type: 'pageerror', text: err?.message ?? String(err) };
    if (consoleSeq) entry.seq = consoleSeq.n++;
    cell.allConsole.push(entry);
    cell.errors.push(`pageerror: ${entry.text}`);
  });
}

// --- shared capture body ----------------------------------------------------

/**
 * Capture one cell from an ALREADY-loaded page (probe present). Fills probe
 * fields, optional perf sample (gameWorkP99Ms from the probe ring, rafP99Ms
 * from rAF spacing — never conflated), renderer/entities/selection/camera,
 * composited screenshot, pixel analysis and gates.
 */
export async function captureFromPage(page, opts) {
  const {
    id,
    kind = 'route',
    orientation,
    url,
    requestedSeed,
    expectedState = null,
    paletteRgb = [],
    gateP99 = null,
    shotPath = null,
    webglInfo = null,
    samplePerf = true,
    perspective = 'player',
    cameraMode = 'normal',
    settleRafs = 2,
    viewport = DEFAULT_VIEWPORT,
  } = opts;
  const cell = opts.cell ?? newCell(opts);
  try {
    await settleFrames(page, settleRafs);
    const qa = await readQa(page);
    if (qa) {
      cell.actualSeed = Number(qa.config?.seed ?? 0) >>> 0;
      cell.actualState = typeof qa.state === 'string' ? qa.state : null;
      cell.tick = Number(qa.tick ?? 0);
      cell.config = qa.config ?? null;
    }

    // Environment info: fill once per run (constant across pages).
    if (webglInfo && webglInfo.renderer == null) {
      const renderer = await readWebglRenderer(page);
      webglInfo.renderer = renderer;
      webglInfo.softwareRenderer = isSoftwareRenderer(renderer);
    }

    if (samplePerf) {
      await page.waitForTimeout(PERF_WARMUP_MS);
      const deltas = await measureRafSpacing(page, FRAME_SAMPLE_MS);
      cell.perf.rafP99Ms = p99Of(deltas);
      const qa2 = await readQa(page);
      if (qa2) {
        cell.perf.gameWorkP99Ms = Number(qa2.p99FrameMs ?? 0);
        cell.perf.fps = Number(qa2.fps ?? 0);
      }
    }

    const info = await page.evaluate(() => {
      try {
        return globalThis.__STARHOLD_VIEW__?.info?.() ?? null;
      } catch {
        return null;
      }
    });
    cell.draws = qa?.draws ?? info?.calls ?? null;
    const total = await page.evaluate(() => globalThis.__STARHOLD_WORLD__?.ents?.length ?? 0);
    cell.entities = { live: Number(qa?.entities ?? 0), total: Number(total) };
    cell.selection = await page.evaluate(() =>
      Array.from(globalThis.__STARHOLD_INPUT__?.selected ?? []).sort((a, b) => a - b),
    );
    const cam = await page.evaluate(() => {
      const input = globalThis.__STARHOLD_INPUT__;
      if (!input) return null;
      return {
        x: Number(input.pan?.x ?? 0),
        z: Number(input.pan?.z ?? 0),
        halfH: Number(input.halfH ?? 0),
      };
    });
    if (cam) cell.camera = cam;

    if (shotPath) {
      await page.screenshot({ path: shotPath, type: 'png' });
      if (fs.existsSync(shotPath)) {
        try {
          cell.image = analyzePng(shotPath, paletteRgb);
          cell.image.file = shotPath; // schema: image{file,width,height,...}
          if (cell.image.width !== viewport.width || cell.image.height !== viewport.height) {
            cell.gates.push(`size ${cell.image.width}x${cell.image.height} != ${viewport.width}x${viewport.height}`);
          }
          if (isBlack(cell.image)) cell.gates.push('capture-black');
          else if (isEmpty(cell.image)) cell.gates.push('capture-empty');
          if (cell.image.paletteAdherence < PALETTE_ADHERENCE_MIN) {
            cell.gates.push(`palette-adherence ${cell.image.paletteAdherence}`);
          }
        } catch (err) {
          cell.gates.push(`analyze: ${err?.message ?? err}`);
        }
      } else {
        cell.gates.push('capture-missing');
      }
    }
  } catch (err) {
    cell.errors.push(`runtime: ${err?.message ?? String(err)}`);
  }

  // Gates are applied even when the body failed partway (e.g. a page reload
  // destroyed the execution context mid-cell) so failures stay legible.
  if (shotPath && !cell.image && !cell.gates.some((g) => g.startsWith('capture'))) {
    cell.gates.push('capture-missing');
  }
  if (cell.actualState != null && cell.actualState !== expectedState) {
    cell.gates.push(`state ${cell.actualState} != ${expectedState}`);
  }
  if (cell.actualSeed != null && requestedSeed !== cell.actualSeed) {
    cell.gates.push(`seed-mismatch requested=${requestedSeed} actual=${cell.actualSeed}`);
  }
  if (cell.errors.length > 0) cell.gates.push('console-errors');
  if (gateP99 != null && cell.perf.gameWorkP99Ms >= gateP99) {
    cell.gates.push(`p99-budget ${cell.perf.gameWorkP99Ms}ms >= ${gateP99}ms`);
  }
  cell.ok = cell.gates.length === 0 && !cell.errors.some((e) => e.startsWith('runtime:'));
  return cell;
}

// --- route cells ------------------------------------------------------------

/** Navigate -> wait probe -> captureFromPage -> close page. Serial by design. */
export async function captureRouteCell(context, opts) {
  const page = await context.newPage();
  const cell = newCell(opts);
  attachPageLoggers(page, () => cell, opts.consoleSeq);
  try {
    await page.setViewportSize({
      width: opts.viewport?.width ?? DEFAULT_VIEWPORT.width,
      height: opts.viewport?.height ?? DEFAULT_VIEWPORT.height,
    });
    await page.goto(opts.url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(() => Boolean(globalThis.__STARHAVEN_QA__), null, {
      timeout: PROBE_TIMEOUT_MS,
    });
    await captureFromPage(page, { ...opts, cell, viewport: opts.viewport ?? DEFAULT_VIEWPORT });
  } catch (err) {
    cell.errors.push(`runtime: ${err?.message ?? String(err)}`);
    if (opts.shotPath && !cell.gates.some((g) => g.startsWith('capture'))) {
      cell.gates.push('capture-missing');
    }
    if (cell.errors.length > 0) cell.gates.push('console-errors');
  } finally {
    try {
      await page.close();
    } catch {
      /* already closed */
    }
  }
  return cell;
}

// --- extras ----------------------------------------------------------------

/**
 * Extras on route 'opening' / landscape-left, reusing ONE loaded page for
 * selected-scout / tactical-close / strategic-far (mutate via input, no
 * reload) plus a second page with &ui=0 for ui-free. Returns { cells, failures }.
 */
export async function captureExtras(context, opts) {
  const {
    baseUrl,
    seed,
    scenarioCamera,
    paletteRgb = [],
    gateP99 = null,
    consoleSeq = null,
    webglInfo = null,
    outDir,
    viewport = DEFAULT_VIEWPORT,
  } = opts;
  const cellsDir = path.join(outDir, 'cells');
  const baseUrlOpening = `${baseUrl}/?qa=opening&qa-seed=${seed}&orientation=landscape-left&forge=1&forge-panel=0`;
  const cells = [];
  const failures = [];
  let currentCell = null;

  // P1 — normal load, shared by the three camera/selection extras.
  const p1 = await context.newPage();
  try {
    await p1.setViewportSize({ width: viewport.width, height: viewport.height });
    await p1.goto(baseUrlOpening, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await p1.waitForFunction(() => Boolean(globalThis.__STARHAVEN_QA__), null, {
      timeout: PROBE_TIMEOUT_MS,
    });
    await settleFrames(p1);
    attachPageLoggers(p1, () => currentCell, consoleSeq);
    if (webglInfo && webglInfo.renderer == null) {
      const renderer = await readWebglRenderer(p1);
      webglInfo.renderer = renderer;
      webglInfo.softwareRenderer = isSoftwareRenderer(renderer);
    }
    const specs = [
      {
        id: 'extra-selected-scout',
        cameraMode: 'normal',
        // String-based evaluate bodies only: Playwright cannot serialize a
        // function passed as an evaluate ARGUMENT.
        mutateExpr: () => `(() => { const i = globalThis.__STARHOLD_INPUT__; if (i) i.focusScout(); })()`,
      },
      {
        id: 'extra-tactical-close',
        cameraMode: 'tactical-close',
        mutateExpr: ({ x, z }) =>
          `(() => { const i = globalThis.__STARHOLD_INPUT__; if (i) { i.halfH = 5; i.pan.x = ${x}; i.pan.z = ${z}; } })()`,
      },
      {
        id: 'extra-strategic-far',
        cameraMode: 'strategic-far',
        mutateExpr: () => `(() => { const i = globalThis.__STARHOLD_INPUT__; if (i) i.halfH = 18; })()`,
      },
    ];
    for (const spec of specs) {
      currentCell = newCell({
        id: spec.id,
        kind: 'extra',
        orientation: 'landscape-left',
        url: baseUrlOpening,
        requestedSeed: seed,
        expectedState: 'Playing',
        perspective: 'player',
        cameraMode: spec.cameraMode,
        gateP99,
      });
      const expression = spec.mutateExpr({ x: scenarioCamera.x, z: scenarioCamera.z });
      await p1.evaluate(expression);
      const cell = await captureFromPage(p1, {
        id: spec.id,
        kind: 'extra',
        orientation: 'landscape-left',
        url: baseUrlOpening,
        requestedSeed: seed,
        expectedState: 'Playing',
        paletteRgb,
        gateP99,
        shotPath: path.join(cellsDir, `${spec.id}.png`),
        webglInfo,
        samplePerf: true,
        perspective: 'player',
        cameraMode: spec.cameraMode,
        viewport,
      });
      cells.push(cell);
    }
    // Restore halfH for any later reuse of the page.
    await p1.evaluate(
      (halfH) => {
        const input = globalThis.__STARHOLD_INPUT__;
        if (input) input.halfH = halfH;
      },
      scenarioCamera.halfH,
    );
  } catch (err) {
    failures.push(`extras: ${err?.message ?? String(err)}`);
  } finally {
    try {
      await p1.close();
    } catch {
      /* already closed */
    }
  }

  // P2 — ui-free needs a reload with &ui=0 (control cannot toggle UI display).
  const p2 = await context.newPage();
  try {
    const uiFreeUrl = `${baseUrlOpening}&ui=0`;
    await p2.setViewportSize({ width: viewport.width, height: viewport.height });
    await p2.goto(uiFreeUrl, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await p2.waitForFunction(() => Boolean(globalThis.__STARHAVEN_QA__), null, {
      timeout: PROBE_TIMEOUT_MS,
    });
    await settleFrames(p2);
    attachPageLoggers(p2, () => currentCell, consoleSeq);
    currentCell = newCell({
      id: 'extra-ui-free',
      kind: 'extra',
      orientation: 'landscape-left',
      url: uiFreeUrl,
      requestedSeed: seed,
      expectedState: 'Playing',
      perspective: 'player',
      cameraMode: 'normal',
      gateP99,
    });
    const cell = await captureFromPage(p2, {
      id: 'extra-ui-free',
      kind: 'extra',
      orientation: 'landscape-left',
      url: uiFreeUrl,
      requestedSeed: seed,
      expectedState: 'Playing',
      paletteRgb,
      gateP99,
      shotPath: path.join(cellsDir, 'extra-ui-free.png'),
      webglInfo,
      samplePerf: true,
      perspective: 'player',
      cameraMode: 'normal',
      viewport,
    });
    cells.push(cell);
  } catch (err) {
    failures.push(`extras ui-free: ${err?.message ?? String(err)}`);
  } finally {
    try {
      await p2.close();
    } catch {
      /* already closed */
    }
  }

  return { cells, failures };
}

// --- perspective triptych ---------------------------------------------------

/**
 * Synchronized player/rival/omniscient triptych on opening / landscape-left.
 * Requires window.__STARHAVEN_FORGE__ (FRD-2 review-control under vite dev);
 * when absent the triptych is skipped and a failure is reported.
 * Returns { cells, failure }.
 */
export async function capturePerspectiveTriptych(context, opts) {
  const {
    baseUrl,
    seed,
    paletteRgb = [],
    gateP99 = null,
    consoleSeq = null,
    webglInfo = null,
    outDir,
    viewport = DEFAULT_VIEWPORT,
  } = opts;
  const url = `${baseUrl}/?qa=opening&qa-seed=${seed}&orientation=landscape-left&forge=1&forge-panel=0`;
  const page = await context.newPage();
  let currentCell = null;
  try {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(() => Boolean(globalThis.__STARHAVEN_QA__), null, {
      timeout: PROBE_TIMEOUT_MS,
    });
    const hasForge = await page.evaluate(() => Boolean(globalThis.__STARHAVEN_FORGE__));
    if (!hasForge) {
      return { cells: [], failure: 'perspective-control-unavailable' };
    }
    await page.evaluate(() => {
      globalThis.__STARHAVEN_FORGE__.setFrozen(true);
      // Scout-window tick (~30 sim seconds at 20Hz): the opening scout has split
      // the map's knowledge by here, so player/rival/omniscient differ visibly.
      globalThis.__STARHAVEN_FORGE__.step(600);
    });
    attachPageLoggers(page, () => currentCell, consoleSeq);
    const cells = [];
    for (const perspective of ['player', 'rival', 'omniscient']) {
      await page.evaluate((p) => globalThis.__STARHAVEN_FORGE__.setPerspective(p), perspective);
      currentCell = newCell({
        id: `perspective-${perspective}`,
        kind: 'perspective',
        orientation: 'landscape-left',
        url,
        requestedSeed: seed,
        expectedState: 'Playing',
        perspective,
        cameraMode: 'normal',
        gateP99,
      });
      const cell = await captureFromPage(page, {
        id: `perspective-${perspective}`,
        kind: 'perspective',
        orientation: 'landscape-left',
        url,
        requestedSeed: seed,
        expectedState: 'Playing',
        paletteRgb,
        gateP99,
        shotPath: path.join(outDir, 'cells', `perspective-${perspective}.png`),
        webglInfo,
        samplePerf: true,
        perspective,
        cameraMode: 'normal',
        settleRafs: 3,
        viewport,
      });
      cells.push(cell);
    }
    await page.evaluate(() => {
      try {
        globalThis.__STARHAVEN_FORGE__?.setPerspective('player');
      } catch {
        /* display-only restore */
      }
    });
    return { cells, failure: null };
  } catch (err) {
    return { cells: [], failure: `perspective-triptych: ${err?.message ?? String(err)}` };
  } finally {
    try {
      await page.close();
    } catch {
      /* already closed */
    }
  }
}

// --- clip -------------------------------------------------------------------

/**
 * Record proof.webm: load opening route with qa-seed, wait probe, freeze,
 * step(120), toggle 'paths' overlay, hold 800ms, close, rename to proof.webm.
 * Uses a DEDICATED recording context (recordVideo is a context-level option;
 * per-page recordVideo is ignored). When __STARHAVEN_FORGE__ is absent (FRD-2
 * not landed) the load sequence is still recorded and a
 * 'clip-control-unavailable' failure is returned.
 */
export async function captureClip(browser, opts) {
  const { baseUrl, seed, outDir } = opts;
  const tmpDir = path.join(outDir, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 1024 },
    deviceScaleFactor: 1,
    recordVideo: { dir: tmpDir, size: { width: 1366, height: 1024 } },
  });
  const page = await context.newPage();
  let videoPath = null;
  let failure = null;
  let note = null;
  try {
    videoPath = (await page.video()?.path().catch(() => null)) ?? null;
    await page.goto(`${baseUrl}/?qa=opening&qa-seed=${seed}&orientation=landscape-left&forge=1&forge-panel=0`, {
      waitUntil: 'load',
      timeout: NAV_TIMEOUT_MS,
    });
    await page.waitForFunction(() => Boolean(globalThis.__STARHAVEN_QA__), null, {
      timeout: PROBE_TIMEOUT_MS,
    });
    const hasForge = await page.evaluate(() => Boolean(globalThis.__STARHAVEN_FORGE__));
    if (hasForge) {
      await page.evaluate(() => {
        globalThis.__STARHAVEN_FORGE__.setFrozen(true);
        globalThis.__STARHAVEN_FORGE__.step(600);
        globalThis.__STARHAVEN_FORGE__.setOverlay('paths', true);
      });
      await page.waitForTimeout(800);
    } else {
      note = 'recorded load only; __STARHAVEN_FORGE__ absent (FRD-2 not landed)';
      failure = 'clip-control-unavailable';
      await page.waitForTimeout(800);
    }
  } catch (err) {
    failure = `clip: ${err?.message ?? String(err)}`;
  } finally {
    try {
      await page.close();
    } catch {
      /* already closed */
    }
    try {
      await context.close(); // finalizes the recording
    } catch {
      /* already closed */
    }
  }
  let file = null;
  if (videoPath && fs.existsSync(videoPath)) {
    const finalPath = path.join(outDir, 'proof.webm');
    try {
      fs.renameSync(videoPath, finalPath);
      file = finalPath;
    } catch {
      file = null;
    }
  }
  return { file, failure, note };
}
