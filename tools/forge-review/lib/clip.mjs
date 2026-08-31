// Forge Review Deck — proof clip trim + readback validation (round 2).
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const CLIP_STEP_TICKS = 37;
export const CLIP_PANEL_PREROLL_MS = 2200;
export const CLIP_ACTION_HOLD_MS = 1100;
export const CLIP_FINAL_HOLD_MS = 2400;

/** Required clip readback facts when args.clip is true. */
export const CLIP_READBACK_REQUIRED = {
  frozen: true,
  tickDelta: CLIP_STEP_TICKS,
  cameraMode: 'tactical-close',
  paths: true,
  capturedPane: true,
};

/**
 * Verify runtime clip readback before page close.
 * @param {object} snap — forge snapshot JSON
 * @param {number} requestedSeed
 * @param {boolean} paneCaptured — data-forge-pane === 'identity'
 */
export function verifyClipReadback(snap, requestedSeed, paneCaptured, tickBefore = 0) {
  const errors = [];
  const actualSeed = Number(snap?.actualSeed ?? 0) >>> 0;
  const requested = Number(requestedSeed) >>> 0;
  const tick = Number(snap?.tick ?? 0);
  const tickDelta = tick - Number(tickBefore);
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
 */
export async function trimClipVideo({ rawPath, outPath, trimStartSec }) {
  const start = Math.max(0, trimStartSec);
  await execFileAsync('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    rawPath,
    '-ss',
    String(start),
    '-an',
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '2M',
    outPath,
  ]);
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
  if (!Number.isFinite(readback.trimStartMs) || readback.trimStartMs < 0) {
    errors.push('clipReadback.trimStartMs missing or invalid');
  }
  if (!Number.isFinite(readback.rawDurationMs) || readback.rawDurationMs <= 0) {
    errors.push('clipReadback.rawDurationMs missing or invalid');
  }
  if (!Number.isFinite(readback.finalDurationMs) || readback.finalDurationMs <= 0) {
    errors.push('clipReadback.finalDurationMs missing or invalid');
  }
  return { valid: errors.length === 0, errors };
}
