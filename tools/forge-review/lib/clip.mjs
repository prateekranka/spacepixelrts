// Forge Review Deck — proof clip trim + readback validation (round 2).
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const CLIP_STEP_TICKS = 37;
export const CLIP_PANEL_PREROLL_MS = 2200;
export const CLIP_ACTION_HOLD_MS = 1100;
export const CLIP_FINAL_HOLD_MS = 2400;
/** Trimmed proof.webm must be positive and at most this many milliseconds. */
export const CLIP_MAX_DURATION_MS = 25000;
export const CLIP_VIEWPORT = { width: 1366, height: 1024 };
/** Minimum path-overlay color hits on the final clip screenshot (matches overlay evidence gate). */
export const CLIP_PATH_COLOR_MIN_PIXELS = 8;

/** Required clip readback facts when args.clip is true. */
export const CLIP_READBACK_REQUIRED = {
  frozen: true,
  tickDelta: CLIP_STEP_TICKS,
  cameraMode: 'tactical-close',
  paths: true,
  capturedPane: true,
  selectionCount: 1,
  scoutSelected: true,
  pathColorMinPixels: CLIP_PATH_COLOR_MIN_PIXELS,
};

/** Pure check: one selected entity and it is the deterministic player scout. */
export function verifyClipScoutSelection(selection, scoutId) {
  const ids = Array.isArray(selection) ? selection : [];
  const selectedId = ids.length === 1 ? ids[0] : null;
  const scoutSelected = scoutId != null && selectedId === scoutId;
  return {
    ok: scoutSelected,
    selectionCount: ids.length,
    selectedId,
    scoutId: scoutId ?? null,
    scoutSelected,
  };
}

/**
 * Verify runtime clip readback before page close.
 * @param {object} snap — forge snapshot JSON
 * @param {number} requestedSeed
 * @param {boolean} paneCaptured — data-forge-pane === 'identity'
 */
export function verifyClipReadback(snap, requestedSeed, paneCaptured, tickBefore = 0, extras = {}) {
  const errors = [];
  const actualSeed = Number(snap?.actualSeed ?? 0) >>> 0;
  const requested = Number(requestedSeed) >>> 0;
  const tick = Number(snap?.tick ?? 0);
  const tickDelta = tick - Number(tickBefore);
  const scoutId = extras.scoutId ?? null;
  const selectionCheck = verifyClipScoutSelection(snap?.selection, scoutId);
  const pathColorPixels = Number(extras.pathColorPixels ?? 0);
  const pathColorMin = Number(extras.pathColorMin ?? CLIP_PATH_COLOR_MIN_PIXELS);
  if (actualSeed !== requested) {
    errors.push(`seed-mismatch requested=${requested} actual=${actualSeed}`);
  }
  if (!snap?.frozen) errors.push('frozen-readback-failed');
  if (tickDelta !== CLIP_STEP_TICKS) {
    errors.push(`tick-delta expected=${CLIP_STEP_TICKS} actual=${tickDelta}`);
  }
  if (snap?.cameraMode !== 'tactical-close') {
    errors.push(`camera-readback expected=tactical-close actual=${snap?.cameraMode ?? '?'}`);
  }
  if (!snap?.overlays?.paths) errors.push('paths-overlay-readback-failed');
  if (!paneCaptured) errors.push('captured-pane-readback-failed');
  if (selectionCheck.selectionCount !== CLIP_READBACK_REQUIRED.selectionCount) {
    errors.push(
      `selection-count expected=${CLIP_READBACK_REQUIRED.selectionCount} actual=${selectionCheck.selectionCount}`,
    );
  }
  if (scoutId != null && !selectionCheck.scoutSelected) {
    errors.push(
      `scout-selection expected=${scoutId} actual=${selectionCheck.selectedId ?? 'none'}`,
    );
  }
  if (pathColorPixels < pathColorMin) {
    errors.push(`path-color pixels=${pathColorPixels} < ${pathColorMin}`);
  }
  return {
    ok: errors.length === 0,
    errors,
    readback: {
      requestedSeed: requested,
      actualSeed,
      seedMatch: actualSeed === requested,
      frozen: Boolean(snap?.frozen),
      tick,
      tickDelta,
      cameraMode: snap?.cameraMode ?? null,
      paths: Boolean(snap?.overlays?.paths),
      capturedPane: paneCaptured,
      perspective: snap?.perspective ?? null,
      selectionCount: selectionCheck.selectionCount,
      selectedScoutId: selectionCheck.selectedId,
      scoutSelected: selectionCheck.scoutSelected,
      pathColorPixels,
    },
  };
}

