#!/usr/bin/env tsx
/**
 * forge-art-accept.mjs — SAFE accepted-baseline acceptance for Forge Art Lab.
 *
 * DRY-RUN BY DEFAULT. With --apply, updates ONLY the selected asset's accepted
 * baseline after every check passes. Never commits. Never runs from the browser.
 *
 * Validation order (exit codes per spec §14):
 *   2 usage · 1 malformed evidence/registry/schema · 7 missing baseline · 8 unknown asset
 *   3 stale evidence · 4 failed gate · 5 hash mismatch · 6 unrelated drift
 *   9 partial candidate · 10 post-write verification failure
 * The written manifest is always rebuilt in the complete §5 v1 shape (registry/
 * adapter-derived fields + paletteStats; never spread from the accepted file) and
 * re-validated with validateBaselineManifest() before the atomic rename (R1 M1).
 *
 * Usage:
 *   npx tsx scripts/forge-art-accept.mjs --asset=<id> --evidence=<abs-manifest> [--apply]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';
import { REPO_ROOT, parseArgs, sha256File } from './forge-art-lib.mjs';
import { approveCandidateManifest, canonicalApprovalJson } from './forge-art-approval-lib.mjs';
import { STARHOLD_PALETTE } from '../src/palette';
import { Pix, applyCombatExteriorRim } from '../src/sprites';
import { ASSET_BY_ID, CATALOG } from '../tools/forge-art/src/registry';
import { loadCandidateManifestFromDisk, loadCandidateSheetFromDisk, referenceInfoFromDisk } from '../tools/forge-art/src/candidate-disk';
import { loadGeneratedCandidateSource } from '../tools/forge-art/src/candidate-source';
import {
  frameKeyOrder,
  gridGeometryFor,
  cellSha256FromBytes,
  validateBaselineManifest,
} from '../tools/forge-art/src/baseline-schema';

const require = createRequire(import.meta.url);
const BASELINES_DIR = path.join(REPO_ROOT, 'tools', 'forge-art', 'baselines');

function gitRevision() {
  return execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function gitDirtyFiles() {
  const out = execFileSync('git', ['-C', REPO_ROOT, 'status', '--porcelain'], { encoding: 'utf8' });
  return out.split('\n').map((line) => line.slice(3).trim()).filter(Boolean);
}

function fail(code, message) {
  console.error(`forge-art-accept: REFUSED (${code}): ${message}`);
  process.exit(code);
}

function readRegistry() {
  const file = path.join(BASELINES_DIR, 'registry.json');
  if (!fs.existsSync(file)) return { schemaVersion: 1, assets: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || typeof parsed.assets !== 'object') throw new Error('bad shape');
    return parsed;
  } catch (error) {
    fail(1, `malformed registry.json: ${error?.message ?? error}`);
  }
}

/** Re-derive per-frame hashes from an on-disk baseline.png using the grid geometry. */
function hashesFromPng(pngPath, geo, keys = []) {
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  if (png.width !== geo.cellW * geo.cols || png.height !== geo.cellH * geo.rows) {
    throw new Error(`baseline.png is ${png.width}x${png.height}, expected ${geo.cellW * geo.cols}x${geo.cellH * geo.rows}`);
  }
  const hashes = {};
  let index = 0;
  for (let row = 0; row < geo.rows; row++) {
    for (let col = 0; col < geo.cols; col++) {
      const bytes = Buffer.alloc(geo.cellW * geo.cellH * 4);
      for (let y = 0; y < geo.cellH; y++) {
        const srcStart = ((col * geo.cellW) + (row * geo.cellH + y) * png.width) * 4;
        png.data.copy(bytes, y * geo.cellW * 4, srcStart, srcStart + geo.cellW * 4);
      }
      hashes[keys[index] ?? `cell${index}`] = cellSha256FromBytes(bytes);
      index++;
    }
  }
  return hashes;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Accept both proof.metrics[assetId] and a direct proof.metrics object. */
function normalizeMetricPack(evidence, assetId) {
  if (!isRecord(evidence.metrics)) return null;
  const direct = evidence.metrics;
  if (isRecord(direct.candidateHashes)) return direct;
  const keyed = direct[assetId];
  if (isRecord(keyed) && isRecord(keyed.candidateHashes)) return keyed;
  return null;
}

function normalizeCandidateHashes(evidence, assetId) {
  const pack = normalizeMetricPack(evidence, assetId);
  if (!pack) fail(1, `malformed evidence: metrics must expose candidateHashes for ${assetId}`);
  const hashes = pack.candidateHashes;
  const entries = Object.entries(hashes);
  if (entries.length === 0) fail(1, 'malformed evidence: candidateHashes must be non-empty');
  for (const [key, hash] of entries) {
    if (!key || typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) {
      fail(1, `malformed evidence: candidateHashes.${key} must be a 64-char hex sha256`);
    }
  }
  return hashes;
}

function sameSet(a, b) {
  return a.size === b.size && [...a].every((value) => b.has(value));
}

function nonBaselineFiles(files) {
  return files.filter((file) => !file.startsWith('tools/forge-art/baselines'));
}

const RIM_COLORS = {
  outer: hexRgb(STARHOLD_PALETTE.amber),
  inner: hexRgb(STARHOLD_PALETTE.cream),
};

function hexRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/**
 * Read the repo-backed raw candidate, verify the generated source agrees with
 * candidate.png, then apply the normal row-0 exterior rim exactly once. This
 * is the only frame source accepted by the baseline promotion path.
 */
async function candidateFramesForAcceptance(assetId) {
  if (assetId !== 'sunweaver-lumen-guard') {
    fail(9, `candidate acceptance is not implemented for ${assetId}; the image vertical slice targets sunweaver-lumen-guard`);
  }
  const manifestLoad = loadCandidateManifestFromDisk(assetId);
  if ('missing' in manifestLoad) fail(9, `candidate manifest missing for ${assetId}`);
  if ('error' in manifestLoad) fail(1, manifestLoad.error);
  const candidateManifest = manifestLoad.manifest;
  const reference = referenceInfoFromDisk(assetId);
  if ('missing' in reference) fail(9, `reference.png missing for ${assetId}`);
  if ('error' in reference) fail(1, reference.error);
  if (
    reference.sha256 !== candidateManifest.sourceSha256 ||
    reference.width !== candidateManifest.sourceWidth ||
    reference.height !== candidateManifest.sourceHeight
  ) {
    fail(1, `reference.png does not match candidate manifest for ${assetId}`);
  }
  const source = await loadGeneratedCandidateSource(assetId);
  if (!source.present) fail(9, source.message);
  const sheet = loadCandidateSheetFromDisk(assetId);
  if ('missing' in sheet) fail(9, `candidate.png missing for ${assetId}`);
  if ('error' in sheet) fail(1, sheet.error);
  if (source.module.cells.length !== sheet.cells.length) {
    fail(9, `generated source and candidate.png frame counts differ for ${assetId}`);
  }
  for (let i = 0; i < sheet.cells.length; i++) {
    const diskHash = cellSha256FromBytes(sheet.cells[i].bytes);
    const sourceHash = cellSha256FromBytes(source.module.cells[i].bytes);
    if (diskHash !== sourceHash) {
      fail(5, `candidate source mismatch for ${sheet.cells[i].key}: generated source ${sourceHash} != candidate.png ${diskHash}`);
    }
  }
  const outer = [...RIM_COLORS.outer, 255];
  const inner = [...RIM_COLORS.inner, 255];
  return {
    manifest: candidateManifest,
    frames: sheet.cells.map((cell) => ({
      key: cell.key,
      pix: applyCombatExteriorRim(new Pix(64, 64, new Uint8ClampedArray(cell.bytes)), outer, inner),
    })),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const assetId = typeof args.asset === 'string' ? args.asset : '';
  const evidencePath = typeof args.evidence === 'string' ? args.evidence : '';
  const apply = Boolean(args.apply);
  if (!assetId || !evidencePath || !path.isAbsolute(evidencePath)) {
    fail(2, 'usage: --asset=<id> --evidence=<abs-manifest-path> [--apply]');
  }
  const def = ASSET_BY_ID[assetId];
  if (!def) fail(8, `unknown asset "${assetId}"`);
  const registry = readRegistry();
  const baselineDir = path.join(BASELINES_DIR, assetId);
  const manifestPath = path.join(baselineDir, 'manifest.json');
  const pngPath = path.join(baselineDir, 'baseline.png');
  // --init: first-time seeding of ONE asset's accepted baseline. Allowed only
  // when this asset has no accepted baseline AND no registry entry yet; every
  // later accept of the same asset must go through the full replacement path.
  const isInit = Boolean(args.init);
  const missingBaseline = !fs.existsSync(manifestPath) || !fs.existsSync(pngPath);
  if (missingBaseline && !isInit) {
    fail(7, `MISSING BASELINE for ${assetId} (expected ${manifestPath}); pass --init only for first-time setup`);
  }
  if (!missingBaseline && isInit) {
    fail(2, `--init refused: ${assetId} already has an accepted baseline (use normal acceptance)`);
  }
  if (isInit && registry.assets?.[assetId]) {
    fail(2, `--init refused: ${assetId} already exists in the registry`);
  }
  let acceptedManifest;
  if (!missingBaseline) {
    try {
      acceptedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (error) {
      fail(1, `accepted manifest unparseable: ${error?.message ?? error}`);
    }
  } else {
    // Plan-only stub for --init: the written manifest is rebuilt in full below,
    // so this never lands on disk; it only feeds the plan/changed-frame report.
    acceptedManifest = { schemaVersion: 1, assetId, label: def.label, faction: def.faction, category: def.category, revision: null, frames: [] };
  }
  let evidence;
  try {
    evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  } catch (error) {
    fail(1, `evidence unparseable: ${error?.message ?? error}`);
  }
  if (!isRecord(evidence) || evidence.schemaVersion !== 1 || !evidence.metrics) {
    fail(1, 'unsupported or malformed evidence (schemaVersion/metrics missing)');
  }
  if (evidence.assetId !== undefined && evidence.assetId !== assetId) {
    fail(1, `evidence assetId ${String(evidence.assetId)} does not match selected asset ${assetId}`);
  }

  // V5 — freshness: evidence revision must equal HEAD; tree must be clean
  // outside the declared candidate source files.
  const head = gitRevision();
  if (typeof evidence.sourceRevision !== 'string' || evidence.sourceRevision.length === 0) {
    fail(1, 'malformed evidence: sourceRevision is required');
  }
  if (evidence.sourceRevision !== head) {
    fail(3, `stale evidence: generated at ${String(evidence.sourceRevision).slice(0, 10)}, HEAD is ${head.slice(0, 10)}`);
  }
  if (!Array.isArray(evidence.declaredDirtyFiles) || evidence.declaredDirtyFiles.some((file) => typeof file !== 'string')) {
    fail(1, 'malformed evidence: declaredDirtyFiles must be a string array');
  }
  const declared = new Set(nonBaselineFiles(evidence.declaredDirtyFiles));
  const dirty = new Set(nonBaselineFiles(gitDirtyFiles()));
  if (!sameSet(declared, dirty)) {
    const unexpected = [...dirty].filter((file) => !declared.has(file));
    const missing = [...declared].filter((file) => !dirty.has(file));
    const detail = [
      unexpected.length ? `unexpected: ${unexpected.join(', ')}` : '',
      missing.length ? `missing: ${missing.join(', ')}` : '',
    ].filter(Boolean).join('; ');
    fail(3, `stale evidence: worktree dirty state differs from declaration${detail ? ` (${detail})` : ''}`);
  }

  // V6 — gates.
  if (!isRecord(evidence.gates) || Object.keys(evidence.gates).length === 0) {
    fail(1, 'malformed evidence: gates must be a non-empty boolean map');
  }
  const gateResults = evidence.gates;
  const malformedGates = Object.entries(gateResults).filter(([, value]) => typeof value !== 'boolean');
  if (malformedGates.length > 0) {
    fail(1, `malformed evidence: gates must contain booleans (${malformedGates.map(([key]) => key).join(', ')})`);
  }
  const failedGates = Object.entries(gateResults).filter(([, v]) => v !== true);
  if (failedGates.length > 0) {
    fail(4, `failed gates: ${failedGates.map(([k]) => k).join(', ')}`);
  }

  // Partial candidate refusal.
  if (!Array.isArray(evidence.failedFrames) || evidence.failedFrames.some((frame) => typeof frame !== 'string')) {
    fail(1, 'malformed evidence: failedFrames must be a string array');
  }
  if (evidence.failedFrames.length > 0) {
    fail(9, `partial candidate: ${evidence.failedFrames.length} frame(s) failed to generate`);
  }

  // V7 — recompute candidate hashes from CURRENT source; must equal evidence.
  const candidate = await candidateFramesForAcceptance(assetId);
  const frames = candidate.frames;
  const partialFrames = frames.filter((f) => f.error);
  if (partialFrames.length > 0) fail(9, `current candidate partial: ${partialFrames.map((f) => f.key).join(', ')}`);
  const geo = gridGeometryFor(assetId);
  if (frames.length !== geo.cols * geo.rows) {
    fail(1, `frame count ${frames.length} does not match grid ${geo.cols}x${geo.rows}`);
  }
  const candidateHashes = {};
  frames.forEach((frame) => { candidateHashes[frame.key] = cellSha256FromBytes(frame.pix.d); });
  const evidenceHashes = normalizeCandidateHashes(evidence, assetId);
  const evidenceKeys = Object.keys(evidenceHashes);
  const currentKeys = Object.keys(candidateHashes);
  if (evidenceKeys.length !== currentKeys.length || !sameSet(new Set(evidenceKeys), new Set(currentKeys))) {
    fail(5, `hash mismatch: candidateHashes keys ${evidenceKeys.length} do not equal current frame keys ${currentKeys.length}`);
  }
  for (const key of currentKeys) {
    if (candidateHashes[key] !== evidenceHashes[key]) {
      fail(5, `hash mismatch for ${key}: current source ${candidateHashes[key]} != evidence ${evidenceHashes[key]}`);
    }
  }

  // V8 — unrelated drift: every OTHER registered accepted asset must still verify
  // against its stored baseline.png, manifest, and registry hashes.
  const drift = [];
  const otherIds = CATALOG.map((entry) => entry.assetId).filter((id) => id !== assetId);
  for (const other of otherIds) {
    const entry = registry.assets?.[other];
    if (!entry) continue; // not yet accepted — nothing to verify
    const oDir = path.join(BASELINES_DIR, other);
    const oManifest = path.join(oDir, 'manifest.json');
    const oPng = path.join(oDir, 'baseline.png');
    if (!fs.existsSync(oManifest) || !fs.existsSync(oPng)) { drift.push(`${other}: missing baseline`); continue; }
    if (sha256File(oManifest) !== entry.manifestSha256 || sha256File(oPng) !== entry.baselinePngSha256) {
      drift.push(`${other}: accepted artifacts no longer match registry hashes`);
      continue;
    }
    const oGeo = gridGeometryFor(other);
    const otherKeys = frameKeyOrder(other);
    let diskHashes;
    try { diskHashes = hashesFromPng(oPng, oGeo, otherKeys); } catch (error) { drift.push(`${other}: ${error.message}`); continue; }
    const expected = entry.frameSha256 ?? {};
    if (otherKeys.some((key) => diskHashes[key] !== expected[key]) || Object.keys(expected).length !== otherKeys.length) {
      drift.push(`${other}: frame hashes differ from registry`);
    }
  }
  if (drift.length > 0) fail(6, `unrelated asset drift: ${drift.join('; ')}`);

  // Plan + report.
  const changedFrames = frames
    .map((frame) => ({ key: frame.key, accepted: acceptedManifest.frames?.find((f) => f.key === frame.key)?.sha256 ?? null, candidate: candidateHashes[frame.key] }))
    .filter((row) => row.accepted !== row.candidate);
  console.log(`selected asset: ${assetId}`);
  console.log(`plan: ${isInit ? 'initialize' : 'replace'} accepted baseline for ${assetId}`);
  console.log(`  revision ${String(acceptedManifest.revision ?? 'none').slice(0, 10)} -> ${head.slice(0, 10)}`);
  console.log(`  frames changed: ${changedFrames.length}/${frames.length}`);
  console.log(`  candidate status: ${candidate.manifest.status} -> approved`);
  for (const row of changedFrames.slice(0, 12)) {
    console.log(`    ${row.key}: ${(row.accepted ?? 'new').slice(0, 10)}… -> ${row.candidate.slice(0, 10)}…`);
  }
  if (changedFrames.length > 12) console.log(`    … and ${changedFrames.length - 12} more`);
  const candidateManifestPath = path.join(REPO_ROOT, 'tools', 'forge-art', 'candidates', assetId, 'manifest.json');
  console.log(`  files: ${pngPath}\n         ${manifestPath}\n         ${path.join(BASELINES_DIR, 'registry.json')}\n         ${candidateManifestPath}`);

  if (!apply) {
    console.log('DRY-RUN complete — nothing written. Pass --apply to update this one baseline.');
    return;
  }

  // Atomic swap: stage every accepted artifact first, rename the baseline pair,
  // rewrite the registry entry, then mark the reviewed candidate APPROVED last.
  // The manifest is rebuilt in FULL from the current registry/adapter data (never
  // spread from the accepted file, which may be an older slim shape), so both
  // --init and replacement writes produce the complete §5 v1 manifest. It must
  // pass validateBaselineManifest() BEFORE any bytes hit disk (R1 M1).
  const newManifest = {
    schemaVersion: 1,
    assetId,
    label: def.label,
    faction: def.faction,
    category: def.category,
    revision: head,
    createdAt: new Date().toISOString(),
    source: { adapter: def.adapterId, dims: [geo.cellW * geo.cols, geo.cellH * geo.rows] },
    cellLayout: { cellW: geo.cellW, cellH: geo.cellH, cols: geo.cols, rows: geo.rows, order: 'dir-major', count: frames.length },
    anchor: def.anchor,
    worldScale: def.worldScale,
    frames: frames.map((frame) => ({
      key: frame.key,
      sha256: candidateHashes[frame.key],
      alphaPixels: countAlpha(frame.pix.d),
    })),
    paletteStats: computePaletteStats(frames),
    thresholdsUsed: {},
    gates: {},
  };
  const manifestErrors = validateBaselineManifest(newManifest);
  if (manifestErrors.length > 0) {
    fail(1, `generated manifest fails schema v1 (${assetId}): ${manifestErrors.join('; ')}`);
  }
  fs.mkdirSync(baselineDir, { recursive: true });
  const tmpPng = renderGridPng(frames, geo);
  const tmpPngPath = pngPath + '.tmp';
  fs.writeFileSync(tmpPngPath, tmpPng);
  const tmpManifestPath = manifestPath + '.tmp';
  fs.writeFileSync(tmpManifestPath, JSON.stringify(newManifest, null, 2));
  const approvedCandidateManifest = approveCandidateManifest(candidate.manifest);
  const tmpCandidateManifestPath = candidateManifestPath + '.tmp';
  fs.writeFileSync(tmpCandidateManifestPath, canonicalApprovalJson(approvedCandidateManifest));
  const approvedCandidateManifestSha256 = sha256File(tmpCandidateManifestPath);
  fs.renameSync(tmpPngPath, pngPath);
  fs.renameSync(tmpManifestPath, manifestPath);

  // Verify disk state before touching the registry (hash the intended bytes
  // captured in memory; the temp file is already renamed into place).
  const tmpPngBytes = tmpPng;
  void tmpPngBytes;
  const verifyHashes = hashesFromPng(pngPath, geo);
  const expectedValues = frames.map((frame) => candidateHashes[frame.key]);
  if (Object.values(verifyHashes).some((h, i) => h !== expectedValues[i])) {
    fs.rmSync(tmpCandidateManifestPath, { force: true });
    fail(10, 'post-write verification failed: baseline.png cells do not match candidate hashes');
  }

  const regFile = path.join(BASELINES_DIR, 'registry.json');
  const nextRegistry = JSON.parse(JSON.stringify(registry));
  nextRegistry.schemaVersion = 1;
  nextRegistry.assets = nextRegistry.assets ?? {};
  nextRegistry.assets[assetId] = {
    revision: head,
    acceptedAt: new Date().toISOString(),
    manifestSha256: sha256File(manifestPath),
    baselinePngSha256: sha256File(pngPath),
    frameSha256: Object.fromEntries(frames.map((frame) => [frame.key, candidateHashes[frame.key]])),
  };
  const tmpReg = regFile + '.tmp';
  fs.writeFileSync(tmpReg, JSON.stringify(nextRegistry, null, 2));
  fs.renameSync(tmpReg, regFile);

  fs.renameSync(tmpCandidateManifestPath, candidateManifestPath);
  let approvedReadback;
  try {
    approvedReadback = JSON.parse(fs.readFileSync(candidateManifestPath, 'utf8'));
  } catch (error) {
    fail(10, `post-write verification failed: approved candidate manifest is unreadable (${error?.message ?? error})`);
  }
  if (approvedReadback.status !== 'approved' || sha256File(candidateManifestPath) !== approvedCandidateManifestSha256) {
    fail(10, 'post-write verification failed: candidate manifest was not atomically promoted to approved');
  }

  console.log(`APPLIED: accepted baseline updated and candidate marked approved for ${assetId} at revision ${head.slice(0, 10)}. Not committed.`);
}

function countAlpha(d) {
  let count = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) count++;
  return count;
}

/**
 * Aggregate palette statistics across all frames of an asset (schema §5) — the
 * same computation forge-art-baseline.mjs emits, so accepted manifests carry the
 * full candidate shape instead of a slim subset.
 */
function computePaletteStats(frames) {
  const colors = new Set();
  let alphaPixels = 0;
  let lumaTotal = 0;
  let brightPixels = 0;
  let cellArea = 0;
  for (const frame of frames) {
    const d = frame.pix.d;
    cellArea += frame.pix.w * frame.pix.h;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] <= 0) continue;
      alphaPixels++;
      colors.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
      const luma = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      lumaTotal += luma;
      if (luma >= 65) brightPixels++;
    }
  }
  return {
    uniqueColors: colors.size,
    alphaPixels,
    alphaCoverage: alphaPixels / Math.max(1, cellArea),
    averageLuma: alphaPixels ? lumaTotal / alphaPixels : 0,
    brightMaterialShare: alphaPixels ? brightPixels / alphaPixels : 0,
  };
}

function renderGridPng(frames, geo) {
  const png = new PNG({ width: geo.cellW * geo.cols, height: geo.cellH * geo.rows });
  png.data.fill(0);
  frames.forEach((frame, index) => {
    const col = index % geo.cols;
    const row = Math.floor(index / geo.cols);
    for (let y = 0; y < geo.cellH; y++) {
      for (let x = 0; x < geo.cellW; x++) {
        const si = (x + y * geo.cellW) * 4;
        const di = ((col * geo.cellW + x) + (row * geo.cellH + y) * (geo.cellW * geo.cols)) * 4;
        png.data[di] = frame.pix.d[si];
        png.data[di + 1] = frame.pix.d[si + 1];
        png.data[di + 2] = frame.pix.d[si + 2];
        png.data[di + 3] = frame.pix.d[si + 3];
      }
    }
  });
  return PNG.sync.write(png);
}

main().catch((error) => {
  console.error(`forge-art-accept: fatal: ${error?.stack ?? error}`);
  process.exitCode = 1;
});
