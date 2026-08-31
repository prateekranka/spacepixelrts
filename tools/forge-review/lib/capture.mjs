// Forge Review Deck — serial capture driver + clip recorder.
//
// One browser context; pages opened/closed one at a time; every cell:
// navigate -> wait probe -> (settle / perf sample) -> composited screenshot ->
// analyze -> close page. No parallel pages. Extras reuse a shared loaded page
// when safe; the perspective triptych reuses one frozen page; the clip records
// a short webm sequence.
import fs from 'node:fs';
import path from 'node:path';
import { analyzePng, countOverlayColorPixels, isBlack, isEmpty } from './pixels.mjs';
import {
  CLIP_ACTION_HOLD_MS,
  CLIP_FINAL_HOLD_MS,
  CLIP_MAX_DURATION_MS,
  CLIP_PANEL_PREROLL_MS,
  CLIP_PATH_COLOR_MIN_PIXELS,
  CLIP_STEP_TICKS,
  trimClipVideo,
  verifyClipReadback,
  verifyClipScoutSelection,
  probeVideo,
} from './clip.mjs';

export const DEFAULT_VIEWPORT = { width: 1366, height: 1024 };
export const NAV_TIMEOUT_MS = 30000;
export const PROBE_TIMEOUT_MS = 20000;
export const FORGE_WAIT_MS = 15000;
/** Warm-up must exceed the 120-sample game-work and rAF-spacing rings (contract). */
export const PERF_WARMUP_FRAMES = 125;
export const FRAME_SAMPLE_MS = 800;
export const PALETTE_ADHERENCE_MIN = 0.35;
export const OVERLAY_PATH_STEP_TICKS = 600;
export const OVERLAY_COLOR_MIN_PIXELS = 8;
export const OVERLAY_COLOR_TOLERANCE = 48;

export const FORGE_OVERLAY_IDS = [
  'paths',
  'hit-regions',
  'line-of-sight',
  'orders',
  'facing',
  'entity-ids',
];

export const OVERLAY_EXPECTED_COLORS = {
  paths: '#00FF88',
  'hit-regions': '#FF3355',
  'line-of-sight': '#66CCFF',
  orders: '#FFCC00',
  facing: '#FF00FF',
  'entity-ids': '#FF7700',
};

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

/** Wait for the typed forge review control to install. */
export async function waitForForgeControl(page, timeoutMs = FORGE_WAIT_MS) {
  await page.waitForFunction(() => Boolean(globalThis.__STARHAVEN_FORGE__), null, {
    timeout: timeoutMs,
  });
}