/** @returns {Promise<{ durationSec: number, sizeBytes: number }>} */
export async function probeVideo(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'format=duration,size',
    '-of',
    'json',
    filePath,
  ]);
  const probe = JSON.parse(stdout);
  return {
    durationSec: Number(probe.format?.duration ?? 0),
    sizeBytes: Number(probe.format?.size ?? 0),
  };
}

/**
 * Trim raw Playwright WebM to start at panel-ready elapsed time.
 * Removes browser-load and game-only lead-in; retains panel preroll onward.
 * When trimDurationSec is set, caps output at the proof sequence (snapshot + final hold).
 */
export async function trimClipVideo({ rawPath, outPath, trimStartSec, trimDurationSec = null }) {
  const start = Math.max(0, trimStartSec);
  const ffmpegArgs = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    rawPath,
    '-ss',
    String(start),
    '-an',
    '-vf',
    `scale=${CLIP_VIEWPORT.width}:${CLIP_VIEWPORT.height}`,
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '2M',
    '-deadline',
    'realtime',
    '-cpu-used',
    '8',
    '-row-mt',
    '1',
  ];
  if (trimDurationSec != null && Number(trimDurationSec) > 0) {
    ffmpegArgs.push('-t', String(trimDurationSec));
  }
  ffmpegArgs.push(outPath);
  await execFileAsync('ffmpeg', ffmpegArgs);
  if (!fs.existsSync(outPath) || fs.statSync(outPath).size <= 0) {
    throw new Error('trim produced empty output');
  }
  const probed = await probeVideo(outPath);
  if (!(probed.durationSec > 0.5) || !(probed.sizeBytes > 0)) {
    throw new Error(`trim output invalid duration=${probed.durationSec} size=${probed.sizeBytes}`);
  }
  return probed;
}

/** Validate persisted clipReadback for manifest schema. */
export function validateClipReadback(readback) {
  const errors = [];
  if (readback == null || typeof readback !== 'object') {
    return { valid: false, errors: ['clipReadback missing or invalid'] };
  }
  if (readback.seedMatch !== true) errors.push('clipReadback.seedMatch must be true');
  if (readback.frozen !== CLIP_READBACK_REQUIRED.frozen) {
    errors.push(`clipReadback.frozen must be ${CLIP_READBACK_REQUIRED.frozen}`);
  }
  if (readback.tickDelta !== CLIP_READBACK_REQUIRED.tickDelta) {
    errors.push(`clipReadback.tickDelta must be ${CLIP_READBACK_REQUIRED.tickDelta}`);
  }
  if (readback.cameraMode !== CLIP_READBACK_REQUIRED.cameraMode) {
    errors.push(`clipReadback.cameraMode must be ${CLIP_READBACK_REQUIRED.cameraMode}`);
  }
  if (readback.paths !== CLIP_READBACK_REQUIRED.paths) {
    errors.push(`clipReadback.paths must be ${CLIP_READBACK_REQUIRED.paths}`);
  }
  if (readback.capturedPane !== CLIP_READBACK_REQUIRED.capturedPane) {
    errors.push(`clipReadback.capturedPane must be ${CLIP_READBACK_REQUIRED.capturedPane}`);
  }
  if (readback.selectionCount !== CLIP_READBACK_REQUIRED.selectionCount) {
    errors.push(`clipReadback.selectionCount must be ${CLIP_READBACK_REQUIRED.selectionCount}`);
  }
  if (readback.scoutSelected !== CLIP_READBACK_REQUIRED.scoutSelected) {
    errors.push(`clipReadback.scoutSelected must be ${CLIP_READBACK_REQUIRED.scoutSelected}`);
  }
  if (
    !Number.isFinite(readback.pathColorPixels) ||
    readback.pathColorPixels < CLIP_PATH_COLOR_MIN_PIXELS
  ) {
    errors.push(
      `clipReadback.pathColorPixels must be >= ${CLIP_PATH_COLOR_MIN_PIXELS} got ${readback.pathColorPixels}`,
    );
  }
  if (!Number.isFinite(readback.trimStartMs) || readback.trimStartMs < 0) {
    errors.push('clipReadback.trimStartMs missing or invalid');
  }
  if (!Number.isFinite(readback.rawDurationMs) || readback.rawDurationMs <= 0) {
    errors.push('clipReadback.rawDurationMs missing or invalid');
  }
  if (!Number.isFinite(readback.finalDurationMs) || readback.finalDurationMs <= 0) {
    errors.push('clipReadback.finalDurationMs missing or invalid');
  } else if (readback.finalDurationMs > CLIP_MAX_DURATION_MS) {
    errors.push(
      `clipReadback.finalDurationMs must be <= ${CLIP_MAX_DURATION_MS} got ${readback.finalDurationMs}`,
    );
  }
  return { valid: errors.length === 0, errors };
}
