/**
 * Forge Art Lab v1 — workbench boot module (FAL-UI).
 *
 * Builds the full workbench DOM inside the existing `index.html` body (the
 * HTML file itself stays untouched; styling is injected here), wires one
 * ForgeLabStore, paints the 2D comparison stage from baseline PNG bytes vs
 * current candidate Pix bytes, computes objective gates live in the browser
 * (metrics.ts + thresholds.ts), and publishes the frozen QA probe.
 *
 * Layout (A5 §1): top bar | left catalog rail | center comparison stage |
 * right inspector/metrics | bottom context strip + event log. Roster and rig
 * context are overlays. The workbench page itself creates NO WebGL context —
 * the rig iframe hosts the one live GameRenderer.
 */
import { STARHOLD_PALETTE } from '../../../src/palette';
import { frameKeyOrder } from './baseline-schema';
import { getFrames, getSandboxOverride, type FrameSource } from './adapters';
import {
  alphaCoverage,
  averageLuma,
  brightMaterialShare,
  differingPixels,
  imageSha256,
  magShare,
  meanRgbaDelta,
  pixView,
  poseDeltaPercent,
  primaryComponentShare,
  regionSha256,
  rimLayerShares,
  sha256Bytes,
  silhouetteIou,
  sourceBounds,
  unionAlpha,
  type RgbaImage,
  type RimColors,
  type Rgb,
} from './metrics';
import {
  CATALOG,
  ASSET_BY_ID,
  isPublicAssetId,
  type AssetDefinition,
} from './registry';
import {
  ForgeLabStore,
  loadInitialState,
  PASS_IDS,
  canonicalHash,
  type ForgeLabState,
  type PassId,
  type ZoomLevel,
} from './store';
import { THRESHOLDS, thresholdsFor, type ThresholdEntry } from './thresholds';
import {
  applyPass,
  composeSheet,
  diffImages,
  drawCellTo,
  sheetBytes,
  type PixelImage,
} from './views';

// ---------------------------------------------------------------------------
// Vocabulary / constants
// ---------------------------------------------------------------------------

/** dir8 compass labels (src/engine.ts: 0=E 1=NE 2=N 3=NW 4=W 5=SW 6=S 7=SE). */
const DIR_LABELS: readonly string[] = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
/** dirs produced by flipX of an authored cell (sprites.ts convention). */
const MIRRORED_DIRS = new Set([3, 4, 5]);

/** Rim colors for both public factions (VS-4 oracle: amber outer / cream inner). */
const RIM_COLORS: RimColors = {
  outer: hexRgb(STARHOLD_PALETTE.amber) as Rgb,
  inner: hexRgb(STARHOLD_PALETTE.cream) as Rgb,
};

function hexRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

const STAGE_MAX = 280;
const STEP_MS = 250; // one frame step per 250ms at speed 1
const EVENT_LOG_LEN = 6;

type ChipText =
  | 'MISSING BASELINE'
  | 'PARTIAL'
  | 'OBJECTIVE FAIL'
  | 'READY FOR REVIEW'
  | 'CURRENT CANDIDATE'
  | 'PREVIEW OVERRIDE';

interface GateRow {
  id: string;
  label: string;
  value: string;
  threshold: string;
  pass: boolean;
  proven: boolean;
  note?: string;
}

interface BaselineData {
  img: RgbaImage;
  manifestSha256: string;
  revision: string | null;
  acceptedAt: string | null;
  /** key -> grid cell index (manifest frame order). */
  cellIndex: Map<string, number>;
  /** Region copy of the baseline cell for a frame key; null when absent. */
  cell(key: string): PixelImage | null;
}

interface StatusResult {
  chip: ChipText;
  previewOverride: boolean;
}

// ---------------------------------------------------------------------------
// DOM helpers + injected styles
// ---------------------------------------------------------------------------

const STYLE = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; overflow: hidden; }
body {
  background: #0B0A12; color: #F0E7D2;
  font: 13px/1.45 ui-monospace, Menlo, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}
button, input, select { font: inherit; color: inherit; }
button {
  background: #171326; color: #9CA6A5; border: 1px solid #2A203B;
  border-radius: 4px; padding: 3px 8px; cursor: pointer; min-height: 24px;
  white-space: nowrap;
}
button:hover { color: #F0E7D2; border-color: #D09A4E; }
button:disabled { opacity: 0.4; cursor: default; }
button:focus-visible, input:focus-visible, select:focus-visible, a:focus-visible {
  outline: 2px solid #D09A4E; outline-offset: 1px;
}
.btn-active, button.active {
  color: #0B0A12 !important; background: #D09A4E !important; border-color: #D09A4E !important;
}
.mono { font-variant-numeric: tabular-nums; }

#fal-app {
  display: grid; height: 100vh;
  grid-template-rows: 42px minmax(0, 1fr) 62px;
  grid-template-columns: 218px minmax(0, 1fr) 330px;
  grid-template-areas: "top top top" "rail stage insp" "strip strip strip";
}
#fal-topbar { grid-area: top; display: flex; align-items: center; gap: 10px; padding: 0 12px;
  border-bottom: 1px solid #2A203B; background: #171326; }
#fal-rail { grid-area: rail; border-right: 1px solid #2A203B; background: #171326;
  display: flex; flex-direction: column; min-height: 0; }
#fal-stage { grid-area: stage; overflow: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
#fal-inspector { grid-area: insp; border-left: 1px solid #2A203B; background: #171326;
  overflow-y: auto; padding: 10px 12px; }
#fal-strip { grid-area: strip; border-top: 1px solid #2A203B; background: #171326;
  display: flex; flex-direction: column; justify-content: center; gap: 3px; padding: 4px 12px; overflow: hidden; }

