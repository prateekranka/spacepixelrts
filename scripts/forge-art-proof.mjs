#!/usr/bin/env tsx
/**
 * forge-art-proof.mjs — Forge Art Lab proof packs.
 *
 * Single asset:  npx tsx scripts/forge-art-proof.mjs --asset=<id> --out=<abs-dir>
 * Roster board:  npx tsx scripts/forge-art-proof.mjs --asset=roster --out=<abs-dir>
 *
 * Context captures are COMPOSITED Playwright screenshots at exactly 1366x1024
 * taken on the real-renderer rig page (?mesh=0&combat=1). Sheets/differences
 * are Canvas2D compositions over Pix bytes rendered inside the browser, exported
 * as data URLs. Evidence never lands inside the repository.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';
import playwright from 'playwright';
import { STARHOLD_PALETTE } from '../src/palette';
import { Pix, applyCombatExteriorRim } from '../src/sprites';
import {
  REPO_ROOT,
  VIEWPORT,
  resolveOut,
  parseArgs,
  delay,
  startVite,
  stopVite,
  launchChromium,
  attachErrors,
  settleFrames,
  dataUrlBuffer,
  sha256File,
} from './forge-art-lib.mjs';
import { ASSET_BY_ID, CATALOG } from '../tools/forge-art/src/registry';
import { getFrames } from '../tools/forge-art/src/adapters';
import { loadCandidateSheetFromDisk } from '../tools/forge-art/src/candidate-disk';
import { gridGeometryFor } from '../tools/forge-art/src/baseline-schema';
import {
  alphaCoverage,
  averageLuma,
  brightMaterialShare,
  differingPixels,
  magShare,
  meanRgbaDelta,
  pixView,
  poseDeltaPercent,
  primaryComponentShare,
  rimLayerShares,
  silhouetteIou,
  sourceBounds,
  unionAlpha,
} from '../tools/forge-art/src/metrics';
import { thresholdsFor } from '../tools/forge-art/src/thresholds';

const require = createRequire(import.meta.url);
const BASELINES_DIR = path.join(REPO_ROOT, 'tools', 'forge-art', 'baselines');
const NAV_TIMEOUT_MS = 30000;

const RIM_COLORS = {
  outer: hexRgb(STARHOLD_PALETTE.amber),
  inner: hexRgb(STARHOLD_PALETTE.cream),
};

function hexRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function gitInfo() {
  const git = (args) => execFileSync('git', ['-C', REPO_ROOT, ...args], { encoding: 'utf8' }).trim();
  const dirtyOutput = execFileSync('git', ['-C', REPO_ROOT, 'status', '--porcelain'], { encoding: 'utf8' }).trimEnd();
  return {
    revision: git(['rev-parse', 'HEAD']),
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    dirty: dirtyOutput.split('\n').filter(Boolean).map((line) => line.slice(3).trim()),
  };
}

/** Decode a baseline PNG into per-cell RGBA buffers keyed by frame order. */
function acceptedCells(assetId) {
  const dir = path.join(BASELINES_DIR, assetId);
  const pngPath = path.join(dir, 'baseline.png');
  if (!fs.existsSync(pngPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const geo = gridGeometryFor(assetId);
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  const cells = [];
  let index = 0;
  for (let row = 0; row < geo.rows; row++) {
    for (let col = 0; col < geo.cols; col++) {
      const cell = Buffer.alloc(geo.cellW * geo.cellH * 4);
      for (let y = 0; y < geo.cellH; y++) {
        const srcStart = ((col * geo.cellW) + (row * geo.cellH + y) * png.width) * 4;
        png.data.copy(cell, y * geo.cellW * 4, srcStart, srcStart + geo.cellW * 4);
      }
      cells.push({ key: manifest.frames?.[index]?.key ?? `cell${index}`, data: cell });
      index++;
    }
  }
  return { cells, manifest, geo };
}

/**
 * Candidate frames for proof. The disk candidate is raw and is intentionally
 * passed through the same exterior combat rim as the runtime atlas before any
 * gate, comparison, or screenshot is produced. Missing candidate state falls
 * back to the accepted procedural candidate for roster proofs; a malformed or
 * tampered target candidate fails loudly.
 */
function candidateFramesFor(assetId) {
  const loaded = loadCandidateSheetFromDisk(assetId);
  if ('missing' in loaded) return getFrames(assetId);
  if ('error' in loaded) throw new Error(`candidate sheet invalid for ${assetId}: ${loaded.error}`);
  if (assetId !== 'sunweaver-lumen-guard') return getFrames(assetId);
  const outer = [...RIM_COLORS.outer, 255];
  const inner = [...RIM_COLORS.inner, 255];
  return loaded.cells.map((cell) => ({
    key: cell.key,
    pix: applyCombatExteriorRim(
      new Pix(64, 64, new Uint8ClampedArray(cell.bytes)),
      outer,
      inner,
    ),
  }));
}

/** Build an HTML page that composes labeled/unlabeled sheets from raw RGBA bytes. */
function sheetComposerHtml(payloads) {
  const body = payloads.map((p) => `
    <section class="sheet" id="sheet-${p.id}">
      <h2>${escapeHtml(p.title)}</h2>
      <canvas data-fal-sheet="${p.id}" width="${p.width}" height="${p.height}"></canvas>
    </section>`).join('');
  const script = `
    window.__FAL_SHEETS__ = ${JSON.stringify(payloads)};
    async function compose() {
      for (const p of window.__FAL_SHEETS__) {
        const canvas = document.querySelector(\`[data-fal-sheet="\${p.id}"]\`);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        // checker background
        const s = p.cellScale;
        for (let y = 0; y < canvas.height; y += s) {
          for (let x = 0; x < canvas.width; x += s) {
            ctx.fillStyle = ((x / s + y / s) & 1) ? '#20242c' : '#181b21';
            ctx.fillRect(x, y, s, s);
          }
        }
        let i = 0;
        for (const frame of p.frames) {
          const off = new OffscreenCanvas(p.cellW, p.cellH);
          const octx = off.getContext('2d');
          const img = octx.createImageData(p.cellW, p.cellH);
          img.data.set(frame.bytes);
          if (p.pass === 'silhouette') { toSilhouette(img); }
          else if (p.pass === 'value') { toValue(img); }
          octx.putImageData(img, 0, 0);
          const col = i % p.cols, row = Math.floor(i / p.cols);
          ctx.drawImage(off, col * p.cellW * s, row * p.cellH * s, p.cellW * s, p.cellH * s);
          if (p.labels && frame.key) {
            ctx.fillStyle = '#D09A4E';
            ctx.font = '10px ui-monospace,Menlo,monospace';
            ctx.fillText(frame.key, col * p.cellW * s + 3, row * p.cellH * s + 11);
          }
          i++;
        }
        await canvas.convertToBlob ? null : null;
      }
      document.body.dataset.ready = 'true';
    }
    function toSilhouette(img){ const d=img.data; for(let i=0;i<d.length;i+=4){const a=d[i+3]>0; d[i]=a?255:0; d[i+1]=a?255:0; d[i+2]=a?255:0; d[i+3]=a?255:0;} }
    function toValue(img){ const d=img.data; for(let i=0;i<d.length;i+=4){ if(d[i+3]<=0){d[i]=d[i+1]=d[i+2]=d[i+3]=0;continue;} const l=Math.round(0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]); d[i]=l;d[i+1]=l;d[i+2]=l;d[i+3]=255;} }
    compose();
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#0B0A12;color:#F0E7D2;font:12px ui-monospace,Menlo,monospace;padding:12px}
    .sheet{margin-bottom:16px} h2{font-size:12px;color:#D09A4E;margin:0 0 6px}
    canvas{display:block;border:1px solid #2A203B}
  </style></head><body>${body}<script>${script}</script></body></html>`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function captureRigContexts(browser, serverUrl, scenes, outDir, prefix, manifest) {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  attachErrors(page, manifest, `${prefix}-rig`);
  await page.goto(`${serverUrl}/tools/forge-art/rig.html?mesh=0&combat=1&seed=53505`, {
    waitUntil: 'load',
    timeout: NAV_TIMEOUT_MS,
  });
  await page.waitForFunction(() => globalThis.__FORGE_RIG__?.ready === true, null, { timeout: NAV_TIMEOUT_MS });
  const shots = {};
  for (const scene of scenes) {
    await page.evaluate((name) => globalThis.__FORGE_RIG__.show(name), scene);
    await settleFrames(page);
    await delay(120);
    const file = path.join(outDir, `${prefix}-${scene}.png`);
    await page.screenshot({ path: file, type: 'png' });
    shots[scene] = file;
  }
  await page.close();
  return shots;
}

function meanOf(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : Number.NaN;
}

function minOf(values) {
  return values.length ? Math.min(...values) : Number.NaN;
}

function fmtMetric(value, digits = 2) {
  return Number.isNaN(value) ? 'n/a' : value.toFixed(digits);
}

function objectiveRow(id, label, value, threshold, pass, proven, note) {
  return { id, label, value, threshold, pass, proven, ...(note ? { note } : {}) };
}

function advisoryRow(id, label, note) {
  return objectiveRow(id, label, 'n/a', 'n/a', true, false, note);
}

/**
 * Mirror workbench.ts's objective-gate computation using the shared metric and
 * threshold modules. Only rows marked proven become acceptance gates; the
 * remaining rows are retained as advisory evidence.
 */
function computeObjectiveReport(assetId, frames, accepted) {
  const def = ASSET_BY_ID[assetId];
  const thresholds = thresholdsFor(assetId);
  const imgs = frames.map((frame) => (frame.error ? null : pixView(frame.pix)));
  const valid = imgs.filter((image) => image !== null);
  const has8Dirs = def.adapterId === 'combat' || def.adapterId === 'worker8';
  const rows = [];
  const classProven = thresholds.proven;

  const alpha = valid.map((image) => alphaCoverage(image));
  const alphaMean = meanOf(alpha);
  rows.push(objectiveRow(
    'alpha-coverage', 'alpha coverage', `${fmtMetric(alphaMean * 100, 1)}%`,
    `${(thresholds.alphaMin * 100).toFixed(0)}–${(thresholds.alphaMax * 100).toFixed(0)}%`,
    alpha.length > 0 && alphaMean >= thresholds.alphaMin && alphaMean <= thresholds.alphaMax,
    classProven,
    alpha.some((value) => Number.isNaN(value)) ? 'some frames empty' : undefined,
  ));

  const connected = valid.map((image) => primaryComponentShare(image));
  const connectedMin = minOf(connected);
  rows.push(objectiveRow(
    'connected-share', 'connected share', `${fmtMetric(connectedMin * 100, 1)}%`,
    `≥ ${(thresholds.connectedMin * 100).toFixed(0)}%`,
    connected.length > 0 && connectedMin >= thresholds.connectedMin,
    classProven,
  ));

  if (has8Dirs && valid.length >= 8) {
    const first = imgs[0];
    const second = imgs[8];
    if (first && second) {
      const delta = poseDeltaPercent(first, second);
      rows.push(objectiveRow(
        'pose-delta', 'pose delta', `${fmtMetric(delta, 1)}%`,
        `${thresholds.poseDeltaMin}–${thresholds.poseDeltaMax}%`,
        delta >= thresholds.poseDeltaMin && delta <= thresholds.poseDeltaMax,
        classProven,
      ));
    }
  } else {
    rows.push(advisoryRow('pose-delta', 'pose delta', 'single-cell asset — no pose pair'));
  }

  if (has8Dirs && imgs[0] && imgs[2]) {
    const delta = meanRgbaDelta(imgs[2], imgs[0]);
    rows.push(objectiveRow(
      'n-vs-e-delta', 'N/E direction delta', fmtMetric(delta, 1),
      `> ${thresholds.nVsEDeltaMin}`, delta > thresholds.nVsEDeltaMin, classProven,
    ));
  } else {
    rows.push(advisoryRow('n-vs-e-delta', 'N/E direction delta', 'no 8-facing cell set'));
  }

  if (def.adapterId === 'combat') {
    const own = imgs[0];
    let worst = 0;
    let worstId = '';
    if (own) {
      for (const other of CATALOG) {
        if (other.assetId === assetId || other.adapterId !== 'combat') continue;
        const sibling = getFrames(other.assetId);
        const sib = sibling[0] && !sibling[0].error ? pixView(sibling[0].pix) : null;
        if (!sib) continue;
        const iou = silhouetteIou(own, sib);
        if (!Number.isNaN(iou) && iou > worst) {
          worst = iou;
          worstId = other.assetId;
        }
      }
    }
    rows.push(objectiveRow(
      'silhouette-overlap', 'silhouette overlap', fmtMetric(worst, 3),
      `< ${thresholds.silhouetteOverlapMax}`, worst < thresholds.silhouetteOverlapMax,
      classProven, worstId ? `vs ${worstId}` : 'no sibling',
    ));
  } else {
    rows.push(advisoryRow('silhouette-overlap', 'silhouette overlap', 'non-combat class'));
  }

  const mag = valid.map((image) => magShare(image));
  const magMean = meanOf(mag);
  rows.push(objectiveRow(
    'mag-share', 'MAG share', `${fmtMetric(magMean * 100, 2)}%`,
    `${(thresholds.magShareMin * 100).toFixed(1)}–${(thresholds.magShareMax * 100).toFixed(1)}%`,
    mag.length > 0 && magMean >= thresholds.magShareMin && magMean <= thresholds.magShareMax,
    classProven,
    !classProven && magMean > 0 ? 'advisory band uncalibrated' : undefined,
  ));

  const luma = valid.map((image) => averageLuma(image));
  const lumaMean = meanOf(luma);
  rows.push(objectiveRow(
    'luma-floor', 'avg luminance', fmtMetric(lumaMean, 1), `≥ ${thresholds.lumaFloor}`,
    luma.length > 0 && lumaMean >= thresholds.lumaFloor, classProven,
  ));

  const bright = valid.map((image) => brightMaterialShare(image));
  const brightMin = minOf(bright);
  rows.push(objectiveRow(
    'bright-share', 'bright material', `${fmtMetric(brightMin * 100, 1)}%`,
    `≥ ${(thresholds.brightShareMin * 100).toFixed(0)}%`,
    bright.length > 0 && brightMin >= thresholds.brightShareMin, classProven,
  ));

  const rims = valid.map((image) => rimLayerShares(image, RIM_COLORS));
  const rimOuter = minOf(rims.map((value) => value.outer));
  const rimInner = minOf(rims.map((value) => value.inner));
  rows.push(objectiveRow(
    'rim-outer', 'rim outer share', `${fmtMetric(rimOuter * 100, 1)}%`,
    `≥ ${(thresholds.rimOuterShareMin * 100).toFixed(0)}%`,
    rims.length > 0 && rimOuter >= thresholds.rimOuterShareMin, classProven,
  ));
  rows.push(objectiveRow(
    'rim-inner', 'rim inner share', `${fmtMetric(rimInner * 100, 1)}%`,
    `≥ ${(thresholds.rimInnerShareMin * 100).toFixed(0)}%`,
    rims.length > 0 && rimInner >= thresholds.rimInnerShareMin, classProven,
  ));

  if (def.role === 'guard' || def.role === 'walker') {
    const bounds = imgs[0] ? sourceBounds(imgs[0]) : null;
    const minW = def.role === 'guard' ? thresholds.guardBoundsMinW : thresholds.walkerBoundsMinW;
    const minH = def.role === 'guard' ? thresholds.guardBoundsMinH : thresholds.walkerBoundsMinH;
    const width = bounds ? bounds.maxX - bounds.minX + 1 : 0;
    const height = bounds ? bounds.maxY - bounds.minY + 1 : 0;
    rows.push(objectiveRow(
      `${def.role}-bounds`, `${def.role} bounds`, `${width}×${height}`,
      `≥ ${minW}×${minH}`, width >= minW && height >= minH, classProven,
    ));
  } else {
    rows.push(advisoryRow('anatomy-bounds', 'anatomy bounds', 'no anatomy rule for this role'));
  }

  const selectedKey = def.frames[0];
  const selectedFrame = frames.find((frame) => frame.key === selectedKey) ?? frames[0];
  const selectedCell = accepted?.cells?.find((cell) => cell.key === selectedKey);
  if (selectedCell && selectedFrame && !selectedFrame.error) {
    const candidate = pixView(selectedFrame.pix);
    const baseline = {
      width: selectedCell.w ?? accepted.geo.cellW,
      height: selectedCell.h ?? accepted.geo.cellH,
      data: selectedCell.data,
    };
    const diffCount = differingPixels(baseline, candidate);
    const union = unionAlpha(baseline, candidate);
    const pct = Number.isNaN(union) || union === 0 ? Number.NaN : (diffCount / union) * 100;
    rows.push(objectiveRow(
      'pixel-diff', 'pixel diff (sel frame)', `${fmtMetric(pct, 2)}% (${Number.isNaN(diffCount) ? '?' : diffCount} px)`,
      '0%', diffCount === 0, false, 'advisory — A/B difference report, not a fail gate',
    ));
    const baseBox = sourceBounds(baseline);
    const candidateBox = sourceBounds(candidate);
    if (baseBox && candidateBox) {
      const delta =
        Math.abs(baseBox.maxX - baseBox.minX - (candidateBox.maxX - candidateBox.minX)) +
        Math.abs(baseBox.maxY - baseBox.minY - (candidateBox.maxY - candidateBox.minY));
      rows.push(objectiveRow(
        'bbox-delta', 'bbox delta (sel frame)', `${delta} px`, '0 px', delta === 0, false,
        'advisory — A/B difference report, not a fail gate',
      ));
    } else {
      rows.push(advisoryRow('bbox-delta', 'bbox delta (sel frame)', 'no alpha bounds'));
    }
  } else if (accepted) {
    rows.push(advisoryRow('pixel-diff', 'pixel diff (sel frame)', 'frame error or no baseline cell'));
    rows.push(advisoryRow('bbox-delta', 'bbox delta (sel frame)', 'frame error or no baseline cell'));
  } else {
    rows.push(advisoryRow('pixel-diff', 'pixel diff (sel frame)', 'no accepted baseline'));
    rows.push(advisoryRow('bbox-delta', 'bbox delta (sel frame)', 'no accepted baseline'));
  }

  return {
    thresholds,
    rows,
    provenGates: Object.fromEntries(rows.filter((gate) => gate.proven).map((gate) => [gate.id, gate.pass])),
  };
}

function requiredProofFiles(isRoster, assetIds, hasAcceptedBaseline) {
  if (isRoster) {
    return ['catalog.json', 'metrics.json', 'console.txt', 'critic-brief.txt'];
  }
  const files = [
    'asset.json', 'metrics.json', 'changes.json', 'source-sheet.png', 'candidate-sheet.png',
    'silhouette-sheet.png', 'value-sheet.png', 'normal-context.png', 'close-context.png',
    'far-context.png', 'console.txt', 'critic-brief.txt',
  ];
  if (hasAcceptedBaseline) files.push('accepted-sheet.png', 'difference-sheet.png');
  return files;
}

function proofGates(manifest, assetIds, candidateFramesByAsset, requiredFiles) {
  const outDir = manifest.args.out;
  const gates = {};
  const candidateHashesComplete = assetIds.every((assetId) => {
    const frames = candidateFramesByAsset.get(assetId) ?? [];
    const hashes = manifest.metrics?.[assetId]?.candidateHashes;
    if (!hashes || typeof hashes !== 'object' || frames.length === 0) return false;
    const keys = Object.keys(hashes);
    return frames.length === keys.length && frames.every((frame) => typeof hashes[frame.key] === 'string');
  });
  const filesComplete = requiredFiles.every((file) => fs.existsSync(path.join(outDir, file)));
  const contextsComplete = manifest.captures?.contexts && Object.values(manifest.captures.contexts).every(Boolean);

  Object.assign(gates, {
    'proof-complete': filesComplete && candidateHashesComplete && Boolean(contextsComplete),
    'no-browser-errors': manifest.errors.length === 0,
    'production-isolation': manifest.productionIsolation?.scanned === true && manifest.productionIsolation.clean === true,
    'no-failed-frames': Array.isArray(manifest.failedFrames) && manifest.failedFrames.length === 0,
  });
  for (const assetId of assetIds) {
    const proven = manifest.metrics?.[assetId]?.provenGates;
    if (!proven || typeof proven !== 'object') continue;
    for (const [id, pass] of Object.entries(proven)) gates[`objective:${id}`] = pass === true;
  }
  return gates;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = resolveOut(args.out);
  const assetArg = typeof args.asset === 'string' ? args.asset : '';
  if (!assetArg) throw new Error('--asset=<id>|roster is required');
  const isRoster = assetArg === 'roster';
  const assetIds = isRoster ? CATALOG.map((entry) => entry.assetId) : [assetArg];
  for (const id of assetIds) if (!ASSET_BY_ID[id]) throw new Error(`unknown asset ${id}`);
  fs.mkdirSync(outDir, { recursive: true });

  const git = gitInfo();

  const manifest = {
    schemaVersion: 1,
    tool: 'forge-art-proof',
    assetId: assetArg,
    sourceRevision: git.revision,
    declaredDirtyFiles: [...git.dirty],
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: { asset: assetArg, out: outDir },
    viewport: VIEWPORT,
    seed: 53505,
    git,
    captures: {},
    metrics: {},
    gates: {},
    failedFrames: [],
    errors: [],
    productionIsolation: productionIsolationScan(),
    ok: false,
  };

  let server = null;
  let browser = null;
  const candidateFramesByAsset = new Map();
  try {
    server = await startVite({ config: 'vite.forge-art.config.ts' });
    console.log(`forge-art-proof: dev server at ${server.url}`);
    browser = await launchChromium(playwright, { marker: 'forge-art-proof' });

    // ---- pixel sheets via composer page (Canvas2D only) ----
    const payloads = [];
    const toArray = (buffer) => Array.from(buffer);
    for (const assetId of assetIds) {
      const sourceFrames = candidateFramesFor(assetId);
      candidateFramesByAsset.set(assetId, sourceFrames);
      manifest.failedFrames.push(...sourceFrames.filter((frame) => frame.error).map((frame) => (
        isRoster ? `${assetId}:${frame.key}` : frame.key
      )));
      const candidateFrames = sourceFrames.map((f) => ({ key: f.key, bytes: toArray(Buffer.from(f.pix.d)) }));
      const accepted = acceptedCells(assetId);
      const geo = gridGeometryFor(assetId);
      const scale = geo.cellW >= 64 ? 2 : 4;
      const common = {
        cellW: geo.cellW, cellH: geo.cellH, cols: geo.cols, cellScale: scale,
        width: geo.cellW * geo.cols * scale, height: geo.cellH * geo.rows * scale,
      };
      payloads.push({ id: `${assetId}-candidate`, title: `${assetId} — CURRENT CANDIDATE`, frames: candidateFrames, labels: true, pass: 'none', ...common });
      payloads.push({ id: `${assetId}-candidate-sil`, title: `${assetId} — silhouette`, frames: candidateFrames, labels: false, pass: 'silhouette', ...common });
      payloads.push({ id: `${assetId}-candidate-val`, title: `${assetId} — value`, frames: candidateFrames, labels: false, pass: 'value', ...common });
      if (accepted) {
        payloads.push({ id: `${assetId}-accepted`, title: `${assetId} — ACCEPTED BASELINE`, frames: accepted.cells.map((c) => ({ key: c.key, bytes: toArray(c.data) })), labels: true, pass: 'none', ...common });
        const diffFrames = accepted.cells.map((cell, index) => ({
          key: cell.key,
          bytes: toArray(diffBytes(cell.data, candidateFrames[index] ? Buffer.from(candidateFrames[index].bytes) : Buffer.alloc(cell.data.length))),
        }));
        payloads.push({ id: `${assetId}-diff`, title: `${assetId} — DIFFERENCE (red = changed)`, frames: diffFrames, labels: true, pass: 'none', ...common });
      }
    }

    const composerPath = path.join('/tmp', `fal-composer-${process.pid}.html`);
    fs.writeFileSync(composerPath, sheetComposerHtml(payloads));
    const composerPage = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    attachErrors(composerPage, manifest, 'composer');
    await composerPage.goto(`file://${composerPath}`, { waitUntil: 'load' });
    await composerPage.waitForFunction(() => document.body.dataset.ready === 'true', null, { timeout: NAV_TIMEOUT_MS });

    if (isRoster) {
      const rosterShots = {};
      for (const [name, selector] of [
        ['roster-labeled', '[data-fal-sheet$="-candidate"]'],
      ]) {
        void name; void selector;
      }
      // full-page roster composition: label every candidate sheet
      rosterShots['roster-unlabeled'] = null; // composed below element-by-element instead
      const elements = await composerPage.$$('.sheet');
      const files = {};
      for (let i = 0; i < elements.length; i++) {
        const heading = await elements[i].$eval('h2', (node) => node.textContent);
        const slug = slugify(heading);
        const file = path.join(outDir, `roster-${slug}.png`);
        await elements[i].screenshot({ path: file });
        files[slug] = file;
      }
      manifest.captures.rosterSheets = Object.keys(files);
      // copy canonical required names
      const copyIfExists = (slug, target) => { if (files[slug]) fs.copyFileSync(files[slug], path.join(outDir, target)); };
      for (const id of assetIds) {
        copyIfExists(`${id}-candidate-sil`, `roster-${slugify(id)}-silhouettes.png`);
        copyIfExists(`${id}-candidate-val`, `roster-${slugify(id)}-values.png`);
      }
    } else {
      for (const payload of payloads) {
        const el = await composerPage.$(`[data-fal-sheet="${payload.id}"]`);
        if (!el) continue;
        const map = {
          candidate: 'candidate-sheet.png',
          accepted: 'accepted-sheet.png',
          diff: 'difference-sheet.png',
          'candidate-sil': 'silhouette-sheet.png',
          'candidate-val': 'value-sheet.png',
        };
        const suffix = payload.id.slice(assetIds[0].length + 1); // strip '<assetId>-'
        const target = map[suffix];
        if (target) await el.screenshot({ path: path.join(outDir, target) });
      }
      // source sheet = candidate at 1x
      const first = candidateFramesFor(assetIds[0]);
      writeSourceSheet(first, gridGeometryFor(assetIds[0]), path.join(outDir, 'source-sheet.png'));
    }
    await composerPage.close();
    fs.rmSync(composerPath, { force: true });

    // ---- real-renderer context captures ----
    const scenes = ['quiet-helios', 'unit-selected', 'cam-close', 'cam-normal', 'cam-strategic'];
    if (!isRoster) {
      scenes.push('construction', 'fog-edge');
    } else {
      scenes.push('confrontation', 'battle-clump');
    }
    const rigShots = await captureRigContexts(browser, server.url, scenes, outDir, isRoster ? 'context' : 'context', manifest);
    manifest.captures.contexts = rigShots;
    if (!isRoster) {
      const renames = {
        'cam-close': 'close-context.png',
        'cam-normal': 'normal-context.png',
        'cam-strategic': 'far-context.png',
      };
      for (const [scene, target] of Object.entries(renames)) {
        if (rigShots[scene]) fs.copyFileSync(rigShots[scene], path.join(outDir, target));
      }
    }

    // ---- metrics + manifests ----
    for (const assetId of assetIds) {
      const accepted = acceptedCells(assetId);
      const frames = candidateFramesByAsset.get(assetId) ?? getFrames(assetId);
      const candidateHashes = {};
      const report = [];
      for (const frame of frames) {
        candidateHashes[frame.key] = sha256Buffer(Buffer.from(frame.pix.d));
        if (accepted) {
          const match = accepted.cells.find((c) => c.key === frame.key);
          report.push({
            key: frame.key,
            acceptedSha: match ? sha256Buffer(match.data) : null,
            candidateSha: candidateHashes[frame.key],
            changed: !match || !match.data.equals(Buffer.from(frame.pix.d)),
          });
        }
      }
      const objective = computeObjectiveReport(assetId, frames, accepted);
      manifest.metrics[assetId] = {
        candidateRevision: manifest.git.revision,
        candidateHashes,
        changes: accepted ? {
          changedCells: report.filter((r) => r.changed).map((r) => r.key),
          unchangedCount: report.filter((r) => !r.changed).length,
        } : 'NO ACCEPTED BASELINE',
        thresholdsUsed: objective.thresholds,
        gateReports: objective.rows,
        provenGates: objective.provenGates,
      };
    }

    fs.writeFileSync(
      path.join(outDir, 'critic-brief.txt'),
      criticBrief(isRoster, assetIds),
    );
    fs.writeFileSync(
      path.join(outDir, 'console.txt'),
      manifest.errors.join('\n') || 'no console/page errors captured',
    );
    if (!isRoster) {
      fs.writeFileSync(path.join(outDir, 'asset.json'), JSON.stringify(ASSET_BY_ID[assetIds[0]], null, 2));
      fs.writeFileSync(path.join(outDir, 'metrics.json'), JSON.stringify(manifest.metrics[assetIds[0]], null, 2));
      fs.writeFileSync(path.join(outDir, 'changes.json'), JSON.stringify(manifest.metrics[assetIds[0]].changes, null, 2));
    } else {
      fs.writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(CATALOG, null, 2));
      fs.writeFileSync(path.join(outDir, 'metrics.json'), JSON.stringify(manifest.metrics, null, 2));
    }
    manifest.gates = proofGates(
      manifest,
      assetIds,
      candidateFramesByAsset,
      requiredProofFiles(isRoster, assetIds, Boolean(acceptedCells(assetIds[0]))),
    );
    manifest.ok = Object.values(manifest.gates).every((value) => value === true);
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  } catch (error) {
    manifest.errors.push(error?.stack ?? String(error));
    manifest.ok = false;
  } finally {
    try { if (browser) await browser.close(); } catch {}
    try { await stopVite(server); } catch {}
    manifest.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(`--- forge-art-proof summary ---`);
    console.log(`ok=${manifest.ok} out=${outDir}`);
    if (manifest.errors.length) {
      for (const error of manifest.errors) console.log(`error: ${String(error).split('\n')[0]}`);
    }
    if (!manifest.ok) process.exitCode = 1;
  }
}

function sha256Buffer(buffer) {
  return require('node:crypto').createHash('sha256').update(buffer).digest('hex');
}

function diffBytes(a, b) {
  const out = Buffer.alloc(Math.max(a.length, b.length));
  for (let i = 0; i < out.length; i += 4) {
    const differs =
      a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3];
    if (differs) {
      out[i] = 178; out[i + 1] = 34; out[i + 2] = 34; out[i + 3] = 255; // #B22222
    } else if ((a[i + 3] ?? 0) > 0) {
      out[i] = 60; out[i + 1] = 64; out[i + 2] = 72; out[i + 3] = 140; // dim ghost
    }
  }
  return out;
}

function writeSourceSheet(frames, geo, file) {
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
  fs.writeFileSync(file, PNG.sync.write(png));
}

function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function productionIsolationScan() {
  const dist = path.join(REPO_ROOT, 'dist');
  if (!fs.existsSync(dist)) return { scanned: false, reason: 'dist/ not built yet' };
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        if (/forge|art-lab|baseline/i.test(entry.name)) offenders.push(full);
        else if (/\.(js|css|html)$/.test(entry.name)) {
          const content = fs.readFileSync(full, 'utf8');
          if (/forge[ _-]?art[ _-]?lab|FORGE_ART/i.test(content)) offenders.push(full);
        }
      }
    }
  };
  walk(dist);
  return { scanned: true, clean: offenders.length === 0, offenders };
}

function criticBrief(isRoster, assetIds) {
  if (isRoster) {
    return `BLIND REVIEW BRIEF — Starhaven Forge Art Lab roster pack.

You are judging a developer workbench's evidence, not the game itself.
Look at the roster sheets and context captures. Answer:
1. Can you tell Sunweaver (warm gold/cream) assets from Gravemark (cold slate/ice) at a glance?
2. Does any unit read like another unit's twin? Name the pair.
3. Do buildings read at strategic distance?
4. Single biggest remaining review gap of the TOOL (what should it show that it does not?).`;
  }
  return `BLIND REVIEW BRIEF — Starhaven Forge Art Lab single-asset proof pack (${assetIds[0]}).

You are judging whether this tool pack makes art differences clear:
1. Are accepted vs candidate vs difference sheets readable side by side?
2. Is the sprite legible at the normal-context scale (not just enlarged)?
3. Do silhouette/value passes expose structure clearly?
4. Name the single biggest usability gap you see.`;
}

main().catch((error) => {
  console.error(`forge-art-proof: fatal: ${error?.stack ?? error}`);
  process.exitCode = 1;
});
