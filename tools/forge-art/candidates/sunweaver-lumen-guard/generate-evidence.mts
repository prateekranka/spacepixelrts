#!/usr/bin/env tsx
/**
 * LUMEN-ART evidence generator + gate verifier for the sunweaver-lumen-guard
 * image candidate (Builder 2 owned). One executable: writes the candidate
 * sheet (candidate.png, 512x128 raw), the v1 manifest, a metrics report, and
 * contact sheets/composites OUTSIDE the repository, then runs the published
 * VS-4 combat gates on the RAW and RIMmed candidate cells and prints exact
 * results. Deterministic; does not modify production source, tests, baselines,
 * or Forge pipeline files.
 *
 * Usage:  npx tsx tools/forge-art/candidates/sunweaver-lumen-guard/generate-evidence.mts
 *         [--out /absolute/path/outside/repo]
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

import { Pix } from '../../../../src/sprites';
import {
  LUMEN_GUARD_CANDIDATE_ACTIVE,
  LUMEN_GUARD_CANDIDATE_CELL,
  LUMEN_GUARD_CANDIDATE_DIRS,
  LUMEN_GUARD_CANDIDATE_META,
  LUMEN_GUARD_CANDIDATE_RIM_COLORS,
  LUMEN_GUARD_CANDIDATE_RAW,
  lumenGuardCandidateFrame,
  lumenGuardCandidateRimmed,
} from '../../../../src/generated/sunweaver-lumen-guard-candidate';
import {
  alphaCount,
  alphaCoverage,
  averageLuma,
  bodyTop,
  brightMaterialShare,
  coreAlphaInRows,
  coreMinY,
  differingPixels,
  facingVariance,
  isMirrorPair,
  magShare,
  meanRgbaDelta,
  pixView,
  poseDeltaPercent,
  primaryComponentShare,
  rimLayerShares,
  sourceBounds,
} from '../../../../tools/forge-art/src/metrics';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../../../');
const OUT_ARG = process.argv.indexOf('--out');
const EVIDENCE_DIR = OUT_ARG >= 0 ? resolve(process.argv[OUT_ARG + 1]) : '/home/bobbyranka/workspace/evidence/lumen-guard-candidate';
const CAND_DIR = join(REPO, 'tools/forge-art/candidates/sunweaver-lumen-guard');
const REFERENCE = join(CAND_DIR, 'reference.png');

const DIRS = [0, 1, 2, 3, 4, 5, 6, 7];
const POSES = [0, 1];
const RIM = {
  outer: [LUMEN_GUARD_CANDIDATE_RIM_COLORS.outer[0], LUMEN_GUARD_CANDIDATE_RIM_COLORS.outer[1], LUMEN_GUARD_CANDIDATE_RIM_COLORS.outer[2]] as [number, number, number],
  inner: [LUMEN_GUARD_CANDIDATE_RIM_COLORS.inner[0], LUMEN_GUARD_CANDIDATE_RIM_COLORS.inner[1], LUMEN_GUARD_CANDIDATE_RIM_COLORS.inner[2]] as [number, number, number],
};

function sha256Bytes(bytes: Uint8Array | Uint8ClampedArray): string {
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

function writePng(path: string, w: number, h: number, data: Uint8Array | Uint8ClampedArray): void {
  const png = new PNG({ width: w, height: h });
  png.data.set(data);
  writeFileSync(path, PNG.sync.write(png));
}

/** Compose a sheet of 64x64 cells into one PNG (scale = nearest-neighbor). */
function sheetPng(cells: readonly (readonly Pix[])[], scale: number): { png: PNG; cells: Pix[][] } {
  const rows = cells.length;
  const cols = cells[0].length;
  const png = new PNG({ width: cols * 64 * scale, height: rows * 64 * scale });
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const cell = cells[cy][cx];
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const si = (x + y * 64) * 4;
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              const di = ((cx * 64 * scale + x * scale + dx) + (cy * 64 * scale + y * scale + dy) * png.width) * 4;
              png.data[di] = cell.d[si];
              png.data[di + 1] = cell.d[si + 1];
              png.data[di + 2] = cell.d[si + 2];
              png.data[di + 3] = cell.d[si + 3];
            }
          }
        }
      }
    }
  }
  return { png, cells: cells.map((r) => [...r]) };
}