#fal-title { font-weight: 700; letter-spacing: 0.1em; color: #D09A4E; font-size: 12px; }
#fal-breadcrumb { color: #9CA6A5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#fal-status { border-radius: 4px; padding: 2px 8px; font-size: 11px; letter-spacing: 0.06em; }
.chip-status { border: 1px solid #2A203B; }
.chip-status[data-state="missing"] { color: #D09A4E; border-color: #D09A4E; }
.chip-status[data-state="partial"] { color: #E8A33D; border-color: #E8A33D; }
.chip-status[data-state="fail"] { background: #B84B45; color: #F0E7D2; border-color: #B84B45; }
.chip-status[data-state="review"] { color: #4E8A5A; border-color: #4E8A5A; }
.chip-status[data-state="current"] { color: #5AC8FA; border-color: #5AC8FA; }
.chip-status[data-state="override"] { color: #B08BD9; border-color: #B08BD9; }
#fal-stale { color: #E8A33D; border: 1px solid #E8A33D; border-radius: 4px; padding: 2px 8px; font-size: 11px; }
#fal-topbar .spacer { flex: 1; }
#fal-topbar .meta { color: #9CA6A5; font-size: 11px; }

#fal-search { width: 100%; background: #0B0A12; border: 1px solid #2A203B; border-radius: 4px;
  color: #F0E7D2; padding: 4px 8px; margin-bottom: 6px; }
#fal-catalog { overflow-y: auto; flex: 1; min-height: 0; }
.fal-group-title { font-size: 11px; letter-spacing: 0.08em; color: #D09A4E; text-transform: uppercase;
  padding: 8px 10px 3px; }
.fal-asset {
  display: flex; align-items: center; gap: 7px; width: calc(100% - 12px); margin: 2px 6px;
  text-align: left; font-size: 12px;
}
.fal-asset .dot { width: 8px; height: 8px; border-radius: 50%; background: #2A203B; flex: none;
  border: 1px solid #3A2C55; }
.dot[data-state="missing"] { background: #D09A4E; }
.dot[data-state="partial"] { background: #E8A33D; }
.dot[data-state="fail"] { background: #B84B45; }
.dot[data-state="review"] { background: #4E8A5A; }
.dot[data-state="current"] { background: #5AC8FA; }
.dot[data-state="override"] { background: #B08BD9; }
.fal-asset .lbl { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fal-asset .cat { color: #6B7280; font-size: 10px; }

#fal-stage-frame { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
#fal-stage-box { position: relative; overflow: hidden; border: 1px solid #2A203B;
  border-radius: 4px; background: #0B0A12; }
#fal-stage-box canvas { position: absolute; top: 0; left: 0; image-rendering: pixelated;
  background: transparent; }
#fal-stage-box .zoom-wrap { position: absolute; top: 0; left: 0; transform-origin: top left; }
#fal-stage-box .zoom-wrap canvas { position: static; display: block; }
#fal-stage-box[data-mode="side"] canvas { position: static; display: block; }
#fal-stage-box[data-mode="side"] { display: flex; gap: 12px; align-items: flex-start; }
#fal-stage-box[data-mode="side"] .zoom-wrap { position: static; }
#fal-stage-box[data-mode="diff"] #fal-diff-canvas { opacity: 0.5; pointer-events: none; }
#fal-wipe-row { display: flex; align-items: center; gap: 8px; width: 280px; }
#fal-wipe-row input[type="range"] { flex: 1; accent-color: #D09A4E; }
#fal-wipe-divider {
  position: absolute; top: 0; bottom: 0; width: 2px; z-index: 5;
  background: #D09A4E; opacity: 0.85; pointer-events: none;
}
.ctrl-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.ctrl-row .row-label { color: #9CA6A5; font-size: 11px; letter-spacing: 0.06em; margin-right: 2px; }
.facing-btn .mirror { font-size: 9px; color: #6B7280; margin-left: 3px; }
.facing-btn[data-active="true"] .mirror { color: #0B0A12; }
input[type="range"] { accent-color: #D09A4E; }
#fal-frame-readout { min-width: 34px; text-align: center; color: #F0E7D2; }

#fal-inspector h2 { font-size: 11px; letter-spacing: 0.08em; color: #D09A4E; margin: 12px 0 6px;
  text-transform: uppercase; }
#fal-inspector h2:first-child { margin-top: 0; }
.fal-kv { display: grid; grid-template-columns: 92px 1fr; gap: 2px 8px; font-size: 11px; }
.fal-kv dt { color: #9CA6A5; }
.fal-kv dd { margin: 0; color: #F0E7D2; overflow-wrap: anywhere; }
#fal-gates { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
#fal-gates th { color: #9CA6A5; text-align: left; font-weight: 400; padding: 2px 4px;
  border-bottom: 1px solid #2A203B; }
#fal-gates td { padding: 2px 4px; border-bottom: 1px solid #1E1A2E; vertical-align: top;
  overflow-wrap: anywhere; }
#fal-gates th:nth-child(1) { width: 42%; }
#fal-gates th:nth-child(2) { width: 16%; }
#fal-gates th:nth-child(3) { width: 24%; }
#fal-gates th:nth-child(4) { width: 18%; }
#fal-gates td.v { color: #9CA6A5; }
#fal-gates tr[data-verdict="pass"] td.verdict { color: #4E8A5A; }
#fal-gates tr[data-verdict="fail"] td.verdict { color: #B84B45; }
#fal-gates tr[data-verdict="warn"] td.verdict { color: #E8A33D; }
#fal-gates tr[data-verdict="na"] td.verdict { color: #6B7280; }
#fal-gates .note { color: #6B7280; }
#fal-baseline-banner { color: #D09A4E; font-size: 11px; padding: 4px 0; }
#fal-metrics { font-size: 11px; color: #9CA6A5; padding: 4px 0; white-space: pre-wrap; }
#fal-failures { background: #0B0A12; border: 1px solid #2A203B; border-radius: 4px;
  padding: 6px; font-size: 10px; overflow-x: auto; max-height: 180px; white-space: pre; color: #9CA6A5; }
#fal-inspector .btn-row { display: flex; gap: 6px; margin-top: 6px; }

#fal-strip .line { display: flex; gap: 8px; align-items: center; min-width: 0; }
#fal-strip .line .k { color: #6B7280; }
#fal-hash { color: #D09A4E; font-size: 11px; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; flex: 1; }
#fal-log { color: #6B7280; font-size: 10px; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; }
#fal-log b { color: #9CA6A5; font-weight: 400; }

.fal-overlay { position: fixed; inset: 0; z-index: 50; background: rgba(11, 10, 18, 0.82);
  display: flex; align-items: center; justify-content: center; }
.fal-overlay[hidden] { display: none; }
.fal-overlay .panel { background: #171326; border: 1px solid #2A203B; border-radius: 6px;
  max-width: 94vw; max-height: 92vh; overflow: auto; padding: 14px 16px; position: relative; }
.fal-overlay .panel h2 { margin: 0 0 8px; color: #D09A4E; font-size: 12px; letter-spacing: 0.08em; }
.fal-overlay .close { position: absolute; top: 8px; right: 8px; }
#fal-roster-board { display: flex; flex-direction: column; gap: 10px; }
.fal-roster-row { display: flex; flex-direction: column; gap: 2px; }
.fal-roster-label { color: #9CA6A5; font-size: 11px; }
.fal-roster-row canvas { border: 1px solid #2A203B; border-radius: 3px; image-rendering: pixelated; }
#fal-roster-tools { display: flex; gap: 12px; align-items: center; margin-bottom: 8px; color: #9CA6A5; font-size: 11px; }
#fal-context-frame { width: 860px; height: 560px; border: 1px solid #2A203B; border-radius: 4px;
  background: #0B0A12; }
#fal-context-scenes { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
#fal-help-list { font-size: 12px; line-height: 1.7; color: #9CA6A5; }
#fal-help-list kbd { color: #F0E7D2; background: #0B0A12; border: 1px solid #2A203B;
  border-radius: 3px; padding: 0 5px; font-family: inherit; }
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: Array<HTMLElement | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'aria-label' || key === 'role' || key === 'aria-pressed' ||
      key === 'aria-live' || key === 'aria-valuemin' || key === 'aria-valuemax' ||
      key === 'aria-valuenow' || key === 'aria-disabled') {
      node.setAttribute(key, value);
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of children) node.append(child);
  return node;
}

function fmtTime(d: Date): string {
  return d.toISOString().slice(11, 19);
}

// ---------------------------------------------------------------------------
// Boot state
// ---------------------------------------------------------------------------

const store = new ForgeLabStore(loadInitialState());

const sandboxActive = new URLSearchParams(window.location.search).get('sandbox') === '1';

/** assetId:group -> candidate FrameSource[] (sandbox override applied). */
const candidateCache = new Map<string, FrameSource[]>();
/** assetId -> baseline data | null (null = confirmed missing). */
const baselineCache = new Map<string, BaselineData | null>();
/** assetId -> gate rows (computed; used for rail dots). */
const gateCache = new Map<string, GateRow[]>();
const errors: string[] = [];

let glContexts = 0;
let renderedOnce = false;
let lastEvents: Array<{ time: string; text: string }> = [];
let rosterDirty = true;
let rosterOpen = false;
let contextOpen = false;
let helpOpen = false;
let selectedFrameKey = '';
let lastBaselineSha: string | undefined;
let lastCandidateSha: string | undefined;

// Live DOM refs
let stageBox: HTMLDivElement;
let baselineCanvas: HTMLCanvasElement;
let candidateWrap: HTMLDivElement;
let candidateCanvas: HTMLCanvasElement;
let diffCanvas: HTMLCanvasElement | null = null;
let wipeInput: HTMLInputElement;
let statusChip: HTMLSpanElement;
let staleBadge: HTMLSpanElement;
let overrideChip: HTMLSpanElement;
let frameReadout: HTMLSpanElement;
let hashReadout: HTMLSpanElement;
let metricsLine: HTMLDivElement;
let failuresPre: HTMLPreElement;
let gatesTable: HTMLTableElement;
let baselineBanner: HTMLDivElement;
let logLine: HTMLDivElement;
let searchInput: HTMLInputElement;
let catalogRoot: HTMLDivElement;
let poseRow: HTMLDivElement;
let facingRow: HTMLDivElement;
let abRow: HTMLDivElement;
let passRow: HTMLDivElement;
let zoomRow: HTMLDivElement;
let bgRow: HTMLDivElement;
let metadataDl: HTMLDListElement;
let rosterBoard: HTMLDivElement;
let rosterUnlabeled: HTMLInputElement;
let rosterScaleNote: HTMLSpanElement;
let contextFrame: HTMLIFrameElement;
let contextScenes: HTMLDivElement;

// ---------------------------------------------------------------------------
// Candidate + baseline retrieval
// ---------------------------------------------------------------------------

function cacheKey(assetId: string, group: string): string {
  return `${assetId}:${group}`;
}

/** Candidate frames for an asset+group, cached; sandbox override applied when active. */
function getCandidate(def: AssetDefinition, group: string): FrameSource[] {
  const key = cacheKey(def.assetId, group);
  let frames = candidateCache.get(key);
  if (!frames) {
    frames = getFrames(def.assetId, group);
    if (sandboxActive) {
      const override = getSandboxOverride(def.assetId);
      if (override) frames = frames.map((f) => ({ key: f.key, pix: override(f.pix), error: f.error }));
    }
    candidateCache.set(key, frames);
  }
  return frames;
}

function invalidateCandidates(): void {
  candidateCache.clear();
  gateCache.clear();
  rosterDirty = true;
}

/** Fetch + decode the accepted baseline for an asset. null => confirmed missing. */
async function loadBaseline(def: AssetDefinition): Promise<BaselineData | null> {
  const cached = baselineCache.get(def.assetId);
  if (cached !== undefined) return cached;
  const base = `./baselines/${def.assetId}/`;
  try {
    const [pngResp, manifestResp] = await Promise.all([
      fetch(`${base}baseline.png`),
      fetch(`${base}manifest.json`),
    ]);
    if (!pngResp.ok) {
      baselineCache.set(def.assetId, null);
      return null;
    }
    const blob = await pngResp.blob();
    const img = await decodeImage(blob);
    let revision: string | null = null;
    let acceptedAt: string | null = null;
    if (manifestResp.ok) {
      try {
        const manifest = (await manifestResp.json()) as {
          revision?: unknown;
          createdAt?: unknown;
          frames?: unknown;
          cellLayout?: unknown;
        };
        if (typeof manifest.revision === 'string') revision = manifest.revision;
        if (typeof manifest.createdAt === 'string') acceptedAt = manifest.createdAt;
      } catch {
        // manifest unreadable — PNG alone is enough for pixel gates
      }
    }
    const manifestSha = imageSha256(img);
    const cellIndex = new Map<string, number>();
    const cols = def.adapterId === 'combat' || def.adapterId === 'worker8' ? 8 : 1;
    const cellW = def.dims.w;
    const cellH = def.dims.h;
    def.frames.forEach((key, i) => cellIndex.set(key, i));
    const data: BaselineData = {
      img,
      manifestSha256: manifestSha,
      revision,
      acceptedAt,
      cellIndex,
      cell(key: string): PixelImage | null {
        const i = cellIndex.get(key);
        if (i === undefined) return null;
        const ox = (i % cols) * cellW;
        const oy = Math.floor(i / cols) * cellH;
        if (ox + cellW > img.width || oy + cellH > img.height) return null;
        const out = new Uint8ClampedArray(cellW * cellH * 4);
        const stride = img.width * 4;
        for (let y = 0; y < cellH; y++) {
          out.set(
            img.data.subarray((oy + y) * stride + ox * 4, (oy + y) * stride + ox * 4 + cellW * 4),
            y * cellW * 4,
          );
        }
        return { w: cellW, h: cellH, d: out };
      },
    };
    baselineCache.set(def.assetId, data);
    return data;
  } catch {
    baselineCache.set(def.assetId, null);
    return null;
  }
}

async function decodeImage(blob: Blob): Promise<RgbaImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return { width: canvas.width, height: canvas.height, data: data.data };
      }
      bitmap.close();
    } catch {
      // fall through to <img> decode
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { width: canvas.width, height: canvas.height, data: data.data };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------------------
// Objective gates (live in-browser: metrics.ts + thresholds.ts)
// ---------------------------------------------------------------------------

function meanOf(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;
}

function minOf(values: number[]): number {
  return values.length ? Math.min(...values) : NaN;
}

function fmtNum(v: number, digits = 2): string {
  return Number.isNaN(v) ? 'n/a' : v.toFixed(digits);
}

interface GateCtx {
  def: AssetDefinition;
  frames: FrameSource[];
  imgs: Array<RgbaImage | null>;
  t: ThresholdEntry;
  baseline: BaselineData | null;
  selKey: string;
}

/** One row; `note` marks N/A rows for non-applicable classes. */
function row(
  id: string,
  label: string,
  value: string,
  threshold: string,
  pass: boolean,
  proven: boolean,
  note?: string,
): GateRow {
  return { id, label, value, threshold, pass, proven, note };
}

function naRow(id: string, label: string, note: string): GateRow {
  return row(id, label, 'n/a', 'n/a', true, false, note);
}

function computeGates(def: AssetDefinition, frames: FrameSource[], baseline: BaselineData | null, selKey: string): GateRow[] {
  const t = thresholdsFor(def.assetId);
  const classProven = t.proven;
  const imgs: Array<RgbaImage | null> = frames.map((f) => (f.error ? null : pixView(f.pix)));
  const valid = imgs.filter((i): i is RgbaImage => i !== null);
  const has8Dirs = def.adapterId === 'combat' || def.adapterId === 'worker8';
  const out: GateRow[] = [];

  // alpha coverage band
  const alpha = valid.map((i) => alphaCoverage(i));
  const alphaMean = meanOf(alpha);
  out.push(row(
    'alpha-coverage', 'alpha coverage',
    `${fmtNum(alphaMean * 100, 1)}%`,
    `${(t.alphaMin * 100).toFixed(0)}–${(t.alphaMax * 100).toFixed(0)}%`,
    alpha.length > 0 && alphaMean >= t.alphaMin && alphaMean <= t.alphaMax,
    classProven,
    alpha.some((v) => Number.isNaN(v)) ? 'some frames empty' : undefined,
  ));

  // connected share
  const connected = valid.map((i) => primaryComponentShare(i));
  const connectedMin = minOf(connected);
  out.push(row(
    'connected-share', 'connected share',
    `${fmtNum(connectedMin * 100, 1)}%`,
    `≥ ${(t.connectedMin * 100).toFixed(0)}%`,
    connected.length > 0 && connectedMin >= t.connectedMin,
    classProven,
  ));

  // pose delta (combat pose0/pose1; worker walk0/walk1)
  if (has8Dirs && valid.length >= 8) {
    const a = imgs[0];
    const b = imgs[8];
    if (a && b) {
      const delta = poseDeltaPercent(a, b);
      out.push(row(
        'pose-delta', 'pose delta',
        `${fmtNum(delta, 1)}%`,
        `${t.poseDeltaMin}–${t.poseDeltaMax}%`,
        delta >= t.poseDeltaMin && delta <= t.poseDeltaMax,
        classProven,
      ));
    }
  } else {
    out.push(naRow('pose-delta', 'pose delta', 'single-cell asset — no pose pair'));
  }

  // N vs E direction delta (meanRgbaDelta, VS-4 oracle)
  if (has8Dirs && imgs[0] && imgs[2]) {
    const delta = meanRgbaDelta(imgs[2], imgs[0]);
    out.push(row(
      'n-vs-e-delta', 'N/E direction delta',
      fmtNum(delta, 1),
      `> ${t.nVsEDeltaMin}`,
      delta > t.nVsEDeltaMin,
      classProven,
    ));
  } else {
    out.push(naRow('n-vs-e-delta', 'N/E direction delta', 'no 8-facing cell set'));
  }

  // silhouette overlap vs sibling combat roles (candidate vs candidate)
  if (def.adapterId === 'combat') {
    const own = imgs[0];
    let worst = 0;
    let worstId = '';
    if (own) {
      for (const other of CATALOG) {
        if (other.assetId === def.assetId || other.adapterId !== 'combat') continue;
        const sibling = getCandidate(other, 'primary');
        const sib = sibling[0] && !sibling[0].error ? pixView(sibling[0].pix) : null;
        if (!sib) continue;
        const iou = silhouetteIou(own, sib);
        if (!Number.isNaN(iou) && iou > worst) {
          worst = iou;
          worstId = other.assetId;
        }
      }
    }
    out.push(row(
      'silhouette-overlap', 'silhouette overlap',
      fmtNum(worst, 3),
      `< ${t.silhouetteOverlapMax}`,
      worst < t.silhouetteOverlapMax,
      classProven,
      worstId ? `vs ${worstId}` : 'no sibling',
    ));
  } else {
    out.push(naRow('silhouette-overlap', 'silhouette overlap', 'non-combat class'));
  }

  // MAG share
  const mag = valid.map((i) => magShare(i));
  const magMean = meanOf(mag);
  out.push(row(
    'mag-share', 'MAG share',
    fmtNum(magMean * 100, 2) + '%',
    `${(t.magShareMin * 100).toFixed(1)}–${(t.magShareMax * 100).toFixed(1)}%`,
    mag.length > 0 && magMean >= t.magShareMin && magMean <= t.magShareMax,
    classProven,
    !classProven && magMean > 0 ? 'advisory band uncalibrated' : undefined,
  ));

  // luminance floor
  const luma = valid.map((i) => averageLuma(i));
  const lumaMean = meanOf(luma);
  out.push(row(
    'luma-floor', 'avg luminance',
    fmtNum(lumaMean, 1),
    `≥ ${t.lumaFloor}`,
    luma.length > 0 && lumaMean >= t.lumaFloor,
    classProven,
  ));

  // bright material share
  const bright = valid.map((i) => brightMaterialShare(i));
  const brightMin = minOf(bright);
  out.push(row(
    'bright-share', 'bright material',
    fmtNum(brightMin * 100, 1) + '%',
    `≥ ${(t.brightShareMin * 100).toFixed(0)}%`,
    bright.length > 0 && brightMin >= t.brightShareMin,
    classProven,
  ));

  // rim layers
  const rims = valid.map((i) => rimLayerShares(i, RIM_COLORS));
  const rimOuter = minOf(rims.map((r) => r.outer));
  const rimInner = minOf(rims.map((r) => r.inner));
  out.push(row(
    'rim-outer', 'rim outer share',
    fmtNum(rimOuter * 100, 1) + '%',
    `≥ ${(t.rimOuterShareMin * 100).toFixed(0)}%`,
    rims.length > 0 && rimOuter >= t.rimOuterShareMin,
    classProven,
  ));
  out.push(row(
    'rim-inner', 'rim inner share',
    fmtNum(rimInner * 100, 1) + '%',
    `≥ ${(t.rimInnerShareMin * 100).toFixed(0)}%`,
    rims.length > 0 && rimInner >= t.rimInnerShareMin,
    classProven,
  ));

  // anatomy bounds by role
  if (def.role === 'guard' || def.role === 'walker') {
    const first = imgs[0];
    const bounds = first ? sourceBounds(first) : null;
    const minW = def.role === 'guard' ? t.guardBoundsMinW : t.walkerBoundsMinW;
    const minH = def.role === 'guard' ? t.guardBoundsMinH : t.walkerBoundsMinH;
    const w = bounds ? bounds.maxX - bounds.minX + 1 : 0;
    const h = bounds ? bounds.maxY - bounds.minY + 1 : 0;
    out.push(row(
      `${def.role}-bounds`, `${def.role} bounds`,
      `${w}×${h}`,
      `≥ ${minW}×${minH}`,
      w >= minW && h >= minH,
      classProven,
    ));
  } else {
    out.push(naRow('anatomy-bounds', 'anatomy bounds', 'no anatomy rule for this role'));
  }

  // diff gates vs the accepted baseline (advisory; informational rows)
  if (baseline) {
    const selCell = baseline.cell(selKey);
    const selFrame = frames.find((f) => f.key === selKey) ?? frames[0];
    if (selCell && selFrame && !selFrame.error) {
      const cand = pixView(selFrame.pix);
      const base = { width: selCell.w, height: selCell.h, data: selCell.d };
      const diffCount = differingPixels(base, cand);
      const union = unionAlpha(base, cand);
      const pct = Number.isNaN(union) || union === 0 ? NaN : (diffCount / union) * 100;
      out.push(row(
        'pixel-diff', 'pixel diff (sel frame)',
        `${fmtNum(pct, 2)}% (${Number.isNaN(diffCount) ? '?' : diffCount} px)`,
        '0%',
        diffCount === 0,
        false,
        'advisory — A/B difference report, not a fail gate',
      ));
      const aBox = sourceBounds(base);
      const bBox = sourceBounds(cand);
      if (aBox && bBox) {
        const delta =
          Math.abs(aBox.maxX - aBox.minX - (bBox.maxX - bBox.minX)) +
          Math.abs(aBox.maxY - aBox.minY - (bBox.maxY - bBox.minY));
        out.push(row(
          'bbox-delta', 'bbox delta (sel frame)',
          `${delta} px`,
          '0 px',
          delta === 0,
          false,
          'advisory — A/B difference report, not a fail gate',
        ));
      } else {
        out.push(naRow('bbox-delta', 'bbox delta (sel frame)', 'no alpha bounds'));
      }
    } else {
      out.push(naRow('pixel-diff', 'pixel diff (sel frame)', selCell ? 'frame error' : 'no baseline cell for this frame'));
    }
  } else {
    out.push(naRow('pixel-diff', 'pixel diff (sel frame)', 'no accepted baseline'));
    out.push(naRow('bbox-delta', 'bbox delta (sel frame)', 'no accepted baseline'));
  }

  return out;
}

function candidateDiffers(def: AssetDefinition, baseline: BaselineData, frames: FrameSource[]): boolean {
  const cols = def.adapterId === 'combat' || def.adapterId === 'worker8' ? 8 : 1;
  const cellW = def.dims.w;
  const cellH = def.dims.h;
  for (let i = 0; i < def.frames.length; i++) {
    const key = def.frames[i];
    const frame = frames[i];
    if (!frame || frame.error) return true;
    const idx = baseline.cellIndex.get(key);
    if (idx === undefined) continue;
    const ox = (idx % cols) * cellW;
    const oy = Math.floor(idx / cols) * cellH;
    if (ox + cellW > baseline.img.width || oy + cellH > baseline.img.height) return true;
    const base = { width: cellW, height: cellH, data: baseline.img.data };
    let differs = false;
    outer: for (let y = 0; y < cellH; y++) {
      const rowOff = (oy + y) * baseline.img.width * 4 + ox * 4;
      const srcOff = y * cellW * 4;
      for (let x = 0; x < cellW * 4; x++) {
        if (baseline.img.data[rowOff + x] !== frame.pix.d[srcOff + x]) {
          differs = true;
          break outer;
        }
      }
    }
    if (differs) return true;
  }
  return false;
}

function computeStatus(def: AssetDefinition, gates: GateRow[], baseline: BaselineData | null, frames: FrameSource[]): StatusResult {
  const partial = frames.some((f) => f.error);
  const provenFail = gates.some((g) => g.proven && !g.pass);
  const differs = baseline !== null && candidateDiffers(def, baseline, frames);
  let chip: ChipText;
  if (partial) chip = 'PARTIAL';
  else if (baseline === null) chip = 'MISSING BASELINE';
  else if (provenFail) chip = 'OBJECTIVE FAIL';
  else if (differs) chip = 'READY FOR REVIEW';
  else chip = 'CURRENT CANDIDATE';
  const s = store.get();
  const previewOverride = s.background !== 'checker' || Math.abs(s.cameraHalfH - 14) > 1e-9;
  return { chip, previewOverride };
}

/** Per-asset status used for rail dots (cheap, cached gates + baseline). */
async function statusFor(def: AssetDefinition): Promise<StatusResult> {
  const frames = getCandidate(def, 'primary');
  const baseline = await loadBaseline(def);
  let gates = gateCache.get(def.assetId);
  if (!gates) {
    gates = computeGates(def, frames, baseline, def.frames[0] ?? '');
    gateCache.set(def.assetId, gates);
  }
  return computeStatus(def, gates, baseline, frames);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function buildLayout(): void {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);

  const boot = document.getElementById('fal-boot');
  if (boot) boot.remove();

  const app = el('div', { id: 'fal-app' });

  // ── top bar ──────────────────────────────────────────────────────────────
  const topbar = el('header', { id: 'fal-topbar' }, [
    el('span', { id: 'fal-title' }, ['FORGE ART LAB']),
    el('span', { id: 'fal-breadcrumb' }),
    (statusChip = el('span', { id: 'fal-status', class: 'chip-status', role: 'status', 'aria-live': 'polite' })),
    (staleBadge = el('span', { id: 'fal-stale', hidden: 'true' })),
    el('span', { class: 'spacer' }),
    el('button', { id: 'fal-btn-roster', 'data-fal-roster': '', 'aria-label': 'Roster board' }, ['roster']),
    el('button', { id: 'fal-btn-context', 'data-fal-context': '', 'aria-label': 'Context rig scene' }, ['context']),
    el('button', { id: 'fal-btn-deeplink', 'aria-label': 'Copy deep link' }, ['copy link']),
    el('button', { id: 'fal-btn-help', 'aria-label': 'Keyboard shortcuts' }, ['?']),
  ]);
  (overrideChip = el('span', { id: 'fal-override', class: 'chip-status', 'data-state': 'override', hidden: 'true' }))
    .textContent = 'PREVIEW OVERRIDE';

  // ── catalog rail ─────────────────────────────────────────────────────────
  const rail = el('nav', { id: 'fal-rail', 'aria-label': 'Asset catalog' }, [
    (searchInput = el('input', {
      id: 'fal-search',
      type: 'search',
      placeholder: 'search assets…  ( / )',
      'aria-label': 'Search assets',
    })),
    (catalogRoot = el('div', { id: 'fal-catalog', 'data-fal-catalog': '' })),
  ]);
  buildCatalog();

  // ── center stage ─────────────────────────────────────────────────────────
  const stage = el('main', { id: 'fal-stage' }, [
    el('div', { id: 'fal-stage-frame' }, [
      (stageBox = el('div', { id: 'fal-stage-box', 'data-mode': 'split' })),
      el('div', { id: 'fal-wipe-row' }, [
        el('span', { class: 'row-label' }, ['wipe']),
        (wipeInput = el('input', {
          type: 'range',
          min: '0',
          max: '100',
          step: '1',
          value: '50',
          'data-fal-wipe': '',
          'aria-label': 'Wipe handle',
          role: 'slider',
          'aria-valuemin': '0',
          'aria-valuemax': '100',
          'aria-valuenow': '50',
        })),
      ]),
    ]),
    (facingRow = el('div', { class: 'ctrl-row', id: 'fal-facing-row' }, [el('span', { class: 'row-label' }, ['facing'])])),
    (poseRow = el('div', { class: 'ctrl-row', id: 'fal-pose-row' }, [el('span', { class: 'row-label' }, ['pose'])])),
    el('div', { class: 'ctrl-row' }, [
      el('span', { class: 'row-label' }, ['frame']),
      el('button', { id: 'fal-frame-minus', 'aria-label': 'Previous frame' }, ['−']),
      (frameReadout = el('span', { id: 'fal-frame-readout', 'data-fal-frame': '0' })),
      el('button', { id: 'fal-frame-plus', 'aria-label': 'Next frame' }, ['+']),
      el('button', { id: 'fal-play', 'data-fal-play': '', 'aria-label': 'Play pose animation' }, ['▶']),
      el('button', { id: 'fal-pause', 'data-fal-pause': '', 'aria-label': 'Pause pose animation' }, ['⏸']),
      el('span', { class: 'row-label', style: 'margin-left:8px' }, ['speed']),
      el('input', {
        id: 'fal-speed', 'data-fal-speed': '', type: 'range', min: '0.25', max: '4', step: '0.25', value: '1',
        'aria-label': 'Playback speed',
      }),
      el('span', { id: 'fal-speed-readout', class: 'mono', style: 'color:#9CA6A5;font-size:11px' }, ['1.00×']),
    ]),
    (passRow = el('div', { class: 'ctrl-row', id: 'fal-pass-row' }, [el('span', { class: 'row-label' }, ['passes'])])),
    el('div', { class: 'ctrl-row' }, [
      (zoomRow = el('div', { class: 'ctrl-row', id: 'fal-zoom-row', style: 'gap:4px' })),
      el('span', { class: 'row-label', style: 'margin-left:10px' }, ['A/B']),
      (abRow = el('div', { class: 'ctrl-row', id: 'fal-ab-row', style: 'gap:4px' })),
      el('span', { class: 'row-label', style: 'margin-left:10px' }, ['bg']),
      (bgRow = el('div', { class: 'ctrl-row', id: 'fal-bg-row', style: 'gap:4px' })),
    ]),
  ]);

  // ── inspector ────────────────────────────────────────────────────────────
  const inspector = el('aside', { id: 'fal-inspector' }, [
    el('h2', {}, ['asset']),
    (metadataDl = el('dl', { class: 'fal-kv' })),
    el('h2', {}, ['objective gates']),
    (baselineBanner = el('div', { id: 'fal-baseline-banner' })),
    (gatesTable = el('table', { id: 'fal-gates' })),
    el('h2', {}, ['metrics']),
    (metricsLine = el('div', { id: 'fal-metrics', 'data-fal-metrics': '' })),
    el('h2', {}, ['failures json']),
    (failuresPre = el('pre', { id: 'fal-failures', 'data-fal-failures': '' })),
    el('div', { class: 'btn-row' }, [
      el('button', { id: 'fal-copy-json', 'data-fal-copy-json': '', 'aria-label': 'Copy failure JSON' }, ['copy failure JSON']),
      el('button', { id: 'fal-proof', 'data-fal-proof': '', 'aria-label': 'Generate proof pack' }, ['proof pack']),
    ]),
  ]);

  // ── bottom strip ─────────────────────────────────────────────────────────
  const strip = el('footer', { id: 'fal-strip' }, [
    el('div', { class: 'line' }, [
      el('span', { class: 'k' }, ['hash']),
      (hashReadout = el('span', { id: 'fal-hash', 'data-fal-hash': '' })),
      el('button', { id: 'fal-sandbox', 'aria-label': 'Toggle sandbox candidate' },
        [sandboxActive ? 'sandbox: on' : 'sandbox: off']),
    ]),
    el('div', { class: 'line' }, [
      el('span', { class: 'k' }, ['log']),
      (logLine = el('div', { id: 'fal-log' })),
    ]),
  ]);

  app.append(topbar, overrideChip, rail, stage, inspector, strip);
  document.body.append(app);

  buildStaticControlRows();

  // Overlays
  document.body.append(buildRosterOverlay(), buildContextOverlay(), buildHelpOverlay());

  // Stage canvases (frozen-canvas discipline: baseline + candidate + pooled diff)
  baselineCanvas = el('canvas', { 'data-fal-canvas': 'baseline', 'aria-label': 'Accepted baseline canvas' });
  candidateCanvas = el('canvas', { 'data-fal-canvas': 'candidate', 'aria-label': 'Current candidate canvas' });
  candidateWrap = el('div', { class: 'zoom-wrap' }, [candidateCanvas]);
  stageBox.append(baselineCanvas, candidateWrap);

  pushEvent('workbench boot');
  if (sandboxActive) pushEvent('sandbox candidate active (?sandbox=1)');
}

function buildCatalog(): void {
  catalogRoot.textContent = '';
  const factions: Array<[string, string]> = [
    ['sunweaver', 'Sunweaver'],
    ['gravemark', 'Gravemark'],
  ];
  for (const [faction, label] of factions) {
    const group = el('div', { 'data-fal-catalog-group': faction });
    group.append(el('div', { class: 'fal-group-title' }, [label]));
    for (const def of CATALOG) {
      if (def.faction !== faction) continue;
      const button = el('button', {
        class: 'fal-asset',
        'data-fal-asset': def.assetId,
        'aria-label': `Asset ${def.label} (stable ID ${def.assetId})`,
      });
      button.append(
        el('span', { class: 'dot' }),
        el('span', { class: 'lbl' }, [def.label]),
        el('span', { class: 'cat' }, [def.category]),
      );
      button.addEventListener('click', () => selectAsset(def.assetId));
      group.append(button);
    }
    catalogRoot.append(group);
  }
}

function buildRosterOverlay(): HTMLElement {
  const panel = el('div', { class: 'panel' }, [
    el('h2', {}, ['ROSTER — production world scale']),
    el('div', { id: 'fal-roster-tools' }, [
      el('label', {}, [
        (rosterUnlabeled = el('input', { type: 'checkbox', 'aria-label': 'Unlabeled roster board' })),
        ' unlabeled',
      ]),
      (rosterScaleNote = el('span', { class: 'mono' })),
    ]),
    (rosterBoard = el('div', { id: 'fal-roster-board' })),
    el('button', { class: 'close', 'aria-label': 'Close roster' }, ['✕']),
  ]);
  const overlay = el('div', { id: 'fal-roster-overlay', class: 'fal-overlay', hidden: 'true' }, [panel]);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeRoster();
  });
  panel.querySelector('.close')?.addEventListener('click', closeRoster);
  rosterUnlabeled.addEventListener('change', () => {
    rosterBoard.classList.toggle('unlabeled', rosterUnlabeled.checked);
    for (const label of rosterBoard.querySelectorAll('.fal-roster-label')) {
      (label as HTMLElement).style.display = rosterUnlabeled.checked ? 'none' : '';
    }
  });
  return overlay;
}

function buildContextOverlay(): HTMLElement {
  const panel = el('div', { class: 'panel' }, [
    el('h2', {}, ['CONTEXT RIG — real GameRenderer (iframe)']),
    (contextScenes = el('div', { id: 'fal-context-scenes' })),
    (contextFrame = el('iframe', {
      id: 'fal-context-frame',
      title: 'Forge Art Lab context rig',
    })),
    el('button', { class: 'close', 'aria-label': 'Close context rig' }, ['✕']),
  ]);
  const overlay = el('div', { id: 'fal-context-overlay', class: 'fal-overlay', hidden: 'true' }, [panel]);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeContext();
  });
  panel.querySelector('.close')?.addEventListener('click', closeContext);
  return overlay;
}

function buildHelpOverlay(): HTMLElement {
  const rows: Array<[string, string]> = [
    ['/', 'focus catalog search'],
    ['[ ]', 'previous / next asset'],
    ['← →', 'step frame (Shift = facing cycle)'],
    ['Space', 'play / pause pose animation'],
    ['1…5', 'toggle passes (silhouette, value, alpha, team, emissive)'],
    ['6', 'toggle diff A/B mode'],
    ['A D', 'move wipe handle (split mode)'],
    ['Tab', 'cycle A/B mode: split → side-by-side → diff'],
    ['Z', 'cycle zoom 1x → 4x → 8x'],
    ['?', 'toggle this overlay'],
    ['Esc', 'close overlay'],
  ];
  const list = el('div', { id: 'fal-help-list' });
  for (const [key, action] of rows) {
    list.append(el('div', {}, [el('kbd', {}, [key]), `  ${action}`]));
  }
  const panel = el('div', { class: 'panel' }, [
    el('h2', {}, ['KEYBOARD']),
    list,
    el('button', { class: 'close', 'aria-label': 'Close shortcuts overlay' }, ['✕']),
  ]);
  const overlay = el('div', { id: 'fal-help-overlay', class: 'fal-overlay', hidden: 'true' }, [panel]);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) helpOpen = false, overlay.hidden = true;
  });
  panel.querySelector('.close')?.addEventListener('click', () => {
    helpOpen = false;
    overlay.hidden = true;
  });
  return overlay;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function makeToggleRow(
  container: HTMLDivElement,
  items: Array<{ value: string; label: string; active: boolean }>,
  onPick: (value: string) => void,
): void {
  container.textContent = '';
  for (const item of items) {
    const button = el('button', {
      'data-fal-facing': item.value,
      'data-active': item.active ? 'true' : 'false',
      'aria-pressed': item.active ? 'true' : 'false',
    }, [item.label]);
    button.addEventListener('click', () => onPick(item.value));
    container.append(button);
  }
}

function wireControls(): void {
  // facing buttons (dir8 compass; mirrored dirs tagged)
  for (let d = 0; d < 8; d++) {
    const button = el('button', {
      class: 'facing-btn',
      'data-fal-facing': String(d),
      'aria-label': `Facing: ${DIR_LABELS[d]}`,
      'aria-pressed': 'false',
    });
    const tag = el('span', {}, [DIR_LABELS[d]]);
    button.append(tag);
    if (MIRRORED_DIRS.has(d)) button.append(el('span', { class: 'mirror' }, [' mirror']));
    button.addEventListener('click', () => store.update({ facing: d }));
    facingRow.append(button);
  }

  // wipe: clip-only while dragging (zero redraw), commit on release
  wipeInput.addEventListener('input', () => {
    const value = Number(wipeInput.value);
    applyWipeClip(value);
    wipeInput.setAttribute('aria-valuenow', String(value));
  });
  wipeInput.addEventListener('change', () => {
    const value = Number(wipeInput.value);
    applyWipeClip(value);
    store.update({ wipePosition: value });
  });

  document.getElementById('fal-frame-minus')?.addEventListener('click', () => stepFrame(-1));
  document.getElementById('fal-frame-plus')?.addEventListener('click', () => stepFrame(1));
  document.getElementById('fal-play')?.addEventListener('click', play);
  document.getElementById('fal-pause')?.addEventListener('click', pause);

  const speed = document.getElementById('fal-speed') as HTMLInputElement;
  speed.addEventListener('input', () => {
    store.update({ speed: Number(speed.value) });
  });

  searchInput.addEventListener('input', () => {
    filterCatalog(searchInput.value.trim().toLowerCase());
  });

  document.getElementById('fal-btn-roster')?.addEventListener('click', openRoster);
  document.getElementById('fal-btn-context')?.addEventListener('click', openContext);
  document.getElementById('fal-btn-help')?.addEventListener('click', () => toggleHelp());
  document.getElementById('fal-btn-deeplink')?.addEventListener('click', copyDeepLink);
  document.getElementById('fal-copy-json')?.addEventListener('click', copyFailureJson);
  document.getElementById('fal-proof')?.addEventListener('click', () => {
    pushEvent('proof is CLI-side: npm run forge:art:proof -- --asset=' + store.get().assetId);
  });
  document.getElementById('fal-sandbox')?.addEventListener('click', toggleSandbox);
}

function filterCatalog(query: string): void {
  for (const group of catalogRoot.querySelectorAll<HTMLElement>('[data-fal-catalog-group]')) {
    let visible = 0;
    for (const button of group.querySelectorAll<HTMLButtonElement>('[data-fal-asset]')) {
      const id = button.dataset.falAsset ?? '';
      const label = button.querySelector('.lbl')?.textContent ?? '';
      const show = query.length === 0 || id.includes(query) || label.toLowerCase().includes(query);
      button.style.display = show ? '' : 'none';
      if (show) visible++;
    }
    group.style.display = visible > 0 ? '' : 'none';
  }
}

let wipeDivider: HTMLDivElement | null = null;

function applyWipeClip(position: number): void {
  const mode = store.get().abMode;
  if (mode !== 'split') {
    candidateWrap.style.clipPath = 'none';
    if (wipeDivider) wipeDivider.hidden = true;
    return;
  }
  const clamped = Math.max(0, Math.min(100, position));
  candidateWrap.style.clipPath = `inset(0 0 0 ${clamped}%)`;
  // Visible split marker: the accepted/candidate seam must be locatable even
  // when both sides are currently identical.
  if (!wipeDivider) {
    wipeDivider = el('div', { id: 'fal-wipe-divider', 'aria-hidden': 'true' });
    stageBox.append(wipeDivider);
  }
  wipeDivider.hidden = false;
  wipeDivider.style.left = `${clamped}%`;
}

// ---------------------------------------------------------------------------
// Store-driven actions
// ---------------------------------------------------------------------------

function selectAsset(assetId: string): void {
  if (!isPublicAssetId(assetId)) return;
  const def = ASSET_BY_ID[assetId];
  store.update({ assetId, pose: 'primary', frame: 0, facing: 0 });
  void loadBaseline(def).then(() => {
    pushEvent(`asset ${assetId} · baseline ${baselineCache.get(assetId) ? 'loaded' : 'missing'}`);
    render();
  });
}

function setFacing(n: number): void {
  store.update({ facing: ((Math.round(n) % 8) + 8) % 8 });
}

function setFrame(n: number): void {
  const def = ASSET_BY_ID[store.get().assetId];
  const rows = groupRows(def, store.get().pose);
  store.update({ frame: Math.max(0, Math.min(rows - 1, Math.round(n))) });
}

function stepFrame(delta: number): void {
  setFrame(store.get().frame + delta);
}

function play(): void {
  store.update({ playing: true });
}

function pause(): void {
  store.update({ playing: false });
}

function togglePass(pass: PassId): void {
  const current = store.get();
  store.update({ passes: { ...current.passes, [pass]: !current.passes[pass] } });
}

function setAbMode(mode: ForgeLabState['abMode']): void {
  store.update({ abMode: mode });
}

function setZoom(zoom: ZoomLevel): void {
  store.update({ zoom });
}

function setWipe(position: number): void {
  const clamped = Math.max(0, Math.min(100, Math.round(position)));
  applyWipeClip(clamped);
  wipeInput.value = String(clamped);
  wipeInput.setAttribute('aria-valuenow', String(clamped));
  store.update({ wipePosition: clamped });
}

function toggleSandbox(): void {
  const url = new URL(window.location.href);
  if (sandboxActive) url.searchParams.delete('sandbox');
  else url.searchParams.set('sandbox', '1');
  window.location.assign(url.toString());
}

function copyDeepLink(): void {
  void navigator.clipboard.writeText(window.location.href).then(
    () => pushEvent('deep link copied'),
    () => pushEvent('deep link copy failed'),
  );
}

function copyFailureJson(): void {
  const text = failuresPre.textContent ?? '';
  if (!text) return;
  void navigator.clipboard.writeText(text).then(
    () => pushEvent('failure JSON copied'),
    () => pushEvent('failure JSON copy failed'),
  );
}

function toggleHelp(): void {
  helpOpen = !helpOpen;
  const overlay = document.getElementById('fal-help-overlay');
  if (overlay) overlay.hidden = !helpOpen;
}

function groupRows(def: AssetDefinition, group: string): number {
  const keys = frameKeyOrder(def.assetId, group);
  const has8 = def.adapterId === 'combat' || def.adapterId === 'worker8';
  const dirs = has8 ? 8 : 1;
  return Math.max(1, Math.ceil(keys.length / dirs));
}

function currentKey(def: AssetDefinition, state: ForgeLabState): { key: string; frame: number; rows: number } {
  const keys = frameKeyOrder(def.assetId, state.pose);
  const has8 = def.adapterId === 'combat' || def.adapterId === 'worker8';
  const dirs = has8 ? 8 : 1;
  const rows = Math.max(1, Math.ceil(keys.length / dirs));
  const frame = Math.max(0, Math.min(rows - 1, state.frame));
  const key = keys.length ? keys[frame * dirs + (has8 ? state.facing : 0)] ?? keys[0] : '';
  return { key, frame, rows };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function composedPass(state: ForgeLabState): (pix: PixelImage) => PixelImage {
  const active = PASS_IDS.filter((id) => state.passes[id]);
  return (pix: PixelImage) => {
    let img = pix;
    for (const id of active) img = applyPass(img, id);
    return img;
  };
}

function render(): void {
  const state = store.get();
  const def = ASSET_BY_ID[state.assetId];
  const { key, frame, rows } = currentKey(def, state);
  selectedFrameKey = key;
  const frames = getCandidate(def, state.pose);
  const baseline = baselineCache.get(def.assetId) ?? null;
  const gates = computeGates(def, frames, baseline, key);
  gateCache.set(def.assetId, gates);
  const passFn = composedPass(state);

  // top bar
  const breadcrumb = document.getElementById('fal-breadcrumb');
  if (breadcrumb) breadcrumb.textContent = `${def.label} · ${def.faction} · ${def.category} · ${def.assetId}`;
  const { chip, previewOverride } = computeStatus(def, gates, baseline, frames);
  const stateAttr: Record<string, string> = {
    missing: 'missing',
    PARTIAL: 'partial',
    'OBJECTIVE FAIL': 'fail',
    'READY FOR REVIEW': 'review',
    'CURRENT CANDIDATE': 'current',
    'PREVIEW OVERRIDE': 'override',
  };
  statusChip.textContent = chip;
  statusChip.dataset.state = stateAttr[chip] ?? 'missing';
  statusChip.dataset.falStatus = chip;
  overrideChip.hidden = !previewOverride;

  // transport
  updateTransport(def, rows, state);

  // stage
  paintStage(def, frames, baseline, key, passFn, state);

  // inspector
  renderInspector(def, frames, baseline, gates, state);

  // strip
  hashReadout.textContent = canonicalHash(state);

  // rail dots + selection
  updateRail(def, state);

  // probe
  publishProbe(def, state, key);

  renderedOnce = true;
  document.body.dataset.falReady = 'true';
  document.body.dataset.ready = 'true';
}

let lastPoseAsset = '';

function buildStaticControlRows(): void {
  // Pass toggles (built once; toggled by updateTransport — A5 button-loop pattern)
  passRow.append(el('span', { class: 'row-label' }, ['passes']));
  for (const id of PASS_IDS) {
    const button = el('button', {
      'data-fal-pass': id,
      'aria-pressed': 'false',
      'aria-label': `Pass toggle: ${id}`,
    }, [id]);
    button.addEventListener('click', () => togglePass(id));
    passRow.append(button);
  }
  // Zoom
  for (const level of ['1x', '4x', '8x'] as const) {
    const button = el('button', {
      'data-fal-zoom': level,
      'aria-pressed': 'false',
      'aria-label': `Zoom: ${level}`,
    }, [level]);
    button.addEventListener('click', () => setZoom(level));
    zoomRow.append(button);
  }
  // A/B mode
  for (const mode of ['split', 'side-by-side', 'diff'] as const) {
    const button = el('button', {
      'data-fal-abmode': mode,
      'aria-pressed': 'false',
      'aria-label': `A/B mode: ${mode}`,
    }, [mode]);
    button.addEventListener('click', () => setAbMode(mode));
    abRow.append(button);
  }
  // Background
  for (const bg of ['checker', 'ink', 'slate'] as const) {
    const button = el('button', {
      'data-fal-bg': bg,
      'aria-pressed': 'false',
      'aria-label': `Stage background: ${bg}`,
    }, [bg]);
    button.addEventListener('click', () => store.update({ background: bg }));
    bgRow.append(button);
  }
}

function updateTransport(def: AssetDefinition, rows: number, state: ForgeLabState): void {
  for (let d = 0; d < 8; d++) {
    const button = facingRow.querySelector<HTMLButtonElement>(`[data-fal-facing="${d}"]`);
    if (!button) continue;
    const active = d === state.facing;
    button.dataset.active = active ? 'true' : 'false';
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.setAttribute('aria-label', `Facing: ${DIR_LABELS[d]}${active ? ' (active)' : ''}`);
  }
  const disabled = rows <= 1;
  const minus = document.getElementById('fal-frame-minus') as HTMLButtonElement;
  const plus = document.getElementById('fal-frame-plus') as HTMLButtonElement;
  minus.disabled = disabled;
  plus.disabled = disabled;
  frameReadout.textContent = `${state.frame}/${rows - 1}`;
  frameReadout.dataset.falFrame = String(state.frame);

  // pose buttons: rebuilt only when the asset's group set changes
  if (lastPoseAsset !== def.assetId) {
    lastPoseAsset = def.assetId;
    poseRow.textContent = '';
    poseRow.append(el('span', { class: 'row-label' }, ['pose']));
    const groups: string[] = ['primary'];
    if (def.groups) groups.push(...Object.keys(def.groups));
    for (const group of groups) {
      const button = el('button', {
        'data-fal-pose': group,
        'aria-pressed': 'false',
      }, [group]);
      button.addEventListener('click', () => store.update({ pose: group, frame: 0 }));
      poseRow.append(button);
    }
  }
  for (const group of ['primary', ...(def.groups ? Object.keys(def.groups) : [])]) {
    const button = poseRow.querySelector<HTMLButtonElement>(`[data-fal-pose="${group}"]`);
    if (!button) continue;
    const active = state.pose === group;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  for (const id of PASS_IDS) {
    const button = passRow.querySelector<HTMLButtonElement>(`[data-fal-pass="${id}"]`);
    if (!button) continue;
    const active = state.passes[id];
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
  for (const level of ['1x', '4x', '8x'] as const) {
    const button = zoomRow.querySelector<HTMLButtonElement>(`[data-fal-zoom="${level}"]`);
    if (!button) continue;
    const active = state.zoom === level;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
  for (const mode of ['split', 'side-by-side', 'diff'] as const) {
    const button = abRow.querySelector<HTMLButtonElement>(`[data-fal-abmode="${mode}"]`);
    if (!button) continue;
    const active = state.abMode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
  for (const bg of ['checker', 'ink', 'slate'] as const) {
    const button = bgRow.querySelector<HTMLButtonElement>(`[data-fal-bg="${bg}"]`);
    if (!button) continue;
    const active = state.background === bg;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  const speed = document.getElementById('fal-speed') as HTMLInputElement;
  speed.value = String(state.speed);
  const readout = document.getElementById('fal-speed-readout');
  if (readout) readout.textContent = `${state.speed.toFixed(2)}×`;
}

function paintStage(
  def: AssetDefinition,
  frames: FrameSource[],
  baseline: BaselineData | null,
  key: string,
  passFn: (pix: PixelImage) => PixelImage,
  state: ForgeLabState,
): void {
  const cw = def.dims.w;
  const ch = def.dims.h;
  const fit = Math.max(1, Math.min(6, Math.min(STAGE_MAX / cw, STAGE_MAX / ch)));
  const backingW = Math.round(cw * fit);
  const backingH = Math.round(ch * fit);
  const zoomFactor = state.zoom === '1x' ? 1 : state.zoom === '4x' ? 4 : 8;

  for (const canvas of [baselineCanvas, candidateCanvas]) {
    if (canvas.width !== backingW) canvas.width = backingW;
    if (canvas.height !== backingH) canvas.height = backingH;
  }

  const frame = frames.find((f) => f.key === key) ?? frames[0];
  const candidatePix: PixelImage | null = frame && !frame.error ? frame.pix : null;

  const bctx = baselineCanvas.getContext('2d');
  const cctx = candidateCanvas.getContext('2d');
  if (bctx && cctx) {
    bctx.imageSmoothingEnabled = false;
    cctx.imageSmoothingEnabled = false;
    const baseCell = baseline ? baseline.cell(key) : null;
    if (baseCell) {
      drawCellTo(bctx, passFn(baseCell), 0, 0, fit, { background: state.background });
    } else {
      drawCellTo(bctx, { w: cw, h: ch, d: new Uint8ClampedArray(cw * ch * 4) }, 0, 0, fit, {
        background: state.background,
      });
    }
    if (candidatePix) {
      drawCellTo(cctx, passFn(candidatePix), 0, 0, fit, { background: state.background });
    } else {
      drawCellTo(cctx, { w: cw, h: ch, d: new Uint8ClampedArray(cw * ch * 4) }, 0, 0, fit, {
        background: state.background,
      });
    }
  }

  // mode-dependent stage layout
  stageBox.dataset.mode = state.abMode;
  const gap = 12;
  const diffMode = state.abMode === 'diff';
  const sideMode = state.abMode === 'side-by-side';
  const boxW = sideMode ? backingW * 2 + gap : backingW;
  stageBox.style.width = `${boxW}px`;
  stageBox.style.height = `${backingH}px`;
  baselineCanvas.style.left = '0px';
  baselineCanvas.style.top = '0px';
  if (sideMode) {
    candidateWrap.style.left = `${backingW + gap}px`;
    candidateWrap.style.top = '0px';
    candidateWrap.style.clipPath = 'none';
  } else {
    candidateWrap.style.left = '0px';
    candidateWrap.style.top = '0px';
    applyWipeClip(state.wipePosition);
  }
  const transform = `scale(${zoomFactor})`;
  candidateWrap.style.transform = transform;
  baselineCanvas.style.transform = transform;
  baselineCanvas.style.transformOrigin = 'top left';
  candidateWrap.style.transformOrigin = 'top left';

  // diff canvas: pooled; present in DOM only in diff mode (canvas count rule)
  if (diffMode) {
    if (!diffCanvas) diffCanvas = el('canvas', { id: 'fal-diff-canvas', 'data-fal-canvas': 'diff', 'aria-label': 'Difference overlay canvas' });
    if (!diffCanvas.isConnected) stageBox.append(diffCanvas);
    diffCanvas.width = backingW;
    diffCanvas.height = backingH;
    diffCanvas.style.left = '0px';
    diffCanvas.style.top = '0px';
    diffCanvas.style.transform = transform;
    diffCanvas.style.transformOrigin = 'top left';
    const dctx = diffCanvas.getContext('2d');
    if (dctx) {
      dctx.imageSmoothingEnabled = false;
      const baseCell = baseline ? baseline.cell(key) : null;
      if (baseCell && candidatePix) {
        diffImages(dctx, baseCell, candidatePix, 0, 0, fit, { background: state.background });
      } else {
        drawCellTo(dctx, { w: cw, h: ch, d: new Uint8ClampedArray(cw * ch * 4) }, 0, 0, fit, {
          background: state.background,
        });
      }
    }
  } else if (diffCanvas && diffCanvas.isConnected) {
    diffCanvas.remove();
  }

  // wipe row visibility: split only
  const wipeRow = document.getElementById('fal-wipe-row');
  if (wipeRow) wipeRow.style.display = state.abMode === 'split' ? 'flex' : 'none';
}

function renderInspector(
  def: AssetDefinition,
  frames: FrameSource[],
  baseline: BaselineData | null,
  gates: GateRow[],
  state: ForgeLabState,
): void {
  metadataDl.textContent = '';
  const meta: Array<[string, string]> = [
    ['label', def.label],
    ['stable id', def.assetId],
    ['faction', def.faction],
    ['category', def.category],
    ['role', def.role],
    ['adapter', def.adapterId],
    ['dims', `${def.dims.w}×${def.dims.h}`],
    ['frames', `${def.frames.length}${def.groups ? ` (+${Object.keys(def.groups).join(',')})` : ''}`],
    ['worldScale', `${def.worldScale.x} × ${def.worldScale.y}`],
    ['anchor', `${def.anchor.x}, ${def.anchor.y}`],
    ['runtime region', def.runtimeMapping],
    ['thresholds', def.thresholdsKey],
    ['baseline revision', baseline?.revision ?? '—'],
  ];
  for (const [k, v] of meta) {
    metadataDl.append(el('dt', {}, [k]), el('dd', {}, [v]));
  }

  gatesTable.textContent = '';
  if (baseline === null) {
    baselineBanner.textContent = 'MISSING BASELINE — no accepted baseline for this asset; gates skipped.';
    gatesTable.append(el('tr', {}, [el('td', { colspan: '4' }, ['(gates skipped — compare blocked)'])]));
  } else {
    baselineBanner.textContent = '';
    const head = el('tr', {}, [
      el('th', {}, ['gate']),
      el('th', {}, ['value']),
      el('th', {}, ['threshold']),
      el('th', {}, ['verdict']),
    ]);
    gatesTable.append(head);
    for (const g of gates) {
      const verdict = !g.pass ? (g.proven ? 'fail' : 'warn') : 'pass';
      const tr = el('tr', { 'data-verdict': verdict });
      tr.append(
        el('td', {}, [g.label]),
        el('td', { class: 'v' }, [g.value]),
        el('td', { class: 'v' }, [g.threshold]),
        el('td', { class: 'verdict' }, [!g.pass ? (g.proven ? 'FAIL' : 'WARN') : 'PASS']),
      );
      gatesTable.append(tr);
      if (g.note) {
        gatesTable.append(el('tr', { 'data-verdict': verdict }, [
          el('td', { class: 'note', colspan: '4' }, [g.note]),
        ]));
      }
    }
  }

  // metrics line (selected frame)
  const frame = frames.find((f) => f.key === selectedFrameKey) ?? frames[0];
  let metrics: string;
  if (frame && !frame.error) {
    const img = pixView(frame.pix);
    const coverage = alphaCoverage(img);
    const connected = primaryComponentShare(img);
    const luma = averageLuma(img);
    const bright = brightMaterialShare(img);
    const mag = magShare(img);
    const baseCell = baseline ? baseline.cell(selectedFrameKey) : null;
    let diffText = '—';
    if (baseCell) {
      const diffCount = differingPixels({ width: baseCell.w, height: baseCell.h, data: baseCell.d }, img);
      diffText = `${diffCount}px`;
    }
    metrics = `${frames.length} cells · alpha ${fmtNum(coverage * 100, 1)}% · conn ${fmtNum(connected * 100, 1)}% · ` +
      `luma ${fmtNum(luma, 1)} · bright ${fmtNum(bright * 100, 1)}% · mag ${fmtNum(mag * 100, 2)}% · diff ${diffText}`;
  } else {
    metrics = `${frames.length} cells · (candidate frame error${frame?.error ? `: ${frame.error}` : ''})`;
  }
  metricsLine.textContent = metrics;

  // failures JSON
  const failureJson = buildFailureJson(def, gates, baseline, state);
  failuresPre.textContent = JSON.stringify(failureJson, null, 2);
}

function buildFailureJson(
  def: AssetDefinition,
  gates: GateRow[],
  baseline: BaselineData | null,
  state: ForgeLabState,
): Record<string, unknown> {
  const { chip } = computeStatus(def, gates, baseline, getCandidate(def, state.pose));
  return {
    assetId: def.assetId,
    status: chip,
    generatedAt: new Date().toISOString(),
    fingerprint: {
      adapter: def.adapterId,
      baselineSha256: lastBaselineSha ?? null,
      candidateSha256: lastCandidateSha ?? null,
    },
    gates: gates.map((g) => ({ id: g.id, pass: g.pass, value: g.value, threshold: g.threshold, proven: g.proven })),
    contextVerdicts: [],
  };
}

function updateRail(def: AssetDefinition, state: ForgeLabState): void {
  for (const group of catalogRoot.querySelectorAll<HTMLElement>('[data-fal-catalog-group]')) {
    for (const button of group.querySelectorAll<HTMLButtonElement>('[data-fal-asset]')) {
      const id = button.dataset.falAsset ?? '';
      button.classList.toggle('active', id === state.assetId);
      const dot = button.querySelector('.dot');
      if (dot) {
        const known = railStatus.get(id);
        if (known) dot.setAttribute('data-state', stateAttrFor(known));
      }
      const buttonDef = ASSET_BY_ID[id];
      const buttonLabel = buttonDef?.label ?? id;
      if (id === def.assetId) button.setAttribute('aria-label', `Asset ${buttonLabel} (stable ID ${id}) (selected)`);
      else button.setAttribute('aria-label', `Asset ${buttonLabel} (stable ID ${id})`);
    }
  }
}

const stateAttrFor = (chip: ChipText): string =>
  chip === 'PARTIAL' ? 'partial'
    : chip === 'OBJECTIVE FAIL' ? 'fail'
      : chip === 'READY FOR REVIEW' ? 'review'
        : chip === 'CURRENT CANDIDATE' ? 'current'
          : chip === 'PREVIEW OVERRIDE' ? 'override'
            : 'missing';

const railStatus = new Map<string, ChipText>();

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

let lastTick = performance.now();
let accumulator = 0;

function tick(now: number): void {
  const state = store.get();
  if (state.playing) {
    accumulator += now - lastTick;
    const stepMs = STEP_MS / state.speed;
    if (accumulator >= stepMs) {
      accumulator = 0;
      const def = ASSET_BY_ID[state.assetId];
      const { frame, rows } = currentKey(def, state);
      store.update({ frame: (frame + 1) % rows });
    }
  }
  lastTick = now;
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------
// Roster overlay
// ---------------------------------------------------------------------------

async function composeRoster(): Promise<void> {
  rosterBoard.textContent = '';
  const state = store.get();
  const pxPerWorldUnit = 1024 / (2 * state.cameraHalfH);
  rosterScaleNote.textContent =
    `1 world unit = ${pxPerWorldUnit.toFixed(1)}px @ halfH ${state.cameraHalfH} · rows at worldScale ratio (x×${pxPerWorldUnit.toFixed(0)}, y×${pxPerWorldUnit.toFixed(0)})`;
  const rows: Array<Promise<void>> = [];
  for (const def of CATALOG) {
    rows.push(
      (async () => {
        const frames = getCandidate(def, 'primary');
        const cols = def.adapterId === 'combat' || def.adapterId === 'worker8' ? 8 : 1;
        const cellW = Math.max(1, Math.round(def.worldScale.x * pxPerWorldUnit));
        const cellH = Math.max(1, Math.round(def.worldScale.y * pxPerWorldUnit));
        const sheetRows = Math.max(1, Math.ceil(frames.length / cols));
        const canvas = document.createElement('canvas');
        canvas.width = cols * cellW + cols + 1;
        canvas.height = sheetRows * cellH + sheetRows + 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#0B0A12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        frames.forEach((frame, i) => {
          const cx = (i % cols) * (cellW + 1) + 1;
          const cy = Math.floor(i / cols) * (cellH + 1) + 1;
          if (frame.error) return;
          drawCellTo(ctx, frame.pix, cx, cy, 1, { drawW: cellW, drawH: cellH, background: 'checker' });
        });
        const label = el('div', { class: 'fal-roster-label' },
          [`${def.label} · ${def.faction} · ${def.assetId} · ${def.dims.w}×${def.dims.h} · ${cellW}×${cellH}px/cell`]);
        const rowEl = el('div', { class: 'fal-roster-row' }, [label, canvas]);
        if (rosterUnlabeled.checked) label.style.display = 'none';
        rosterBoard.append(rowEl);
      })(),
    );
  }
  await Promise.all(rows);
}

function openRoster(): void {
  rosterOpen = true;
  const overlay = document.getElementById('fal-roster-overlay');
  if (!overlay) return;
  overlay.hidden = false;
  if (rosterDirty) {
    rosterDirty = false;
    rosterBoard.textContent = 'composing…';
    void composeRoster().then(() => pushEvent('roster composed'));
  }
}

function closeRoster(): void {
  rosterOpen = false;
  const overlay = document.getElementById('fal-roster-overlay');
  if (overlay) overlay.hidden = true;
}

// ---------------------------------------------------------------------------
// Context rig overlay
// ---------------------------------------------------------------------------

function suggestedScene(def: AssetDefinition): string {
  return def.contextFixtures[0] ?? 'quiet-helios';
}

function openContext(): void {
  contextOpen = true;
  const overlay = document.getElementById('fal-context-overlay');
  if (!overlay) return;
  overlay.hidden = false;
  const def = ASSET_BY_ID[store.get().assetId];
  const scene = suggestedScene(def);
  contextScenes.textContent = '';
  for (const name of def.contextFixtures) {
    const button = el('button', { 'data-fal-context-scene': name }, [name]);
    button.classList.toggle('active', name === scene);
    button.addEventListener('click', () => {
      for (const other of contextScenes.querySelectorAll<HTMLButtonElement>('[data-fal-context-scene]')) {
        other.classList.toggle('active', other === button);
      }
      stageRigScene(name);
    });
    contextScenes.append(button);
  }
  // iframe keeps the single WebGL context inside the rig page (A4 flags readonly)
  contextFrame.src = `./rig.html?mesh=0&combat=1&scene=${encodeURIComponent(scene)}`;
  contextFrame.onload = () => {
    stageRigScene(scene);
  };
  pushEvent(`context rig opened · scene ${scene}`);
}

function stageRigScene(name: string): void {
  try {
    const win = contextFrame.contentWindow as (Window & { __FORGE_ART_TOOL__?: { show?: (n: string) => unknown } }) | null;
    if (win && typeof win.__FORGE_ART_TOOL__?.show === 'function') {
      void win.__FORGE_ART_TOOL__.show(name);
    }
  } catch {
    // cross-origin or not yet ready — the rig defaults to quiet-helios itself
  }
}

function closeContext(): void {
  contextOpen = false;
  const overlay = document.getElementById('fal-context-overlay');
  if (overlay) overlay.hidden = true;
}

// ---------------------------------------------------------------------------
// Event log
// ---------------------------------------------------------------------------

function pushEvent(text: string): void {
  lastEvents.unshift({ time: fmtTime(new Date()), text });
  lastEvents = lastEvents.slice(0, EVENT_LOG_LEN);
  if (logLine) {
    logLine.textContent = '';
    for (const event of lastEvents) {
      logLine.append(el('span', {}, [event.time]), ' ', el('b', {}, [event.text]), '  ·  ');
    }
  }
}

// ---------------------------------------------------------------------------
// Keyboard (A5 §1.6 amended)
// ---------------------------------------------------------------------------

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function cycleAbMode(mode: ForgeLabState['abMode']): ForgeLabState['abMode'] {
  return mode === 'split' ? 'side-by-side' : mode === 'side-by-side' ? 'diff' : 'split';
}

function cycleZoom(zoom: ZoomLevel): ZoomLevel {
  return zoom === '1x' ? '4x' : zoom === '4x' ? '8x' : '1x';
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (helpOpen) toggleHelp();
    else if (rosterOpen) closeRoster();
    else if (contextOpen) closeContext();
    return;
  }
  if (event.key === '?' && !isTypingTarget(event.target)) {
    event.preventDefault();
    toggleHelp();
    return;
  }
  if (isTypingTarget(event.target)) return;

  const state = store.get();
  const def = ASSET_BY_ID[state.assetId];
  switch (event.key) {
    case '/': {
      event.preventDefault();
      searchInput.focus();
      break;
    }
    case '[': {
      const index = CATALOG.findIndex((a) => a.assetId === state.assetId);
      const next = CATALOG[(index - 1 + CATALOG.length) % CATALOG.length];
      selectAsset(next.assetId);
      break;
    }
    case ']': {
      const index = CATALOG.findIndex((a) => a.assetId === state.assetId);
      const next = CATALOG[(index + 1) % CATALOG.length];
      selectAsset(next.assetId);
      break;
    }
    case 'ArrowLeft': {
      event.preventDefault();
      if (event.shiftKey) store.update({ facing: (state.facing + 7) % 8 });
      else stepFrame(-1);
      break;
    }
    case 'ArrowRight': {
      event.preventDefault();
      if (event.shiftKey) store.update({ facing: (state.facing + 1) % 8 });
      else stepFrame(1);
      break;
    }
    case ' ': {
      event.preventDefault();
      store.update({ playing: !state.playing });
      break;
    }
    case '1': case '2': case '3': case '4': case '5': {
      event.preventDefault();
      togglePass(PASS_IDS[Number(event.key) - 1]);
      break;
    }
    case '6': {
      event.preventDefault();
      store.update({ abMode: state.abMode === 'diff' ? 'split' : 'diff' });
      break;
    }
    case 'a': case 'A': {
      event.preventDefault();
      if (state.abMode === 'split') setWipe(state.wipePosition - 5);
      break;
    }
    case 'd': case 'D': {
      event.preventDefault();
      if (state.abMode === 'split') setWipe(state.wipePosition + 5);
      break;
    }
    case 'Tab': {
      event.preventDefault();
      store.update({ abMode: cycleAbMode(state.abMode) });
      break;
    }
    case 'z': case 'Z': {
      event.preventDefault();
      store.update({ zoom: cycleZoom(state.zoom) });
      break;
    }
    default:
      break;
  }
  void def;
}

// ---------------------------------------------------------------------------
// QA probe
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __FORGE_ART_QA__?: unknown;
  }
}

function patchGlCounter(): void {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    contextId: string,
    ...args: unknown[]
  ): RenderingContext | null {
    if (typeof contextId === 'string' && contextId.startsWith('webgl')) glContexts++;
    return original.apply(this, [contextId, ...args] as never);
  } as typeof original;
}

function publishProbe(def: AssetDefinition, state: ForgeLabState, key: string): void {
  const frames = getCandidate(def, state.pose);
  const baseline = baselineCache.get(def.assetId) ?? null;
  const cols = def.adapterId === 'combat' || def.adapterId === 'worker8' ? 8 : 1;
  const candidateSheet = sheetBytes(
    getCandidate(def, 'primary').filter((f) => !f.error).map((f) => f.pix),
    cols,
  );
  lastCandidateSha = sha256Bytes(candidateSheet.data);
  lastBaselineSha = baseline ? baseline.manifestSha256 : undefined;
  window.__FORGE_ART_QA__ = Object.freeze({
    version: 'fal-1',
    ready: renderedOnce,
    state: store.snapshot(),
    selection: { assetId: def.assetId, facing: state.facing, pose: state.pose, frame: state.frame, key },
    gl: { contexts: glContexts },
    catalog: { entries: CATALOG.map((a) => ({ id: a.assetId, label: a.label, faction: a.faction, category: a.category })) },
    ab: {
      baselineSha256: lastBaselineSha,
      candidateSha256: lastCandidateSha,
    },
    errors: [...errors],
  });
}

// ---------------------------------------------------------------------------
// HMR + boot
// ---------------------------------------------------------------------------

function wireHmr(): void {
  window.addEventListener('vite:afterUpdate' as keyof WindowEventMap, () => {
    invalidateCandidates();
    const def = ASSET_BY_ID[store.get().assetId];
    void loadBaseline(def).then(() => {
      pushEvent('candidate HMR · metrics re-ran');
      render();
    });
  });
}

function wireErrors(): void {
  window.addEventListener('error', (event) => {
    errors.push(`error: ${event.message}`);
    if (errors.length > 20) errors.shift();
  });
  window.addEventListener('unhandledrejection', (event) => {
    errors.push(`unhandled rejection: ${String(event.reason)}`);
    if (errors.length > 20) errors.shift();
  });
}

/** Async precompute of rail statuses for every catalog asset (chunked). */
async function warmRailStatuses(): Promise<void> {
  for (const def of CATALOG) {
    try {
      const status = await statusFor(def);
      railStatus.set(def.assetId, status.chip);
    } catch {
      railStatus.set(def.assetId, 'MISSING BASELINE');
    }
    const dot = catalogRoot.querySelector<HTMLElement>(`[data-fal-asset="${def.assetId}"] .dot`);
    if (dot) dot.setAttribute('data-state', stateAttrFor(railStatus.get(def.assetId) ?? 'MISSING BASELINE'));
    // let the browser breathe between heavy assets
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  render();
}

export function boot(): void {
  patchGlCounter();
  wireErrors();
  buildLayout();
  wireControls();
  wireKeyboard();
  wireHmr();

  const def = ASSET_BY_ID[store.get().assetId];
  // clamp initial frame to the asset's group rows
  const { frame } = currentKey(def, store.get());
  if (frame !== store.get().frame) store.update({ frame });

  store.subscribe(() => render());
  void loadBaseline(def).then(() => {
    pushEvent(`baseline ${baselineCache.get(def.assetId) ? 'loaded' : 'missing'} for ${def.assetId}`);
    render();
  });
  void warmRailStatuses();

  // __FORGE_ART_TOOL__ is declared (as ForgeRigApi) by context-rig.ts's global
  // augmentation on the rig page; defineProperty keeps both pages type-consistent.
  Object.defineProperty(window, '__FORGE_ART_TOOL__', {
    value: Object.freeze({
      selectAsset,
      setFacing,
      setFrame,
      play,
      pause,
      togglePass,
      setAbMode,
      setZoom,
      setWipe,
      openRoster,
      closeRoster,
    }),
    configurable: true,
  });

  requestAnimationFrame(tick);
}

function wireKeyboard(): void {
  window.addEventListener('keydown', onKeyDown);
}

boot();
