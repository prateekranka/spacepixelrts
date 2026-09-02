/**
 * Forge Review Deck (FRD-1) automated tests — pure logic only.
 * NO browser, NO server spawn. Run: npx tsx tests/forge-review.test.ts
 *
 * NOTE (coordination): the first test asserts the FRD-B contract (qa-seed URL
 * override in parseQaScenario). src/qa-scenarios.ts is owned by Builder B and
 * may not have landed yet — if this single test is red while everything else
 * passes, that is the expected cross-builder state, not a regression here.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

import { parseQaScenario } from '../src/qa-scenarios';
import {
  RAF_P99_MIN_SAMPLES,
  RAF_RING_LENGTH,
  applyCameraModeTransition,
  normalizeStepCount,
  rafP99FromRing,
} from '../src/dev/review-control';
import { SCHEMA_VERSION, validateManifest } from '../tools/forge-review/lib/manifest.mjs';
import {
  buildConsoleTxt,
  CAPTURE_WRITE_ORDER,
  composeCriticBrief,
} from '../tools/forge-review/lib/pack-artifacts.mjs';
import {
  analyzePng,
  isBlack,
  isEmpty,
  loadPaletteRgb,
} from '../tools/forge-review/lib/pixels.mjs';
import {
  PERF_WARMUP_FRAMES,
  buildCapturePlan,
  warmupPerfRings,
  OVERLAY_EXPECTED_COLORS,
  resolveClipGroundTapClientCoords,
  CLIP_GROUND_TAP_HUD_PAD,
} from '../tools/forge-review/lib/capture.mjs';
import {
  CLIP_STEP_TICKS,
  CLIP_MAX_DURATION_MS,
  CLIP_PATH_COLOR_MIN_PIXELS,
  verifyClipReadback,
  verifyClipScoutSelection,
  validateClipReadback,
  trimClipVideo,
} from '../tools/forge-review/lib/clip.mjs';
import {
  drawFacingArrow,
  drawPathWaypointMarker,
  drawPerspectiveChip,
  OVERLAY_EXPECTED_COLORS as OVERLAY_TS_COLORS,
} from '../src/dev/review-overlays';
import { REVIEW_FOG_VEIL, SHIPPED_FOG_VEIL_ALPHA } from '../src/render';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type Test = { name: string; run: () => void };
const tests: Test[] = [];
const test = (name: string, run: () => void) => tests.push({ name, run });

// --- manifest fixture builders -----------------------------------------------

function validConfig(seed = 777) {
  return {
    playerFaction: 'sunweaver',
    aiFaction: 'gravemark',
    map: 'helios-rift',
    difficulty: 'standard',
    fogOfWar: true,
    speed: 1,
    tacticalPause: 'enabled',
    seedMode: 'deterministic',
    seed,
  };
}

function validCell(overrides: Record<string, unknown> = {}) {
  return {
    id: 'opening',
    kind: 'route',
    orientation: 'landscape-left',
    url: 'http://127.0.0.1:12345/?qa=opening&qa-seed=777&orientation=landscape-left',
    requestedSeed: 777,
    actualSeed: 777,
    expectedState: 'Playing',
    actualState: 'Playing',
    tick: 42,
    perspective: 'player',
    cameraMode: 'normal',
    camera: { x: 12, z: 12, halfH: 30 },
    selection: [1, 2, 3],
    config: validConfig(),
    image: {
      file: '/tmp/forge/cells/opening-landscape-left.png',
      width: 1366,
      height: 1024,
      minLuma: 2,
      maxLuma: 240,
      meanLuma: 42,
      litRatio: 0.5,
      distinctColors: 120,
      paletteAdherence: 0.9,
    },
    perf: { fps: 60, gameWorkP99Ms: 8.4, rafP99Ms: 33.3 },
    draws: 120,
    overlays: {
      paths: false,
      'hit-regions': false,
      'line-of-sight': false,
      orders: false,
      facing: false,
      'entity-ids': false,
    },
    uiVisible: true,
    reviewFog: true,
    frozen: true,
    entities: { live: 30, total: 64 },
    errors: [],
    gates: [],
    ok: true,
    ...overrides,
  };
}

function validManifest(overrides: Record<string, unknown> = {}) {
  return {
    tool: 'forge-review-capture',
    schemaVersion: SCHEMA_VERSION,
    startedAt: '2026-08-26T00:00:00.000Z',
    finishedAt: '2026-08-26T00:01:00.000Z',
    git: { commit: 'a'.repeat(40), branch: 'hermes/starhaven-aaa-front-end', dirty: false },
    args: { out: '/tmp/forge', seed: 777 },
    requestedSeed: 777,
    actualSeed: 777,
    viewport: { width: 1366, height: 1024, deviceScaleFactor: 1 },
    environment: { browser: 'chromium', webglRenderer: 'SwiftShader', softwareRenderer: true },
    pack: {
      routes: [validCell()],
      extras: [],
      perspectives: [],
      board: '/tmp/forge/board.png',
      consoleTxt: '/tmp/forge/console.txt',
      criticBrief: '/tmp/forge/critic-brief.txt',
      clip: null,
    },
    failures: [],
    ok: true,
    ...overrides,
  };
}

// --- 1. seed propagation (FRD-B contract) ------------------------------------

test('qa-seed propagates into the scenario config (FRD-B contract)', () => {
  const withSeed = parseQaScenario('?qa=opening&qa-seed=424242');
  assert.ok(
    withSeed,
    'FRD-B not landed yet: parseQaScenario(?qa=opening&qa-seed=424242) returned undefined. ' +
      'Builder B owns src/qa-scenarios.ts; once qa-seed parsing lands this test passes.',
  );
  assert.equal(withSeed!.config.seed, 424242, 'qa-seed=424242 must override config.seed');
  assert.equal(
    withSeed!.config.seedMode,
    'deterministic',
    'qa-seed must imply seedMode deterministic',
  );
  const without = parseQaScenario('?qa=opening');
  assert.equal(
    without?.config.seed,
    0x5eed,
    'without qa-seed the canonical QA default 0x5eed (24301) must remain',
  );
});

test('qa-seed rejects invalid unsigned forms', () => {
  for (const query of [
    '?qa=opening&qa-seed=-1',
    '?qa=opening&qa-seed=1.5',
    '?qa=opening&qa-seed=01',
    '?qa=opening&qa-seed=abc',
    '?qa=opening&qa-seed=',
    '?qa=opening&qa-seed=4294967296',
    '?qa=opening&qa-seed=+42',
    '?qa=opening&qa-seed= 42',
    '?qa=opening&qa-seed=42 ',
    '?qa=opening&qa-seed=%2042',
    '?qa=opening&qa-seed=42%20',
  ]) {
    const scenario = parseQaScenario(query);
    assert.equal(scenario?.config.seed, 0x5eed, `${query} must not override seed`);
  }
});

test('qa-seed accepts canonical unsigned decimals 0..4294967295', () => {
  for (const [query, expected] of [
    ['?qa=opening&qa-seed=0', 0],
    ['?qa=opening&qa-seed=42', 42],
    ['?qa=opening&qa-seed=4294967295', 4294967295],
  ] as const) {
    const scenario = parseQaScenario(query);
    assert.equal(scenario?.config.seed, expected, `${query} must parse as ${expected}`);
  }
});

test('manifest validator requires nonempty pack.clip when args.clip is true', () => {
  const m = validManifest({
    args: { out: '/tmp/forge', seed: 777, clip: true },
    pack: {
      routes: [validCell()],
      extras: [],
      perspectives: [],
      board: '/tmp/forge/board.png',
      consoleTxt: '/tmp/forge/console.txt',
      criticBrief: '/tmp/forge/critic-brief.txt',
      clip: null,
      clipReadback: null,
    },
  });
  const result = validateManifest(m);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((e) => e.includes('pack.clip')),
    `expected pack.clip error, got: ${result.errors.join('; ')}`,
  );
  assert.ok(
    result.errors.some((e) => e.includes('clipReadback')),
    `expected clipReadback error, got: ${result.errors.join('; ')}`,
  );
});

function validClipReadback() {
  return {
    requestedSeed: 424242,
    actualSeed: 424242,
    seedMatch: true,
    frozen: true,
    tick: CLIP_STEP_TICKS,
    tickDelta: CLIP_STEP_TICKS,
    cameraMode: 'tactical-close',
    paths: true,
    capturedPane: true,
    selectionCount: 1,
    selectedScoutId: 7,
    scoutSelected: true,
    pathColorPixels: CLIP_PATH_COLOR_MIN_PIXELS,
    trimStartMs: 1800,
    rawDurationMs: 12000,
    finalDurationMs: 9000,
    milestones: [{ label: 'panel-ready', ms: 1800 }],
  };
}

test('manifest validator requires clipReadback facts when args.clip is true', () => {
  const complete = validManifest({
    args: { out: '/tmp/forge', seed: 777, clip: true },
    pack: {
      routes: [validCell()],
      extras: [],
      perspectives: [],
      board: '/tmp/forge/board.png',
      consoleTxt: '/tmp/forge/console.txt',
      criticBrief: '/tmp/forge/critic-brief.txt',
      clip: '/tmp/forge/proof.webm',
      clipReadback: validClipReadback(),
    },
  });
  assert.deepEqual(validateManifest(complete), { valid: true, errors: [] });

  const bad = validManifest({
    args: { out: '/tmp/forge', seed: 777, clip: true },
    pack: {
      routes: [validCell()],
      extras: [],
      perspectives: [],
      board: '/tmp/forge/board.png',
      consoleTxt: '/tmp/forge/console.txt',
      criticBrief: '/tmp/forge/critic-brief.txt',
      clip: '/tmp/forge/proof.webm',
      clipReadback: { ...validClipReadback(), capturedPane: false },
    },
  });
  const result = validateManifest(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('capturedPane')));
});

test('verifyClipReadback accepts a truthful runtime snapshot', () => {
  const snap = {
    actualSeed: 424242,
    frozen: true,
    tick: CLIP_STEP_TICKS,
    cameraMode: 'tactical-close',
    overlays: { paths: true },
    perspective: 'player',
    selection: [7],
  };
  const result = verifyClipReadback(snap, 424242, true, 0, {
    scoutId: 7,
    pathColorPixels: CLIP_PATH_COLOR_MIN_PIXELS,
  });
  assert.equal(result.ok, true);
  assert.equal(result.readback.seedMatch, true);
  assert.equal(result.readback.capturedPane, true);
  assert.equal(result.readback.selectionCount, 1);
  assert.equal(result.readback.scoutSelected, true);
  assert.equal(result.readback.pathColorPixels, CLIP_PATH_COLOR_MIN_PIXELS);
});

test('verifyClipScoutSelection requires one selected scout id', () => {
  assert.equal(verifyClipScoutSelection([7], 7).ok, true);
  assert.equal(verifyClipScoutSelection([7], 8).ok, false);
  assert.equal(verifyClipScoutSelection([], 7).ok, false);
  assert.equal(verifyClipScoutSelection([7, 8], 7).ok, false);
});

test('validateClipReadback rejects low path-color pixel counts', () => {
  const low = validateClipReadback({
    ...validClipReadback(),
    pathColorPixels: CLIP_PATH_COLOR_MIN_PIXELS - 1,
  });
  assert.equal(low.valid, false);
  assert.ok(low.errors.some((e) => e.includes('pathColorPixels')));
});

test('capture clip selects scout, arms MOVE, and issues ground move before stepping', () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'tools/forge-review/lib/capture.mjs'),
    'utf8',
  );
  assert.ok(src.includes('selectScout: true'), 'clip must select scout via forge helper');
  assert.ok(src.includes('clickPlayerMoveCommand'), 'clip must arm MOVE through HUD button');
  assert.ok(src.includes('issueClipGroundMove'), 'clip must issue move via canvas pointer path');
  assert.ok(src.includes('resolveClipGroundTapClientCoords'), 'clip must use viewport-safe tap resolver');
  assert.ok(src.includes('clip-guide-selection.png'), 'clip must capture guide+selection still');
  assert.ok(src.includes('CLIP_PATH_COLOR_MIN_PIXELS'), 'clip must gate path-color pixels');
  assert.ok(src.includes('verifyClipScoutSelection'), 'clip must verify scout selection readback');
});

test('resolveClipGroundTapClientCoords stays above bottom HUD at 1366x1024', () => {
  const gameRect = { left: 0, right: 1366, top: 0, bottom: 1024, width: 1366, height: 1024 };
  const bottomTop = 912;
  const topBottom = 56;
  const panelRect = { left: 1080, top: 72, right: 1354, bottom: 980 };
  // Scout projection that failed SPX-21B: southeast offset landed on the command deck.
  const scoutClientX = 720;
  const scoutClientY = 930;
  const tap = resolveClipGroundTapClientCoords({
    gameRect,
    bottomTop,
    topBottom,
    panelRect,
    scoutClientX,
    scoutClientY,
    hudPad: CLIP_GROUND_TAP_HUD_PAD,
  });
  assert.ok(tap.cy < bottomTop - CLIP_GROUND_TAP_HUD_PAD, 'tap must clear bottom HUD');
  assert.ok(tap.cx >= gameRect.left + 8 && tap.cx <= gameRect.right - 8, 'tap must stay in bounds');
  assert.ok(
    !(tap.cx >= panelRect.left - CLIP_GROUND_TAP_HUD_PAD && tap.cy >= panelRect.top - CLIP_GROUND_TAP_HUD_PAD),
    'tap must avoid forge panel',
  );
});

test('resolveClipGroundTapClientCoords prefers the direct diagnostic target when visible', () => {
  const tap = resolveClipGroundTapClientCoords({
    gameRect: { left: 0, right: 1366, top: 0, bottom: 1024, width: 1366, height: 1024 },
    bottomTop: 912,
    topBottom: 56,
    panelRect: { left: 0, top: 0, right: 300, bottom: 1024 },
    scoutClientX: 720,
    scoutClientY: 650,
    targetClientX: 760,
    targetClientY: 420,
    hudPad: CLIP_GROUND_TAP_HUD_PAD,
  });
  assert.deepEqual(tap, { cx: 760, cy: 420 });
});

test('guidance target uses GUIDE prefix and non-circular reticle styles', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'src/hud.ts'), 'utf8');
  assert.ok(src.includes('GUIDE · ${target.label}'), 'guidance label must use GUIDE prefix');
  assert.ok(src.includes('linear-gradient'), 'guidance reticle must use corner brackets');
  assert.ok(!src.includes('#guidance-target{position:fixed;width:46px;height:46px'), 'circular ring style removed');
});

test('capture clip uses ffmpeg trim and snapshot sequence markers', () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'tools/forge-review/lib/capture.mjs'),
    'utf8',
  );
  assert.ok(src.includes('trimClipVideo'), 'captureClip must trim via ffmpeg helper');
  assert.ok(src.includes("markClip(page, 'panel-ready')"), 'must mark panel-ready for trim start');
  assert.ok(
    !src.includes("page.click('#forge-capture')"),
    'must not use Playwright auto-wait click on SNAPSHOT CELL',
  );
  assert.ok(src.includes('activateForgeCaptureButton'), 'must activate SNAPSHOT CELL in-page');
  assert.ok(src.includes('HTMLButtonElement'), 'must assert capture control is a button');
  assert.ok(src.includes('CLIP_FINAL_HOLD_MS'), 'must hold final readback');
  assert.ok(src.includes('CLIP_MAX_DURATION_MS'), 'must enforce short-clip duration bar');
  assert.ok(src.includes('snapshot-captured'), 'must cap trim at snapshot milestone');
  assert.ok(src.includes('unlinkSync(rawPath)'), 'must remove raw video after successful trim');
  assert.equal(OVERLAY_EXPECTED_COLORS.facing, '#FF00FF');
});

test('trimClipVideo uses fast deterministic VP9 encode at 1366x1024', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'tools/forge-review/lib/clip.mjs'), 'utf8');
  assert.ok(src.includes('-deadline') && src.includes('realtime'));
  assert.ok(src.includes('-cpu-used') && src.includes('8'));
  assert.ok(src.includes('-row-mt'));
  assert.ok(src.includes('1366') && src.includes('1024'));
  assert.ok(src.includes('2M'));
  assert.ok(src.includes("'-t'"), 'must support milestone duration cap');
});

test('validateClipReadback rejects clips longer than CLIP_MAX_DURATION_MS', () => {
  assert.equal(CLIP_MAX_DURATION_MS, 25000);
  const ok = validateClipReadback(validClipReadback());
  assert.equal(ok.valid, true);
  const atCeiling = validateClipReadback({ ...validClipReadback(), finalDurationMs: 25000 });
  assert.equal(atCeiling.valid, true);
  const tooLong = validateClipReadback({ ...validClipReadback(), finalDurationMs: 25001 });
  assert.equal(tooLong.valid, false);
  assert.ok(tooLong.errors.some((e) => e.includes('finalDurationMs')));
});

test('path and facing overlay primitives use high-contrast expected colors', () => {
  assert.equal(OVERLAY_TS_COLORS.facing, '#FF00FF');
  assert.equal(OVERLAY_TS_COLORS.paths, '#00FF88');
  const canvas = {
    width: 64,
    height: 64,
    getContext() {
      return {
        save() {},
        restore() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        closePath() {},
        arc() {},
        stroke() {},
        fill() {},
        fillRect() {},
        strokeRect() {},
        fillText() {},
        measureText(text: string) {
          return { width: text.length * 8 };
        },
        set font(_v: string) {},
        set fillStyle(_v: string) {},
        set strokeStyle(_v: string) {},
        set lineWidth(_v: number) {},
        set lineCap(_v: string) {},
        set textAlign(_v: string) {},
        set textBaseline(_v: string) {},
      } as unknown as CanvasRenderingContext2D;
    },
  } as unknown as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  drawPathWaypointMarker(ctx, 20, 20, OVERLAY_TS_COLORS.paths);
  drawFacingArrow(ctx, 10, 30, 40, 10, OVERLAY_TS_COLORS.facing);
  drawPerspectiveChip(ctx, 'rival', 1366);
});

test('review perspective chip and fog contrast are development-only seams', () => {
  const controlSrc = fs.readFileSync(
    path.join(REPO_ROOT, 'src/dev/review-control.ts'),
    'utf8',
  );
  assert.ok(controlSrc.includes('drawPerspectiveChip'), 'review hook must draw perspective chip');
  assert.ok(REVIEW_FOG_VEIL.unexplored.a > SHIPPED_FOG_VEIL_ALPHA.unexplored);
  assert.ok(REVIEW_FOG_VEIL.explored.a > SHIPPED_FOG_VEIL_ALPHA.explored);
  const renderSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/render.ts'), 'utf8');
  assert.ok(renderSrc.includes('REVIEW_FOG_VEIL'), 'review fog must use exported contrast constants');
});

test('validateClipReadback rejects incomplete readback objects', () => {
  const bad = validateClipReadback({ seedMatch: false, frozen: false });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.length >= 3);
});

test('trimClipVideo is exported for ffmpeg post-processing', () => {
  assert.equal(typeof trimClipVideo, 'function');
});

test('raf p99 requires a full 120-sample ring', () => {
  const ring = Array.from({ length: RAF_RING_LENGTH }, (_, i) => 10 + (i % 5));
  assert.equal(rafP99FromRing(ring, RAF_RING_LENGTH - 1), 0);
  const p99 = rafP99FromRing(ring, RAF_RING_LENGTH);
  assert.ok(p99 >= 10 && p99 <= 14, `expected nonzero p99, got ${p99}`);
  assert.equal(RAF_P99_MIN_SAMPLES, RAF_RING_LENGTH);
});

test('camera mode normal restores saved halfH after close then far', () => {
  let state = { cameraMode: 'normal' as const, savedHalfH: null as number | null };
  let halfH = 30;
  const close = applyCameraModeTransition(state, halfH, 'tactical-close');
  assert.ok(close);
  state = { cameraMode: close.cameraMode, savedHalfH: close.savedHalfH };
  halfH = close.halfH;
  assert.equal(halfH, 5);
  assert.equal(state.savedHalfH, 30);

  const far = applyCameraModeTransition(state, halfH, 'strategic-far');
  assert.ok(far);
  state = { cameraMode: far.cameraMode, savedHalfH: far.savedHalfH };
  halfH = far.halfH;
  assert.equal(halfH, 18);
  assert.equal(state.savedHalfH, 30);

  const normal = applyCameraModeTransition(state, halfH, 'normal');
  assert.ok(normal);
  assert.equal(normal.halfH, 30);
  assert.equal(normal.savedHalfH, null);
});

test('normalizeStepCount rejects invalid counts', () => {
  assert.equal(normalizeStepCount(37), 37);
  assert.equal(normalizeStepCount(0), null);
  assert.equal(normalizeStepCount(-1), null);
  assert.equal(normalizeStepCount(1.5), null);
  assert.equal(normalizeStepCount(Number.NaN), null);
  assert.equal(normalizeStepCount(601), null);
});


test('manifest validator accepts a minimal valid fixture', () => {
  assert.deepEqual(validateManifest(validManifest()), { valid: true, errors: [] });
});

test('manifest validator rejects wrong schemaVersion', () => {
  const m = validManifest({ schemaVersion: 'forge-review-deck/0' });
  const result = validateManifest(m);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((e) => e.includes('schemaVersion')),
    `expected a schemaVersion error, got: ${result.errors.join('; ')}`,
  );
});

test('manifest validator rejects missing git.branch', () => {
  const m = validManifest() as { git: Record<string, unknown> };
  delete m.git.branch;
  const result = validateManifest(m);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((e) => e.includes('branch')),
    `expected a git.branch error, got: ${result.errors.join('; ')}`,
  );
});

test('manifest validator rejects ok cell with requestedSeed != actualSeed (hard gate)', () => {
  const m = validManifest();
  m.pack.routes = [validCell({ requestedSeed: 777, actualSeed: 24301 })];
  const result = validateManifest(m);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((e) => e.includes('seed') && e.includes('actualSeed')),
    `expected a seed mismatch error, got: ${result.errors.join('; ')}`,
  );
});

test('manifest validator rejects missing perf.gameWorkP99Ms', () => {
  const m = validManifest();
  delete m.pack.routes[0].perf.gameWorkP99Ms;
  const result = validateManifest(m);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((e) => e.includes('gameWorkP99Ms')),
    `expected a perf.gameWorkP99Ms error, got: ${result.errors.join('; ')}`,
  );
});

test('manifest validator rejects missing typed identity fields on cells', () => {
  const m = validManifest();
  delete m.pack.routes[0].frozen;
  const result = validateManifest(m);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('.frozen')));
});

test('manifest validator rejects incomplete overlays record', () => {
  const m = validManifest();
  m.pack.routes[0].overlays = { paths: false };
  const result = validateManifest(m);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('.overlays')));
});

function overlayEvidenceCell(id: string, overlayId: string, hits = 12) {
  const overlays = {
    paths: false,
    'hit-regions': false,
    'line-of-sight': false,
    orders: false,
    facing: false,
    'entity-ids': false,
  } as Record<string, boolean>;
  overlays[overlayId] = true;
  return validCell({
    id,
    kind: 'extra',
    overlays,
    overlayColorHits: hits,
  });
}

test('manifest validator requires six overlay evidence cells when opening is requested', () => {
  const m = validManifest({
    args: { out: '/tmp/forge', seed: 777, routes: ['opening'] },
    pack: {
      routes: [validCell()],
      extras: [],
      perspectives: [],
      board: '/tmp/forge/board.png',
      consoleTxt: '/tmp/forge/console.txt',
      criticBrief: '/tmp/forge/critic-brief.txt',
      clip: null,
    },
  });
  const missing = validateManifest(m);
  assert.equal(missing.valid, false);
  assert.ok(missing.errors.some((e) => e.includes('overlay evidence cells')));

  const complete = validManifest({
    args: { out: '/tmp/forge', seed: 777, routes: ['opening'] },
    pack: {
      routes: [validCell()],
      extras: [
        overlayEvidenceCell('overlay-paths', 'paths'),
        overlayEvidenceCell('overlay-hit-regions', 'hit-regions'),
        overlayEvidenceCell('overlay-line-of-sight', 'line-of-sight'),
        overlayEvidenceCell('overlay-orders', 'orders'),
        overlayEvidenceCell('overlay-facing', 'facing'),
        overlayEvidenceCell('overlay-entity-ids', 'entity-ids'),
      ],
      perspectives: [],
      board: '/tmp/forge/board.png',
      consoleTxt: '/tmp/forge/console.txt',
      criticBrief: '/tmp/forge/critic-brief.txt',
      clip: null,
    },
  });
  assert.deepEqual(validateManifest(complete), { valid: true, errors: [] });
});

test('manifest validator rejects overlay evidence with low color hits', () => {
  const m = validManifest({
    args: { out: '/tmp/forge', seed: 777, routes: ['opening'] },
    pack: {
      routes: [validCell()],
      extras: [
        overlayEvidenceCell('overlay-paths', 'paths', 3),
        overlayEvidenceCell('overlay-hit-regions', 'hit-regions'),
        overlayEvidenceCell('overlay-line-of-sight', 'line-of-sight'),
        overlayEvidenceCell('overlay-orders', 'orders'),
        overlayEvidenceCell('overlay-facing', 'facing'),
        overlayEvidenceCell('overlay-entity-ids', 'entity-ids'),
      ],
      perspectives: [],
      board: '/tmp/forge/board.png',
      consoleTxt: '/tmp/forge/console.txt',
      criticBrief: '/tmp/forge/critic-brief.txt',
      clip: null,
    },
  });
  const result = validateManifest(m);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('overlay-paths') && e.includes('overlayColorHits')));
});

test('perf warm-up uses at least 125 actual rAF callbacks', () => {
  assert.ok(PERF_WARMUP_FRAMES >= 125, 'warm-up must exceed the 120-sample rings');
  assert.equal(typeof warmupPerfRings, 'function');
});

test('route capture path waits for typed forge control before capture', () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'tools/forge-review/lib/capture.mjs'),
    'utf8',
  );
  const routeFn = src.slice(src.indexOf('export async function captureRouteCell'));
  assert.ok(routeFn.includes('prepareRoutePage'), 'captureRouteCell must call prepareRoutePage');
  const prepareFn = src.slice(src.indexOf('export async function prepareRoutePage'));
  assert.ok(
    prepareFn.includes('waitForForgeControl'),
    'prepareRoutePage must wait for __STARHAVEN_FORGE__',
  );
  assert.ok(
    !routeFn.slice(0, routeFn.indexOf('captureFromPage')).includes('captureFromPage') ||
      routeFn.includes('prepareRoutePage(page'),
    'route capture must prepare the page before captureFromPage',
  );
});

test('qa forge-review gate warms perf via actual rAF callbacks not wall-clock polling', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts/qa-forge-review.mjs'), 'utf8');
  assert.ok(!src.includes('waitForWarmMetrics'), 'time-guessed warm-up must be removed');
  assert.ok(!src.includes('waitForTimeout(200)'), 'wall-clock perf polling must be removed');
  assert.ok(src.includes('settle(page, 125)'), 'must warm with at least 125 actual rAF callbacks');
});

test('qa forge-review gate defaults evidence dir under home cache not os.tmpdir', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts/qa-forge-review.mjs'), 'utf8');
  assert.ok(!src.includes('os.tmpdir()'), 'must not default evidence output to os.tmpdir()');
  assert.ok(src.includes("path.join(os.homedir(), '.cache', 'spacepixelrts', 'forge-review')"));
  assert.ok(src.includes('defaultOutDir'), 'home-backed default output helper must exist');
});

test('route perf gate requires positive distinct forge metrics', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts/forge-capture.mjs'), 'utf8');
  assert.ok(src.includes('requireForgeMetrics: true'), 'forge-capture must require forge metrics on routes');
  const captureSrc = fs.readFileSync(
    path.join(REPO_ROOT, 'tools/forge-review/lib/capture.mjs'),
    'utf8',
  );
  assert.ok(captureSrc.includes('warmupPerfRings'), 'capture must warm up via actual rAF callbacks');
  assert.ok(!captureSrc.includes('PERF_WARMUP_MS'), 'time-guessed perf warm-up must be removed');
  assert.ok(captureSrc.includes('gameWorkP99-zero'));
  assert.ok(captureSrc.includes('rafP99-zero'));
  assert.ok(captureSrc.includes('perf-fields-conflated'));
});

test('console.txt is written after clip and includes clip console lines', () => {
  assert.deepEqual(CAPTURE_WRITE_ORDER, ['board', 'clip', 'console', 'critic-brief']);
  const captureSrc = fs.readFileSync(path.join(REPO_ROOT, 'scripts/forge-capture.mjs'), 'utf8');
  const clipIdx = captureSrc.indexOf('captureClip(browser');
  const consoleIdx = captureSrc.indexOf('buildConsoleTxt(manifest');
  assert.ok(clipIdx > 0 && consoleIdx > clipIdx, 'console.txt must be built after clip capture');

  const manifest = validManifest();
  const clipConsole = [{ seq: 99, type: 'log', text: 'clip hold complete' }];
  const text = buildConsoleTxt(manifest, clipConsole);
  assert.ok(text.includes('clip [log] clip hold complete'));
});

test('critic brief names captured routes instead of always saying all 13 states', () => {
  const manifest = validManifest({
    pack: {
      routes: [validCell({ id: 'opening' })],
      extras: [],
      perspectives: [],
      board: '/tmp/forge/board.png',
      consoleTxt: '/tmp/forge/console.txt',
      criticBrief: '/tmp/forge/critic-brief.txt',
      clip: null,
    },
  });
  const focused = composeCriticBrief({
    manifest,
    gateP99: null,
    renderer: 'SwiftShader',
    softwareRenderer: true,
    routes: ['opening'],
    orientations: ['landscape-left'],
    totalRouteCount: 13,
  });
  assert.ok(focused.includes('1 captured route(s): opening'));
  assert.ok(!focused.includes('all 13 states'));

  const full = composeCriticBrief({
    manifest: validManifest({
      pack: {
        routes: Array.from({ length: 13 }, (_, index) => validCell({ id: `route-${index}` })),
        extras: [],
        perspectives: [],
        board: '/tmp/forge/board.png',
        consoleTxt: '/tmp/forge/console.txt',
        criticBrief: '/tmp/forge/critic-brief.txt',
        clip: null,
      },
    }),
    gateP99: null,
    renderer: 'SwiftShader',
    softwareRenderer: true,
    routes: Array.from({ length: 13 }, (_, index) => `route-${index}`),
    orientations: ['landscape-left'],
    totalRouteCount: 13,
  });
  assert.ok(full.includes('all 13 states'));
});

// --- 3. pixel analysis -------------------------------------------------------

test('analyzePng reports sane numbers for a pure palette-color image', () => {
  const paletteRgb = loadPaletteRgb(REPO_ROOT);
  const png = new PNG({ width: 64, height: 64 });
  // cream #F0E7D2 is a real palette token.
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0xf0;
    png.data[i + 1] = 0xe7;
    png.data[i + 2] = 0xd2;
    png.data[i + 3] = 255;
  }
  const image = analyzePng(PNG.sync.write(png), paletteRgb);
  assert.equal(image.width, 64);
  assert.equal(image.height, 64);
  assert.equal(image.distinctColors, 1, 'a solid color must quantize to one bucket');
  assert.equal(image.paletteAdherence, 1, 'a pure palette token must adhere 100%');
  assert.ok(image.meanLuma > 200, `cream meanLuma should be bright, got ${image.meanLuma}`);
  assert.equal(isBlack(image), false);
  assert.equal(isEmpty(image), false);
});

test('isBlack / isEmpty flag a black image', () => {
  const png = new PNG({ width: 64, height: 64 }); // zero-filled = black
  const image = analyzePng(PNG.sync.write(png), []);
  assert.equal(isBlack(image), true);
  assert.equal(isEmpty(image), true);
});

// --- 4. serial plan builder --------------------------------------------------

test('buildCapturePlan yields stable route x orientation order with dedupe', () => {
  const plan = buildCapturePlan(['opening', 'battle', 'opening'], [
    'landscape-left',
    'landscape-right',
  ]);
  assert.equal(plan.length, 4, 'duplicate route must be deduped');
  assert.deepEqual(
    plan.map((p) => `${p.route}/${p.orientation}`),
    [
      'opening/landscape-left',
      'opening/landscape-right',
      'battle/landscape-left',
      'battle/landscape-right',
    ],
    'route-major stable order expected',
  );
});

// --- 5. production isolation -------------------------------------------------

const FORGE_ARTIFACT_MARKERS = [
  'forge-review',
  '__STARHAVEN_FORGE__',
  'FORGE REVIEW',
  'src/dev/review',
  'review-control',
  'review-overlays',
  '__STARHAVEN_FORGE_RAF_TICK__',
];

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

function scanTextForMarkers(label: string, text: string): string[] {
  const hits: string[] = [];
  for (const marker of FORGE_ARTIFACT_MARKERS) {
    if (text.includes(marker)) hits.push(`${label} contains "${marker}"`);
  }
  return hits;
}

test('production build inputs and dist content contain no forge-review artifacts', () => {
  const viteConfig = fs.readFileSync(path.join(REPO_ROOT, 'vite.config.ts'), 'utf8');
  const inputs = [...viteConfig.matchAll(/input:\s*\{([\s\S]*?)\}/g)].flatMap((m) =>
    [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]),
  );
  assert.ok(inputs.length >= 1, 'expected at least one rollup input');
  for (const input of inputs) {
    assert.ok(
      !input.includes('tools/'),
      `rollup input "${input}" must not include tools/`,
    );
  }
  const indexHtml = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  const desktopHtml = fs.readFileSync(path.join(REPO_ROOT, 'desktop.html'), 'utf8');
  for (const [label, html] of [
    ['index.html', indexHtml],
    ['desktop.html', desktopHtml],
  ]) {
    assert.ok(!html.includes('forge-review'), `production ${label} must not reference forge-review`);
  }
  const mainTs = fs.readFileSync(path.join(REPO_ROOT, 'src/main.ts'), 'utf8');
  assert.ok(
    !mainTs.includes("from './dev/review-control'") && !mainTs.includes('from "./dev/review-control"'),
    'main.ts must not statically import review-control',
  );
  assert.ok(
    !mainTs.includes("from './dev/review-overlays'") && !mainTs.includes('from "./dev/review-overlays"'),
    'main.ts must not statically import review-overlays',
  );

  const distDir = path.join(REPO_ROOT, 'dist');
  assert.ok(fs.existsSync(distDir), 'dist/ must exist — run npm run build before this test');
  assert.ok(!fs.existsSync(path.join(distDir, 'tools')), 'dist/tools must not exist in production output');

  const distViolations: string[] = [];
  for (const file of walkFiles(distDir)) {
    const rel = path.relative(distDir, file);
    if (rel.includes('forge-review')) {
      distViolations.push(`dist contains forge-review path: ${rel}`);
      continue;
    }
    const ext = path.extname(file).toLowerCase();
    if (!['.js', '.html', '.css', '.map', '.json'].includes(ext)) continue;
    const text = fs.readFileSync(file, 'utf8');
    distViolations.push(...scanTextForMarkers(rel, text));
  }
  assert.deepEqual(distViolations, [], distViolations.join('\n'));
});

test('qa faction overrides clone canonical config without changing defaults', () => {
  const swapped = parseQaScenario('?qa=opening&qa-player-faction=gravemark&qa-ai-faction=sunweaver');
  assert.equal(swapped?.config.playerFaction, 'gravemark');
  assert.equal(swapped?.config.aiFaction, 'sunweaver');
});

// --- runner ------------------------------------------------------------------

let failed = 0;
for (const t of tests) {
  try {
    t.run();
    console.log(`ok   - ${t.name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL - ${t.name}`);
    console.log(`       ${err instanceof Error ? err.message : String(err)}`);
  }
}
console.log(`\nforge-review.test.ts: ${tests.length - failed}/${tests.length} passed${failed ? ` (${failed} failed)` : ''}`);
process.exit(failed === 0 ? 0 : 1);