function main(): void {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  console.log(`candidate dir: ${CAND_DIR}`);
  console.log(`evidence dir:  ${EVIDENCE_DIR}`);

  // ── Build raw + rimmed cells ──────────────────────────────────────────────
  const raw: Pix[][] = [];
  const rimmed: Pix[][] = [];
  for (const pose of POSES) {
    const rawRow: Pix[] = [];
    const rimRow: Pix[] = [];
    for (const dir of DIRS) {
      rawRow.push(lumenGuardCandidateFrame(dir, pose));
      rimRow.push(lumenGuardCandidateRimmed(dir, pose));
    }
    raw.push(rawRow);
    rimmed.push(rimRow);
  }

  // ── candidate.png: 512x128 RAW sheet (dir-major, pose rows) ───────────────
  const rawSheet = sheetPng(raw, 1);
  const candidatePngPath = join(CAND_DIR, 'candidate.png');
  writeFileSync(candidatePngPath, PNG.sync.write(rawSheet.png));
  console.log(`wrote ${candidatePngPath}`);

  // ── Outside-repo evidence: sheets, composites, 1x lineup ──────────────────
  writeFileSync(join(EVIDENCE_DIR, 'candidate-raw-1x.png'), PNG.sync.write(rawSheet.png));
  const raw4 = sheetPng(raw, 4);
  writeFileSync(join(EVIDENCE_DIR, 'candidate-raw-4x.png'), PNG.sync.write(raw4.png));
  const rim4 = sheetPng(rimmed, 4);
  writeFileSync(join(EVIDENCE_DIR, 'candidate-rimmed-4x.png'), PNG.sync.write(rim4.png));
  const rim1 = sheetPng(rimmed, 1);
  writeFileSync(join(EVIDENCE_DIR, 'candidate-rimmed-1x.png'), PNG.sync.write(rim1.png));

  // all 16 raw cells in contract order on one horizontal strip, 2x
  const strip = new PNG({ width: 16 * 64 * 2, height: 64 * 2 });
  for (let i = 0; i < 16; i++) {
    const cell = LUMEN_GUARD_CANDIDATE_RAW[i];
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const si = (x + y * 64) * 4;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const di = ((i * 128 + x * 2 + dx) + (y * 2 + dy) * strip.width) * 4;
            strip.data[di] = cell.d[si];
            strip.data[di + 1] = cell.d[si + 1];
            strip.data[di + 2] = cell.d[si + 2];
            strip.data[di + 3] = cell.d[si + 3];
          }
        }
      }
    }
  }
  writeFileSync(join(EVIDENCE_DIR, 'candidate-order-strip-2x.png'), PNG.sync.write(strip));

  // ── Gates: published VS-4 / R2 / R3 combat-unit thresholds ────────────────
  const failures: string[] = [];
  const ok = (cond: boolean, msg: string): void => {
    if (!cond) failures.push(msg);
  };
  const rows: Array<Record<string, unknown>> = [];
  const alphaPixelsAll: number[] = [];
  const rimmedAlphaAll: number[] = [];

  for (const pose of POSES) {
    for (const dir of DIRS) {
      const key = `dir${dir}-pose${pose}`;
      const r = pixView(raw[pose][dir]);
      const m = pixView(rimmed[pose][dir]);
      const rc = alphaCount(r);
      const mc = alphaCount(m);
      alphaPixelsAll.push(rc);
      rimmedAlphaAll.push(mc);
      const row: Record<string, unknown> = { key, rawAlpha: rc, rimAlpha: mc };

      // dimensions
      ok(r.width === 64 && r.height === 64, `raw dims ${r.width}x${r.height}`);
      // alpha coverage band (raw and rimmed both inside the published 12-55%)
      const rawCov = alphaCoverage(r);
      const rimCov = alphaCoverage(m);
      row.rawAlphaCoverage = Number(rawCov.toFixed(4));
      row.rimAlphaCoverage = Number(rimCov.toFixed(4));
      ok(rawCov >= 0.12 && rawCov <= 0.55, `raw alpha coverage ${rawCov.toFixed(3)} outside 0.12-0.55`);
      ok(rimCov >= 0.12 && rimCov <= 0.55, `rimmed alpha coverage ${rimCov.toFixed(3)} outside 0.12-0.55`);
      // connectivity (rimmed is the gate; raw must also stay >= 0.96)
      const connR = primaryComponentShare(r);
      const connM = primaryComponentShare(m);
      row.rawConnected = Number(connR.toFixed(4));
      row.rimConnected = Number(connM.toFixed(4));
      ok(connR >= 0.96, `raw connected ${connR.toFixed(4)}`);
      ok(connM >= 0.96, `rimmed connected ${connM.toFixed(4)}`);
      // luma / bright share (rimmed R3 floors; raw reported)
      const lumaM = averageLuma(m);
      const lumaR = averageLuma(r);
      const brightM = brightMaterialShare(m);
      row.rawAvgLuma = Number(lumaR.toFixed(1));
      row.rimAvgLuma = Number(lumaM.toFixed(1));
      row.rimBrightShare = Number(brightM.toFixed(4));
      ok(lumaM >= 90, `rimmed avg luma ${lumaM.toFixed(1)} < 90`);
      ok(brightM >= 0.3, `rimmed bright share ${brightM.toFixed(3)} < 0.30`);
      // guard bounds on rimmed (>= 24x44) and raw
      const b = sourceBounds(m);
      const br = sourceBounds(r);
      row.rimBounds = [b ? `${b.maxX - b.minX + 1}x${b.maxY - b.minY + 1}` : null];
      row.rawBounds = [br ? `${br.maxX - br.minX + 1}x${br.maxY - br.minY + 1}` : null];
      ok(b !== null && b.maxX - b.minX + 1 >= 24 && b.maxY - b.minY + 1 >= 44, `rimmed guard bound too small`);
      ok(br !== null && br.maxX - br.minX + 1 >= 24 && br.maxY - br.minY + 1 >= 44, `raw guard bound too small`);
      ok(br !== null && br.maxY <= 51, `raw feet row ${br.maxY} > 51`);
      // spear reach + extension (rimmed gates; bodyTop band matches the frozen
      // VS-4 row-0 guard core band x29..31)
      const top = bodyTop(m, RIM, [29, 31]);
      const coreTop = coreMinY(m, RIM, 2);
      const row0Core = coreAlphaInRows(m, 0, 0, RIM, 2);
      row.bodyTop = top;
      row.coreTop = coreTop;
      row.row0CorePixels = row0Core;
      ok(top >= 16, `guard body top ${top} < 16`);
      ok(coreTop <= 2, `spear does not reach row 0-2 (core top ${coreTop})`);
      ok(row0Core >= 2, `spear tip row-0 core pixels ${row0Core} < 2`);
      ok(top - coreTop >= 16, `spear extension ${top - coreTop} < 16`);
      // source MAG share 0.5-5% (raw gate; rimmed must keep the same band)
      const magRaw = magShare(r);
      const magRim = magShare(m);
      row.rawMagShare = Number(magRaw.toFixed(4));
      row.rimMagShare = Number(magRim.toFixed(4));
      ok(magRaw >= 0.005 && magRaw <= 0.05, `raw MAG share ${magRaw.toFixed(4)} outside 0.005-0.05`);
      ok(magRim >= 0.005 && magRim <= 0.05, `rimmed MAG share ${magRim.toFixed(4)} outside 0.005-0.05`);
      // rim layer shares >= 0.85 (rimmed)
      const shares = rimLayerShares(m, RIM);
      row.rimOuterShare = Number(shares.outer.toFixed(4));
      row.rimInnerShare = Number(shares.inner.toFixed(4));
      ok(shares.outer >= 0.85, `rim outer share ${shares.outer.toFixed(3)} < 0.85`);
      ok(shares.inner >= 0.85, `rim inner share ${shares.inner.toFixed(3)} < 0.85`);
      // pose variance per dir
      rows.push(row);
    }
  }

  // pose delta (raw and rimmed) per direction
  const poseDeltas: Record<string, { raw: number; rim: number }> = {};
  for (const dir of DIRS) {
    poseDeltas[`dir${dir}`] = {
      raw: Number(poseDeltaPercent(pixView(raw[0][dir]), pixView(raw[1][dir])).toFixed(2)),
      rim: Number(poseDeltaPercent(pixView(rimmed[0][dir]), pixView(rimmed[1][dir])).toFixed(2)),
    };
    ok(poseDeltas[`dir${dir}`].rim > 4 && poseDeltas[`dir${dir}`].rim < 45, `pose delta dir${dir} ${poseDeltas[`dir${dir}`].rim} outside 4-45`);
  }
  // N (dir2) vs E (dir0) mean RGBA delta (rimmed)
  const neDelta = meanRgbaDelta(pixView(rimmed[0][2]), pixView(rimmed[0][0]));
  ok(neDelta > 18, `N vs E delta ${neDelta.toFixed(2)} <= 18`);
  // facing variance across the 8 rimmed pose-0 cells
  const fv = facingVariance(DIRS.map((d) => pixView(rimmed[0][d])));
  // exact mirror equality (raw RGBA)
  const mirrors: Record<string, boolean> = {};
  for (const [source, mirror] of [[1, 3], [0, 4], [7, 5]] as const) {
    for (const pose of POSES) {
      const m = isMirrorPair(pixView(raw[pose][source]), pixView(raw[pose][mirror]));
      mirrors[`dir${mirror}-pose${pose}<-dir${source}`] = m;
      ok(m, `raw mirror dir${mirror}-pose${pose} != flip(dir${source}-pose${pose})`);
      const mr = isMirrorPair(pixView(rimmed[pose][source]), pixView(rimmed[pose][mirror]));
      ok(mr, `rimmed mirror dir${mirror}-pose${pose} != flip(dir${source}-pose${pose})`);
    }
  }
  // frame order + count: 16 raw cells, dir-major
  const orderOk = LUMEN_GUARD_CANDIDATE_RAW.length === 16;
  ok(orderOk, `RAW array length ${LUMEN_GUARD_CANDIDATE_RAW.length} != 16`);
  const orderKeys: string[] = [];
  for (let i = 0; i < 16; i++) orderKeys.push(`dir${i % 8}-pose${Math.floor(i / 8)}`);
  const orderVerified = orderKeys.every((key, i) => {
    const cell = LUMEN_GUARD_CANDIDATE_RAW[i];
    const [d, p] = [i % 8, Math.floor(i / 8)];
    return differingPixels(pixView(cell), pixView(lumenGuardCandidateFrame(d, p))) === 0;
  });
  ok(orderVerified, 'RAW cell order does not match dir-major lookup');
  // inactive + seam purity
  ok(LUMEN_GUARD_CANDIDATE_ACTIVE === false, 'candidate must be inactive');
  ok(LUMEN_GUARD_CANDIDATE_META.frameCount === 16, 'meta frame count');

  // rim is not pre-applied to raw: rimmed alpha must exceed raw alpha for
  // every frame (the two-layer dilation adds exterior pixels exactly once).
  const rimAdds = rimmedAlphaAll.reduce((s, a, i) => s + (a - alphaPixelsAll[i]), 0);
  for (let i = 0; i < 16; i++) {
    const a = alphaPixelsAll[i];
    const b = rimmedAlphaAll[i];
    ok(b > a, `frame ${i}: rimmed alpha ${b} <= raw alpha ${a} (rim not applied)`);
  }

  // ── Manifest v1 (ForgeArtCandidateManifest schema) ────────────────────────
  const sourceBytes = readFileSync(REFERENCE);
  const sourceHash = createHash('sha256').update(sourceBytes).digest('hex');
  const manifest = {
    schemaVersion: 1,
    assetId: 'sunweaver-lumen-guard',
    label: 'Lumen Guard image candidate',
    civilization: 'sunweaver',
    category: 'unit',
    adapter: 'combat',
    sourceKind: 'reference-image',
    sourcePath: 'tools/forge-art/candidates/sunweaver-lumen-guard/reference.png',
    sourceSha256: sourceHash,
    sourceWidth: 1389,
    sourceHeight: 1132,
    candidatePath: 'tools/forge-art/candidates/sunweaver-lumen-guard/candidate.png',
    candidateSourcePath: 'src/generated/sunweaver-lumen-guard-candidate.ts',
    generatedAt: new Date().toISOString(),
    algorithm: 'combat-reference-v1',
    status: 'draft',
    target: { cellW: 64, cellH: 64, cols: 8, rows: 2, order: 'dir-major', frameCount: 16 },
    directions: { authored: [...LUMEN_GUARD_CANDIDATE_DIRS.authored], mirrored: [...LUMEN_GUARD_CANDIDATE_DIRS.mirrored] },
    poses: { count: 2, names: ['primary', 'alternate'] },
    frames: orderKeys.map((key, i) => ({
      key,
      sha256: sha256Bytes(LUMEN_GUARD_CANDIDATE_RAW[i].d),
      width: 64,
      height: 64,
      alphaPixels: alphaPixelsAll[i],
    })),
    notes: 'RAW 64x64 cells (no combat rim; lumenGuardCandidateRimmed applies it once). Palette: ink/cream/ochre/amber/red + MAG lens at shield boss. Evidence: generated outside repo.',
  };
  writeFileSync(join(CAND_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`wrote ${join(CAND_DIR, 'manifest.json')}`);

  // ── metrics report ────────────────────────────────────────────────────────
  const metrics = {
    candidate: manifest.candidateSourcePath,
    active: LUMEN_GUARD_CANDIDATE_ACTIVE,
    frames: rows,
    poseDeltaPercent: poseDeltas,
    nVsEMeanRgbaDelta: Number(neDelta.toFixed(2)),
    facingVariancePose0: {
      meanDelta: Number(fv.meanDelta.toFixed(2)),
      maxDelta: Number(fv.maxDelta.toFixed(2)),
      minDelta: Number(fv.minDelta.toFixed(2)),
    },
    mirrors: mirrors,
    rimAddsAlpha: rimAdds,
    gatesPassed: failures.length === 0,
    failures,
  };
  writeFileSync(join(CAND_DIR, 'metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
  writeFileSync(join(EVIDENCE_DIR, 'metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
  writeFileSync(join(EVIDENCE_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log(`\n==== gate results ====`);
  console.log(`frames: 16/16, raw alpha range ${Math.min(...alphaPixelsAll)}-${Math.max(...alphaPixelsAll)}, rim alpha range ${Math.min(...rimmedAlphaAll)}-${Math.max(...rimmedAlphaAll)}`);
  console.log(`N-vs-E meanRGBA delta: ${neDelta.toFixed(2)} (gate >18)`);
  console.log(`facing variance pose0: mean ${fv.meanDelta.toFixed(2)} max ${fv.maxDelta.toFixed(2)} (gate >18 vs N/E)`);
  console.log(`pose deltas: ${JSON.stringify(poseDeltas)}`);
  console.log(`mirrors: ${Object.values(mirrors).every(Boolean) ? 'all exact' : JSON.stringify(mirrors)}`);
  console.log(`source MAG share raw: ${rows.map((r) => (r.rawMagShare as number).toFixed(4)).join(', ')}`);
  console.log(`rimmed avg luma: ${rows.map((r) => r.rimAvgLuma).join(', ')}`);
  console.log(`bodyTop (rimmed): ${rows.map((r) => r.bodyTop).join(', ')}`);
  console.log(`failures: ${failures.length}`);
  if (failures.length) console.log(failures.join('\n'));
  if (failures.length) process.exitCode = 1;
}

main();