/** Run actual requestAnimationFrame callbacks to flush perf rings (never time-guessed). */
export async function warmupPerfRings(page, frameCount = PERF_WARMUP_FRAMES) {
  await page.evaluate(
    (count) =>
      new Promise((resolve) => {
        let remaining = count;
        const tick = () => {
          if (remaining <= 0) {
            resolve(remaining);
            return;
          }
          remaining -= 1;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    frameCount,
  );
}

/** Navigate a route cell page: QA probe then typed forge control (forge=1 routes). */
export async function prepareRoutePage(page, opts) {
  const { url, viewport = DEFAULT_VIEWPORT } = opts;
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
  await page.waitForFunction(() => Boolean(globalThis.__STARHAVEN_QA__), null, {
    timeout: PROBE_TIMEOUT_MS,
  });
  await waitForForgeControl(page);
}

/** JSON round-trip of the forge control snapshot (single source of truth). */
export async function readForgeSnapshot(page) {
  try {
    return await page.evaluate(() =>
      JSON.parse(JSON.stringify(globalThis.__STARHAVEN_FORGE__.snapshot())),
    );
  } catch {
    return null;
  }
}

/** Apply forge control mutations and return the post-action snapshot. */
export async function applyForgeControl(page, action) {
  return page.evaluate((act) => {
    const forge = globalThis.__STARHAVEN_FORGE__;
    if (!forge) return null;
    if (act.frozen !== undefined) forge.setFrozen(act.frozen);
    if (act.step !== undefined) forge.step(act.step);
    if (act.perspective !== undefined) forge.setPerspective(act.perspective);
    if (act.cameraMode !== undefined) forge.setCameraMode(act.cameraMode);
    if (act.camera !== undefined) forge.setCamera(act.camera.x, act.camera.z);
    if (act.uiVisible !== undefined) forge.setUiVisible(act.uiVisible);
    if (act.reviewFog !== undefined) forge.setReviewFog(act.reviewFog);
    if (act.selectScout) forge.selectScout();
    if (act.clearSelection) forge.clearSelection();
    if (act.overlayOff) {
      for (const id of [
        'paths',
        'hit-regions',
        'line-of-sight',
        'orders',
        'facing',
        'entity-ids',
      ]) {
        forge.setOverlay(id, false);
      }
    }
    if (act.overlay !== undefined) forge.setOverlay(act.overlay.id, act.overlay.on);
    return JSON.parse(JSON.stringify(forge.snapshot()));
  }, action);
}

function applySnapshotToCell(cell, snap) {
  if (!snap) return;
  cell.actualSeed = Number(snap.actualSeed ?? 0) >>> 0;
  cell.actualState = typeof snap.state === 'string' ? snap.state : null;
  cell.tick = Number(snap.tick ?? 0);
  cell.perspective = snap.perspective ?? cell.perspective;
  cell.cameraMode = snap.cameraMode ?? cell.cameraMode;
  cell.camera = {
    x: Number(snap.camera?.x ?? 0),
    z: Number(snap.camera?.z ?? 0),
    halfH: Number(snap.camera?.halfH ?? 0),
  };
  cell.selection = Array.isArray(snap.selection) ? [...snap.selection] : [];
  cell.config = snap.config ?? cell.config;
  cell.overlays = snap.overlays ? { ...snap.overlays } : cell.overlays;
  cell.uiVisible = snap.uiVisible;
  cell.reviewFog = snap.reviewFog;
  cell.frozen = snap.frozen;
  cell.entities = {
    live: Number(snap.liveEntities ?? 0),
    total: Number(snap.totalEntitySlots ?? 0),
  };
}

function gateRequestedControl(cell, requested) {
  if (!requested) return;
  for (const [key, value] of Object.entries(requested)) {
    if (value === undefined || key === 'overlays') continue;
    if (cell[key] !== value) {
      cell.gates.push(`control-mismatch ${key} wanted=${value} actual=${cell[key]}`);
    }
  }
  if (requested.overlays) {
    for (const [id, on] of Object.entries(requested.overlays)) {
      const actual = cell.overlays?.[id];
      if (actual !== on) {
        cell.gates.push(`control-mismatch overlay.${id} wanted=${on} actual=${actual}`);
      }
    }
    const enabled = Object.entries(requested.overlays).filter(([, on]) => on).map(([id]) => id);
    if (enabled.length === 1) {
      for (const id of FORGE_OVERLAY_IDS) {
        if (id !== enabled[0] && cell.overlays?.[id] === true) {
          cell.gates.push(`control-mismatch overlay.${id} wanted=false actual=true`);
        }
      }
    }
  }
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
    overlays: {},
    uiVisible: true,
    reviewFog: true,
    frozen: true,
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
    controlExpected = null,
    overlayColor = null,
    overlayColorMinPixels = OVERLAY_COLOR_MIN_PIXELS,
    requireForgeMetrics = false,
    requireForgeControl = false,
  } = opts;
  const cell = opts.cell ?? newCell(opts);
  const forgeUrl = typeof url === 'string' && url.includes('forge=1');
  const mustHaveForge = requireForgeControl || forgeUrl;
  try {
    await settleFrames(page, settleRafs);
    const qa = await readQa(page);
    const forgeSnap = await readForgeSnapshot(page);
    if (forgeSnap) {
      applySnapshotToCell(cell, forgeSnap);
    } else if (mustHaveForge) {
      cell.gates.push('forge-control-missing');
    } else if (qa) {
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
      await warmupPerfRings(page);
      const forgeMetrics = await page.evaluate(() => {
        const forge = globalThis.__STARHAVEN_FORGE__;
        return forge ? forge.metrics() : null;
      });
      if (forgeMetrics) {
        cell.perf.gameWorkP99Ms = Number(forgeMetrics.gameWorkP99Ms ?? 0);
        cell.perf.rafP99Ms = Number(forgeMetrics.rafP99Ms ?? 0);
        cell.perf.fps = Number(forgeMetrics.fps ?? 0);
      } else if (!mustHaveForge) {
        const deltas = await measureRafSpacing(page, FRAME_SAMPLE_MS);
        cell.perf.rafP99Ms = p99Of(deltas);
        const qa2 = await readQa(page);
        if (qa2) {
          cell.perf.gameWorkP99Ms = Number(qa2.p99FrameMs ?? 0);
          cell.perf.fps = Number(qa2.fps ?? 0);
        }
      }
      if (requireForgeMetrics) {
        if (!(cell.perf.gameWorkP99Ms > 0)) cell.gates.push('gameWorkP99-zero');
        if (!(cell.perf.rafP99Ms > 0)) cell.gates.push('rafP99-zero');
        if (cell.perf.gameWorkP99Ms > 0 && cell.perf.rafP99Ms > 0 && cell.perf.gameWorkP99Ms === cell.perf.rafP99Ms) {
          cell.gates.push('perf-fields-conflated');
        }
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
    if (!forgeSnap) {
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
    }

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
          if (overlayColor) {
            const hits = countOverlayColorPixels(shotPath, overlayColor, OVERLAY_COLOR_TOLERANCE);
            cell.overlayColorHits = hits;
            if (hits < overlayColorMinPixels) {
              cell.gates.push(`overlay-color ${overlayColor} hits=${hits} < ${overlayColorMinPixels}`);
            }
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
  if (controlExpected) gateRequestedControl(cell, controlExpected);
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

/** Navigate -> wait probe + forge control -> captureFromPage -> close page. Serial by design. */
export async function captureRouteCell(context, opts) {
  const page = await context.newPage();
  const cell = newCell(opts);
  attachPageLoggers(page, () => cell, opts.consoleSeq);
  try {
    await prepareRoutePage(page, {
      url: opts.url,
      viewport: opts.viewport ?? DEFAULT_VIEWPORT,
    });
    await captureFromPage(page, {
      ...opts,
      cell,
      viewport: opts.viewport ?? DEFAULT_VIEWPORT,
      requireForgeControl: true,
      requireForgeMetrics: opts.requireForgeMetrics ?? true,
    });
  } catch (err) {
    const message = err?.message ?? String(err);
    if (!cell.gates.includes('forge-control-missing') && /__STARHAVEN_FORGE__|forge control/i.test(message)) {
      cell.gates.push('forge-control-missing');
    }
    cell.errors.push(`runtime: ${message}`);
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
 * Extras on route 'opening' / landscape-left via typed forge control.
 * Reuses ONE loaded page for scout/close/far/normal restore and ui-free.
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
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(baseUrlOpening, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(() => Boolean(globalThis.__STARHAVEN_QA__), null, {
      timeout: PROBE_TIMEOUT_MS,
    });
    await waitForForgeControl(page);
    await settleFrames(page);
    attachPageLoggers(page, () => currentCell, consoleSeq);
    if (webglInfo && webglInfo.renderer == null) {
      const renderer = await readWebglRenderer(page);
      webglInfo.renderer = renderer;
      webglInfo.softwareRenderer = isSoftwareRenderer(renderer);
    }

    const specs = [
      {
        id: 'extra-tactical-close',
        action: {
          cameraMode: 'tactical-close',
          camera: { x: scenarioCamera.x, z: scenarioCamera.z },
        },
        controlExpected: { cameraMode: 'tactical-close' },
      },
      {
        id: 'extra-strategic-far',
        action: { cameraMode: 'strategic-far' },
        controlExpected: { cameraMode: 'strategic-far' },
      },
      {
        id: 'extra-camera-normal-restore',
        action: { cameraMode: 'normal' },
        controlExpected: { cameraMode: 'normal' },
        cameraHalfH: scenarioCamera.halfH,
      },
      {
        id: 'extra-selected-scout',
        action: { selectScout: true, cameraMode: 'tactical-close' },
        controlExpected: { cameraMode: 'tactical-close' },
        samplePerf: true,
      },
      {
        id: 'extra-ui-free',
        action: { cameraMode: 'normal', uiVisible: false },
        controlExpected: { uiVisible: false, cameraMode: 'normal' },
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
        cameraMode: spec.controlExpected.cameraMode ?? 'normal',
        gateP99,
      });
      await applyForgeControl(page, spec.action);
      await settleFrames(page, 3);
      if (spec.samplePerf) {
        await warmupPerfRings(page);
      }
      const cell = await captureFromPage(page, {
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
        samplePerf: Boolean(spec.samplePerf),
        requireForgeMetrics: Boolean(spec.samplePerf),
        perspective: 'player',
        cameraMode: spec.controlExpected.cameraMode ?? 'normal',
        controlExpected: spec.controlExpected,
        viewport,
        cell: currentCell,
      });
      if (spec.cameraHalfH != null && Math.abs(cell.camera.halfH - spec.cameraHalfH) > 0.01) {
        cell.gates.push(`camera-restore halfH=${cell.camera.halfH} expected=${spec.cameraHalfH}`);
        cell.ok = false;
      }
      cells.push(cell);
    }
  } catch (err) {
    failures.push(`extras: ${err?.message ?? String(err)}`);
  } finally {
    try {
      await page.close();
    } catch {
      /* already closed */
    }
  }

  return { cells, failures };
}

// --- overlay evidence cells -------------------------------------------------

/**
 * One composited PNG per overlay with typed-control readback and color evidence.
 */
export async function captureOverlayCells(context, opts) {
  const {
    baseUrl,
    seed,
    paletteRgb = [],
    gateP99 = null,
    consoleSeq = null,
    webglInfo = null,
    outDir,
    viewport = DEFAULT_VIEWPORT,
    stepTicks = OVERLAY_PATH_STEP_TICKS,
  } = opts;
  const cellsDir = path.join(outDir, 'cells');
  const url = `${baseUrl}/?qa=opening&qa-seed=${seed}&orientation=landscape-left&forge=1&forge-panel=0`;
  const cells = [];
  let currentCell = null;
  const page = await context.newPage();
  try {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(() => Boolean(globalThis.__STARHAVEN_QA__), null, {
      timeout: PROBE_TIMEOUT_MS,
    });
    await waitForForgeControl(page);
    await applyForgeControl(page, { frozen: true, step: stepTicks, overlayOff: true });
    await settleFrames(page, 4);
    attachPageLoggers(page, () => currentCell, consoleSeq);
    if (webglInfo && webglInfo.renderer == null) {
      const renderer = await readWebglRenderer(page);
      webglInfo.renderer = renderer;
      webglInfo.softwareRenderer = isSoftwareRenderer(renderer);
    }

    for (const overlayId of FORGE_OVERLAY_IDS) {
      const id = `overlay-${overlayId}`;
      currentCell = newCell({
        id,
        kind: 'extra',
        orientation: 'landscape-left',
        url,
        requestedSeed: seed,
        expectedState: 'Playing',
        perspective: 'player',
        cameraMode: 'normal',
        gateP99,
      });
      await applyForgeControl(page, { overlayOff: true, overlay: { id: overlayId, on: true } });
      await settleFrames(page, 4);
      const overlayColor = OVERLAY_EXPECTED_COLORS[overlayId];
      const cell = await captureFromPage(page, {
        id,
        kind: 'extra',
        orientation: 'landscape-left',
        url,
        requestedSeed: seed,
        expectedState: 'Playing',
        paletteRgb,
        gateP99,
        shotPath: path.join(cellsDir, `${id}.png`),
        webglInfo,
        samplePerf: false,
        perspective: 'player',
        cameraMode: 'normal',
        controlExpected: { overlays: { [overlayId]: true } },
        overlayColor,
        viewport,
        cell: currentCell,
      });
      cells.push(cell);
    }
  } catch (err) {
    return { cells, failure: `overlay-cells: ${err?.message ?? String(err)}` };
  } finally {
    try {
      await page.close();
    } catch {
      /* already closed */
    }
  }
  return { cells, failure: null };
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
    await waitForForgeControl(page);
    await applyForgeControl(page, { frozen: true, step: OVERLAY_PATH_STEP_TICKS });
    attachPageLoggers(page, () => currentCell, consoleSeq);
    const cells = [];
    for (const perspective of ['player', 'rival', 'omniscient']) {
      await applyForgeControl(page, { perspective });
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
        samplePerf: false,
        perspective,
        cameraMode: 'normal',
        controlExpected: { perspective, frozen: true },
        settleRafs: 3,
        viewport,
        cell: currentCell,
      });
      cells.push(cell);
    }
    await applyForgeControl(page, { perspective: 'player' });
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

async function installClipClockOnContext(context) {
  await context.addInitScript(() => {
    globalThis.__FORGE_CLIP_T0__ = performance.now();
    globalThis.__FORGE_CLIP_MARKS__ = [];
    globalThis.__FORGE_CLIP_MARK__ = (label) => {
      const ms = performance.now() - globalThis.__FORGE_CLIP_T0__;
      globalThis.__FORGE_CLIP_MARKS__.push({ label, ms });
      return ms;
    };
  });
}

async function markClip(page, label) {
  return page.evaluate((l) => globalThis.__FORGE_CLIP_MARK__(l), label);
}

async function readCapturedPane(page) {
  return page.evaluate(() => {
    const pane = document.querySelector('[data-forge-pane]');
    return pane?.getAttribute('data-forge-pane') ?? null;
  });
}

/** Activate SNAPSHOT CELL without Playwright actionability auto-wait (software WebGL). */
async function activateForgeCaptureButton(page) {
  await page.evaluate(() => {
    const btn = document.querySelector('#forge-capture');
    if (!(btn instanceof HTMLButtonElement)) {
      throw new Error('forge-capture missing or not HTMLButtonElement');
    }
    btn.click();
  });
}

const SCOUT_KIND = 1;
const ORD_MOVE = 1;

/** Deterministic player scout entity id at the current tick (Kind.Scout = 1). */
export async function readPlayerScoutId(page) {
  return page.evaluate((scoutKind) => {
    const world = globalThis.__STARHOLD_WORLD__;
    if (!world) return null;
    const scout = world.ents.find((e) => e.alive && e.team === 0 && e.kind === scoutKind);
    return scout ? scout.id : null;
  }, SCOUT_KIND);
}

/** Arm MOVE through the rendered player HUD command button. */
async function clickPlayerMoveCommand(page) {
  return page.evaluate(() => {
    const btn = document.querySelector('#cmds button[data-cmd="move"]');
    if (!(btn instanceof HTMLButtonElement)) throw new Error('move command button missing');
    if (btn.disabled) throw new Error('move command button disabled');
    btn.click();
    return globalThis.__STARHOLD_INPUT__?.commandMode ?? null;
  });
}

/** Issue a ground move via canvas pointer input while move mode is armed. */
async function issueClipGroundMove(page) {
  return page.evaluate(({ scoutKind, ordMove }) => {
    const input = globalThis.__STARHOLD_INPUT__;
    const view = globalThis.__STARHOLD_VIEW__;
    const world = globalThis.__STARHOLD_WORLD__;
    const canvas = document.querySelector('#game');
    if (!input || !view || !world || !(canvas instanceof HTMLCanvasElement)) {
      throw new Error('clip ground move prerequisites missing');
    }
    if (input.commandMode !== 'move') {
      throw new Error(`clip ground move requires move mode, got ${String(input.commandMode)}`);
    }
    const scoutId = [...input.selected][0];
    const scout = scoutId != null ? world.ents[scoutId] : null;
    if (!scout || scout.kind !== scoutKind || scout.team !== 0) {
      throw new Error('clip ground move requires selected player scout');
    }

    const wx = Math.min(68, Math.max(4, scout.x + 12));
    const wz = Math.min(68, Math.max(4, scout.z + 12));
    const projected = view.project(wx, 0.5, wz);
    const overlay = view.overlay;
    const overlayRect = overlay.getBoundingClientRect();
    const cx =
      overlayRect.left + projected.x * (overlayRect.width / Math.max(1, overlay.width));
    const cy =
      overlayRect.top + projected.y * (overlayRect.height / Math.max(1, overlay.height));

    const bottom = document.querySelector('#bottom');
    const panel = document.querySelector('[data-forge-panel="true"]');
    if (bottom instanceof HTMLElement) {
      const br = bottom.getBoundingClientRect();
      if (cy >= br.top - 6) throw new Error('clip ground tap would hit bottom HUD');
    }
    if (panel instanceof HTMLElement) {
      const pr = panel.getBoundingClientRect();
      if (cx >= pr.left - 6 && cy >= pr.top - 6) {
        throw new Error('clip ground tap would hit forge panel');
      }
    }

    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 71,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientX: cx,
      clientY: cy,
    };
    canvas.dispatchEvent(new PointerEvent('pointerdown', init));
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));

    const after = world.ents[scoutId];
    return {
      wx,
      wz,
      cx,
      cy,
      order: after?.order ?? null,
      commandMode: input.commandMode,
      selectionCount: input.selected.size,
    };
  }, { scoutKind: SCOUT_KIND, ordMove: ORD_MOVE });
}

/**
 * Record proof.webm with visible holds, ffmpeg trim, and verified readback.
 * Identity banner stays visible (no forge-panel=0). Console/page errors fail the clip.
 */
export async function captureClip(browser, opts) {
  const {
    baseUrl,
    seed,
    outDir,
    stepTicks = CLIP_STEP_TICKS,
    prerollMs = CLIP_PANEL_PREROLL_MS,
    holdMs = CLIP_ACTION_HOLD_MS,
    finalHoldMs = CLIP_FINAL_HOLD_MS,
    consoleSeq = null,
  } = opts;
  const tmpDir = path.join(outDir, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const rawPath = path.join(tmpDir, 'clip-raw.webm');
  const context = await browser.newContext({
    viewport: { width: 1366, height: 1024 },
    deviceScaleFactor: 1,
    recordVideo: { dir: tmpDir, size: { width: 1366, height: 1024 } },
  });
  await installClipClockOnContext(context);
  const page = await context.newPage();
  const errors = [];
  const consoleLog = [];
  page.on('console', (msg) => {
    const entry = { type: msg.type(), text: msg.text() };
    if (consoleSeq) entry.seq = consoleSeq.n++;
    consoleLog.push(entry);
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    const entry = { type: 'pageerror', text: err?.message ?? String(err) };
    if (consoleSeq) entry.seq = consoleSeq.n++;
    consoleLog.push(entry);
    errors.push(`pageerror: ${entry.text}`);
  });
  let videoPath = null;
  let failure = null;
  let clipReadback = null;
  let trimStartMs = null;
  let rawDurationMs = null;
  let finalDurationMs = null;
  let marks = [];
  try {
    videoPath = (await page.video()?.path().catch(() => null)) ?? null;
    const url = `${baseUrl}/?qa=opening&qa-seed=${seed}&orientation=landscape-left&forge=1`;
    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await page.waitForFunction(() => Boolean(globalThis.__STARHAVEN_QA__), null, {
      timeout: PROBE_TIMEOUT_MS,
    });
    await waitForForgeControl(page);
    await page.waitForSelector('[data-forge-panel="true"]', { timeout: FORGE_WAIT_MS });
    await settleFrames(page, 4);
    trimStartMs = await markClip(page, 'panel-ready');
    await page.waitForTimeout(prerollMs);

    const loadSnap = await readForgeSnapshot(page);
    if (loadSnap?.actualSeed !== (seed >>> 0)) {
      failure = `clip-seed-mismatch requested=${seed} actual=${loadSnap?.actualSeed}`;
    }
    await markClip(page, 'identity-hold');

    await applyForgeControl(page, { frozen: true });
    await page.waitForTimeout(holdMs);
    const frozenSnap = await readForgeSnapshot(page);
    if (!frozenSnap?.frozen) failure = failure ?? 'clip-freeze-readback-failed';
    await markClip(page, 'frozen-hold');

    await applyForgeControl(page, { selectScout: true });
    await settleFrames(page, 3);
    const scoutId = await readPlayerScoutId(page);
    const selectSnap = await readForgeSnapshot(page);
    const selectCheck = verifyClipScoutSelection(selectSnap?.selection, scoutId);
    if (!selectCheck.ok) {
      failure =
        failure ??
        `clip-scout-selection count=${selectCheck.selectionCount} scout=${scoutId} selected=${selectCheck.selectedId ?? 'none'}`;
    }
    await markClip(page, 'scout-selected');
    const guideStillPath = path.join(outDir, 'cells', 'clip-guide-selection.png');
    fs.mkdirSync(path.dirname(guideStillPath), { recursive: true });
    await page.screenshot({ path: guideStillPath, type: 'png' });

    const moveMode = await clickPlayerMoveCommand(page);
    if (moveMode !== 'move') failure = failure ?? `clip-move-mode got=${moveMode ?? 'null'}`;
    await page.waitForTimeout(Math.min(holdMs, 500));
    await markClip(page, 'move-armed');

    try {
      const ground = await issueClipGroundMove(page);
      if (ground.order !== ORD_MOVE) {
        failure = failure ?? `clip-move-order order=${ground.order ?? 'null'}`;
      }
      if (ground.selectionCount !== 1) {
        failure = failure ?? `clip-move-selection count=${ground.selectionCount}`;
      }
    } catch (err) {
      failure = failure ?? `clip-ground-move: ${err?.message ?? String(err)}`;
    }
    await markClip(page, 'move-issued');
    await page.waitForTimeout(holdMs);

    const preStepSnap = await readForgeSnapshot(page);
    const tickBefore = preStepSnap?.tick ?? 0;
    await applyForgeControl(page, { step: stepTicks });
    await page.waitForTimeout(holdMs);
    const steppedSnap = await readForgeSnapshot(page);
    if ((steppedSnap?.tick ?? 0) - tickBefore !== stepTicks) {
      failure =
        failure ??
        `clip-step-delta expected=${stepTicks} actual=${(steppedSnap?.tick ?? 0) - tickBefore}`;
    }
    await markClip(page, 'step-hold');

    await applyForgeControl(page, { cameraMode: 'tactical-close' });
    await page.waitForTimeout(holdMs);
    const cameraSnap = await readForgeSnapshot(page);
    if (cameraSnap?.cameraMode !== 'tactical-close') {
      failure = failure ?? 'clip-camera-readback-failed';
    }
    await markClip(page, 'camera-hold');

    await applyForgeControl(page, { overlayOff: true, overlay: { id: 'paths', on: true } });
    try {
      await page.waitForFunction(
        () => document.querySelector('#forge-overlay-paths')?.checked === true,
        null,
        { timeout: 3000 },
      );
    } catch {
      failure = failure ?? 'clip-paths-checkbox-failed';
    }
    await page.waitForTimeout(holdMs);
    const overlaySnap = await readForgeSnapshot(page);
    if (!overlaySnap?.overlays?.paths) failure = failure ?? 'clip-overlay-readback-failed';
    await markClip(page, 'paths-hold');

    await activateForgeCaptureButton(page);
    await page.waitForFunction(
      () => document.querySelector('[data-forge-pane]')?.getAttribute('data-forge-pane') === 'identity',
      null,
      { timeout: 5000 },
    );
    await markClip(page, 'snapshot-captured');
    await page.waitForTimeout(finalHoldMs);
    await markClip(page, 'final-hold');

    const clipFinalShot = path.join(tmpDir, 'clip-final.png');
    await page.screenshot({ path: clipFinalShot, type: 'png' });
    const pathColorPixels = countOverlayColorPixels(
      clipFinalShot,
      OVERLAY_EXPECTED_COLORS.paths,
      OVERLAY_COLOR_TOLERANCE,
    );
    if (pathColorPixels < CLIP_PATH_COLOR_MIN_PIXELS) {
      failure =
        failure ??
        `clip-path-color pixels=${pathColorPixels} < ${CLIP_PATH_COLOR_MIN_PIXELS}`;
    }

    const finalSnap = await readForgeSnapshot(page);
    const paneKind = await readCapturedPane(page);
    const verified = verifyClipReadback(finalSnap, seed, paneKind === 'identity', tickBefore, {
      scoutId,
      pathColorPixels,
      pathColorMin: CLIP_PATH_COLOR_MIN_PIXELS,
    });
    clipReadback = {
      ...verified.readback,
      trimStartMs,
      milestones: marks,
    };
    if (!verified.ok) {
      failure = failure ?? `clip-readback: ${verified.errors.join('; ')}`;
    }
    marks = await page.evaluate(() => globalThis.__FORGE_CLIP_MARKS__ ?? []);
    clipReadback.milestones = marks;
  } catch (err) {
    failure = `clip: ${err?.message ?? String(err)}`;
  } finally {
    try {
      await page.close();
    } catch {
      /* already closed */
    }
    try {
      await context.close();
    } catch {
      /* already closed */
    }
  }

  let file = null;
  const finalPath = path.join(outDir, 'proof.webm');
  if (videoPath && fs.existsSync(videoPath)) {
    try {
      fs.renameSync(videoPath, rawPath);
      const rawProbe = await probeVideo(rawPath);
      rawDurationMs = Math.round(rawProbe.durationSec * 1000);
      if (trimStartMs == null) {
        failure = failure ?? 'clip-trim-start-missing';
      } else {
        const snapshotMark = marks.find((m) => m.label === 'snapshot-captured');
        const trimDurationSec =
          snapshotMark != null
            ? (snapshotMark.ms - trimStartMs + finalHoldMs) / 1000
            : null;
        const trimmed = await trimClipVideo({
          rawPath,
          outPath: finalPath,
          trimStartSec: trimStartMs / 1000,
          trimDurationSec,
        });
        finalDurationMs = Math.round(trimmed.durationSec * 1000);
        if (finalDurationMs > CLIP_MAX_DURATION_MS) {
          failure =
            failure ??
            `clip-duration-exceeded final=${finalDurationMs} max=${CLIP_MAX_DURATION_MS}`;
        }
        file = finalPath;
        fs.unlinkSync(rawPath);
      }
    } catch (err) {
      failure = failure ?? `clip-trim: ${err?.message ?? String(err)}`;
    }
  } else {
    failure = failure ?? 'clip-raw-missing';
  }

  if (clipReadback) {
    clipReadback.rawDurationMs = rawDurationMs;
    clipReadback.finalDurationMs = finalDurationMs;
  }

  if (!file || !fs.existsSync(file) || fs.statSync(file).size <= 0) {
    failure = failure ?? 'clip-missing-or-empty';
  }
  if (errors.length > 0) {
    failure = failure ?? 'clip-console-errors';
  }
  if (!clipReadback?.seedMatch || !clipReadback?.capturedPane) {
    failure = failure ?? 'clip-readback-incomplete';
  }
  if (clipReadback && (clipReadback.selectionCount !== 1 || !clipReadback.scoutSelected)) {
    failure = failure ?? 'clip-readback-selection-incomplete';
  }
  if (
    clipReadback &&
    Number(clipReadback.pathColorPixels) < CLIP_PATH_COLOR_MIN_PIXELS
  ) {
    failure = failure ?? 'clip-readback-path-color-incomplete';
  }
  return { file, failure, errors, consoleLog, clipReadback };
}
