#!/usr/bin/env tsx
/**
 * forge-art-import.mjs — image-backed candidate import for Forge Art Lab
 * (docs/LUMEN_GUARD_IMAGE_CANDIDATE.md "Repository contract" + "Proof and
 * acceptance").
 *
 * Usage:
 *   npm run forge:art:import -- \
 *     --asset=sunweaver-lumen-guard \
 *     --reference=/absolute/path/to/reference.png
 *
 * The command:
 *   1. validates the asset (public, combat row, unit category);
 *   2. validates the reference file (PNG required; WebP refused explicitly
 *      because the pngjs decode stack cannot decode it);
 *   3. copies the reference into reference.png atomically (temp + rename) and
 *      records its sha256/dims;
 *   4. reads + shape-validates Builder 2's generated candidate source via the
 *      typed seam (tools/forge-art/src/candidate-source.ts);
 *   5. writes candidate.png (512x128, dir-major 8x2 grid) and manifest.json
 *      atomically (temp + rename), then verifies every hash on disk.
 *
 * Idempotent: re-running with the same reference and an already-valid imported
 * state writes nothing and reports "unchanged (already imported)".
 *
 * Exit codes (family-consistent with forge-art-accept):
 *   2 usage · 8 unknown asset · 1 unsupported/malformed input (non-combat,
 *   building note, WebP, corrupt PNG, missing file, malformed generated module)
 *   9 partial candidate / missing generated source · 10 post-write verification
 *   failure.
 *
 * Writes ONLY inside tools/forge-art/candidates/<assetId>/. Never touches the
 * accepted baselines, the registry, or production source.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { REPO_ROOT, parseArgs, sha256File } from './forge-art-lib.mjs';
import { ASSET_BY_ID } from '../tools/forge-art/src/registry';
import { validateCandidateManifest } from '../tools/forge-art/src/candidate-schema';
import { loadGeneratedCandidateSource } from '../tools/forge-art/src/candidate-source';
import {
  candidateAssetDir,
  loadCandidateManifestFromDisk,
  loadCandidateSheetFromDisk,
} from '../tools/forge-art/src/candidate-disk';

const CELL_W = 64;
const CELL_H = 64;
const COLS = 8;
const ROWS = 2;

function fail(code, message) {
  console.error(`forge-art-import: REFUSED (${code}): ${message}`);
  process.exit(code);
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function countAlpha(bytes) {
  let count = 0;
  for (let i = 3; i < bytes.length; i += 4) if (bytes[i] > 0) count++;
  return count;
}

/** Render a dir-major 8x2 grid of 64x64 cells into a deterministic PNG. */
function renderGridPng(cells) {
  const png = new PNG({ width: CELL_W * COLS, height: CELL_H * ROWS });
  png.data.fill(0);
  cells.forEach((cell, index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const bytes = cell.bytes;
    for (let y = 0; y < CELL_H; y++) {
      for (let x = 0; x < CELL_W; x++) {
        const si = (x + y * CELL_W) * 4;
        const di = (col * CELL_W + x + (row * CELL_H + y) * (CELL_W * COLS)) * 4;
        png.data[di] = bytes[si];
        png.data[di + 1] = bytes[si + 1];
        png.data[di + 2] = bytes[si + 2];
        png.data[di + 3] = bytes[si + 3];
      }
    }
  });
  return PNG.sync.write(png);
}

function isPngSignature(head) {
  return (
    head.length >= 8 &&
    head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 &&
    head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a
  );
}

function isWebpSignature(head) {
  return (
    head.length >= 12 &&
    head.toString('ascii', 0, 4) === 'RIFF' &&
    head.toString('ascii', 8, 12) === 'WEBP'
  );
}

