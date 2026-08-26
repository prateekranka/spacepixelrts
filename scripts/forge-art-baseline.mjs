#!/usr/bin/env node
/**
 * forge-art-baseline.mjs — generate CANDIDATE baseline artifacts for Forge Art Lab.
 *
 * Writes candidate PNG + manifest into --out (absolute, outside repo). NEVER
 * touches tools/forge-art/baselines/ (accepted baselines are updated only by
 * forge-art-accept.mjs --apply after verified evidence).
 *
 * Run under tsx (repo convention) so extensionless src/* imports resolve:
 *   npx tsx scripts/forge-art-baseline.mjs --asset=<id>|all --out=<abs-dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { resolveOut, parseArgs, sha256Bytes } from './forge-art-lib.mjs';
import { ASSET_BY_ID, CATALOG } from '../tools/forge-art/src/registry';
import { getFrames } from '../tools/forge-art/src/adapters';
import { gridGeometryFor, validateBaselineManifest } from '../tools/forge-art/src/baseline-schema';

const require = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { execFileSync } = require('node:child_process');

function gitRevision() {
  return execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function frameGrid(assetId) {
  const def = ASSET_BY_ID[assetId];
  if (!def) throw new Error(`unknown asset ${assetId}`);
  const frames = getFrames(assetId);
  const failed = frames.filter((f) => f.error);
  if (failed.length) {
    throw new Error(`PARTIAL candidate for ${assetId}: ${failed.map((f) => `${f.key}: ${f.error}`).join('; ')}`);
  }
  return { def, frames, geo: gridGeometryFor(assetId) };
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

/** Aggregate palette statistics across all frames of an asset (schema §5). */
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = resolveOut(args.out);
  const assetArg = typeof args.asset === 'string' ? args.asset : '';
  if (!assetArg) throw new Error('--asset=<id>|all is required');
  const ids = assetArg === 'all' ? CATALOG.map((entry) => entry.assetId) : [assetArg];
  fs.mkdirSync(outDir, { recursive: true });
  const revision = gitRevision();
  let ok = 0;
  for (const assetId of ids) {
    const { def, frames, geo } = frameGrid(assetId);
    const pngBytes = renderGridPng(frames, geo);
    const frameEntries = frames.map((frame) => {
      let alphaPixels = 0;
      for (let i = 3; i < frame.pix.d.length; i += 4) if (frame.pix.d[i] > 0) alphaPixels++;
      return { key: frame.key, sha256: sha256Bytes(Buffer.from(frame.pix.d)), alphaPixels };
    });
    const manifest = {
      schemaVersion: 1,
      assetId,
      label: def.label,
      faction: def.faction,
      category: def.category,
      revision,
      createdAt: new Date().toISOString(),
      source: { adapter: def.adapterId, dims: [geo.cellW * geo.cols, geo.cellH * geo.rows] },
      cellLayout: { cellW: geo.cellW, cellH: geo.cellH, cols: geo.cols, rows: geo.rows, order: 'dir-major', count: frames.length },
      anchor: def.anchor,
      worldScale: def.worldScale,
      frames: frameEntries,
      paletteStats: computePaletteStats(frames),
      thresholdsUsed: {},
      gates: {},
    };
    const errors = validateBaselineManifest(manifest);
    if (errors.length) throw new Error(`manifest invalid for ${assetId}: ${errors.join('; ')}`);
    const assetDir = path.join(outDir, assetId);
    fs.mkdirSync(assetDir, { recursive: true });
    fs.writeFileSync(path.join(assetDir, 'baseline.png'), pngBytes);
    fs.writeFileSync(path.join(assetDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    ok++;
    console.log(`baseline(candidate): ${assetId} frames=${frames.length} bytes=${pngBytes.length} rev=${revision.slice(0, 10)}`);
  }
  console.log(`ok=${ok}/${ids.length} out=${outDir}`);
}

main().catch((error) => {
  console.error(`forge-art-baseline: ${error?.stack ?? error}`);
  process.exitCode = 1;
});