/** Recompute the on-disk sheet cell hashes; throws on any grid mismatch. */
function sheetCellHashes(pngPath) {
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  if (png.width !== CELL_W * COLS || png.height !== CELL_H * ROWS) {
    throw new Error(`candidate.png is ${png.width}x${png.height}, expected ${CELL_W * COLS}x${CELL_H * ROWS}`);
  }
  const hashes = [];
  for (let index = 0; index < COLS * ROWS; index++) {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const bytes = Buffer.alloc(CELL_W * CELL_H * 4);
    for (let y = 0; y < CELL_H; y++) {
      const srcStart = (col * CELL_W + (row * CELL_H + y) * png.width) * 4;
      png.data.copy(bytes, y * CELL_W * 4, srcStart, srcStart + CELL_W * 4);
    }
    hashes.push(sha256Bytes(bytes));
  }
  return hashes;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const assetId = typeof args.asset === 'string' ? args.asset : '';
  const referencePath = typeof args.reference === 'string' ? args.reference : '';
  if (!assetId || !referencePath) {
    fail(2, 'usage: --asset=<id> --reference=/absolute/path/to/reference.png');
  }
  if (!path.isAbsolute(referencePath)) {
    fail(2, '--reference must be an absolute path');
  }

  const def = ASSET_BY_ID[assetId];
  if (!def) fail(8, `unknown asset "${assetId}"`);
  if (def.adapterId !== 'combat') {
    fail(
      1,
      `unsupported category for "${assetId}": the manifest schema supports unit|building, ` +
        'but this vertical slice converts combat reference images only',
    );
  }
  if (def.category !== 'unit') fail(1, `asset "${assetId}" is not a unit`);

  if (!fs.existsSync(referencePath) || !fs.statSync(referencePath).isFile()) {
    fail(1, `reference file not found: ${referencePath}`);
  }

  const head = fs.readFileSync(referencePath).subarray(0, 12);
  if (isWebpSignature(head)) {
    fail(1, 'WebP reference refused: this import stack (pngjs) cannot decode WebP; convert the reference to PNG and retry');
  }
  if (!isPngSignature(head)) {
    fail(1, 'reference must be a PNG file (bad signature)');
  }

  let sourcePng;
  try {
    sourcePng = PNG.sync.read(fs.readFileSync(referencePath));
  } catch (error) {
    fail(1, `malformed PNG: ${error instanceof Error ? error.message : String(error)}`);
  }
  const sourceSha256 = sha256File(referencePath);
  const sourceWidth = sourcePng.width;
  const sourceHeight = sourcePng.height;

  // Builder 2's generated candidate source — narrow typed seam. Missing module
  // is an explicit refusal (partial candidate), never an invented fallback.
  const generated = await loadGeneratedCandidateSource(assetId);
  if (!generated.present) {
    if (generated.reason === 'missing-module') {
      fail(
        9,
        `partial candidate: ${generated.message}. Import writes nothing until the generated source lands.`,
      );
    }
    fail(1, generated.message);
  }
  const cells = generated.module.cells;

  const dir = candidateAssetDir(assetId);
  const referenceOut = path.join(dir, 'reference.png');
  const candidateOut = path.join(dir, 'candidate.png');
  const manifestOut = path.join(dir, 'manifest.json');

  // Idempotency: an already-imported state that fully verifies writes nothing.
  const existingManifest = loadCandidateManifestFromDisk(assetId);
  const existingSheet = loadCandidateSheetFromDisk(assetId);
  if (
    'manifest' in existingManifest &&
    'cells' in existingSheet &&
    fs.existsSync(referenceOut) &&
    sha256File(referenceOut) === sourceSha256 &&
    existingManifest.manifest.sourceSha256 === sourceSha256 &&
    existingSheet.cells.length === cells.length &&
    existingSheet.cells.every((cell, i) => sha256Bytes(cell.bytes) === sha256Bytes(cells[i].bytes))
  ) {
    console.log(`forge-art-import: unchanged (already imported) for ${assetId}`);
    console.log(`  reference: ${referenceOut} (${sourceWidth}x${sourceHeight}, sha256 ${sourceSha256.slice(0, 16)}…)`);
    console.log(`  candidate: ${candidateOut} · manifest: ${manifestOut}`);
    return;
  }

  // ── atomic writes (temp + rename, mirroring forge-art-accept) ────────────
  fs.mkdirSync(dir, { recursive: true });

  const tmpReference = `${referenceOut}.tmp`;
  fs.copyFileSync(referencePath, tmpReference);
  fs.renameSync(tmpReference, referenceOut);

  const sheetBytes = renderGridPng(cells);
  const tmpPng = `${candidateOut}.tmp`;
  fs.writeFileSync(tmpPng, sheetBytes);
  fs.renameSync(tmpPng, candidateOut);

  const manifest = {
    schemaVersion: 1,
    assetId,
    label: def.label,
    civilization: def.faction,
    category: def.category,
    adapter: 'combat',
    sourceKind: 'reference-image',
    sourcePath: `tools/forge-art/candidates/${assetId}/reference.png`,
    sourceSha256,
    sourceWidth,
    sourceHeight,
    candidatePath: `tools/forge-art/candidates/${assetId}/candidate.png`,
    candidateSourcePath: `src/generated/${assetId}-candidate.ts`,
    generatedAt: new Date().toISOString(),
    algorithm: 'combat-reference-v1',
    status: 'draft',
    target: { cellW: CELL_W, cellH: CELL_H, cols: COLS, rows: ROWS, order: 'dir-major', frameCount: cells.length },
    directions: { authored: [0, 1, 2, 6, 7], mirrored: [3, 4, 5] },
    poses: { count: 2, names: ['primary', 'alternate'] },
    frames: cells.map((cell) => ({
      key: cell.key,
      sha256: sha256Bytes(cell.bytes),
      width: CELL_W,
      height: CELL_H,
      alphaPixels: countAlpha(cell.bytes),
    })),
  };
  const manifestErrors = validateCandidateManifest(manifest);
  if (manifestErrors.length > 0) {
    fail(1, `generated manifest fails schema v1 (${assetId}): ${manifestErrors.join('; ')}`);
  }
  const tmpManifest = `${manifestOut}.tmp`;
  fs.writeFileSync(tmpManifest, JSON.stringify(manifest, null, 2));
  fs.renameSync(tmpManifest, manifestOut);

  // ── post-write verification (disk authority) ─────────────────────────────
  if (sha256File(referenceOut) !== sourceSha256) {
    fail(10, 'post-write verification failed: reference.png hash mismatch');
  }
  const diskManifest = loadCandidateManifestFromDisk(assetId);
  if (!('manifest' in diskManifest)) {
    fail(10, `post-write verification failed: manifest invalid after write (${'error' in diskManifest ? diskManifest.error : 'missing'})`);
  }
  const diskSheet = loadCandidateSheetFromDisk(assetId);
  if (!('cells' in diskSheet)) {
    fail(10, `post-write verification failed: candidate.png invalid after write (${'error' in diskSheet ? diskSheet.error : 'missing'})`);
  }
  const diskHashes = sheetCellHashes(candidateOut);
  const expectedHashes = diskManifest.manifest.frames.map((frame) => frame.sha256);
  if (diskHashes.some((hash, i) => hash !== expectedHashes[i])) {
    fail(10, 'post-write verification failed: candidate.png cells do not match manifest frame hashes');
  }
  if (diskManifest.manifest.sourceSha256 !== sourceSha256) {
    fail(10, 'post-write verification failed: manifest sourceSha256 does not match reference.png');
  }

  console.log(`forge-art-import: imported ${assetId} (combat reference image)`);
  console.log(`  reference: ${referenceOut} · ${sourceWidth}x${sourceHeight} · sha256 ${sourceSha256.slice(0, 16)}…`);
  console.log(`  generated source: ${generated.sourcePath} (${cells.length} cells)`);
  console.log(`  candidate: ${candidateOut} · ${CELL_W * COLS}x${CELL_H * ROWS} · dir-major ${COLS}x${ROWS}`);
  console.log(`  manifest: ${manifestOut} · status draft · ${manifest.frames.length} frame hashes verified`);
}

main().catch((error) => {
  console.error(`forge-art-import: fatal: ${error?.stack ?? error}`);
  process.exitCode = 1;
});
