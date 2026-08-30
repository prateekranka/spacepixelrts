/**
 * Forge Art Lab v1 — source adapters (docs/FORGE_ART_LAB.md §4).
 *
 * Adapters call ONLY exported pure painters from src/sprites.ts. A partial candidate
 * is captured per-frame ({key, pix, error?}) — the tool never crashes mid-run.
 * Legacy kind numbers / civ ids appear only as numeric adapter inputs and in the
 * internal combat-row table, never in rendered text, DOM ids, probe JSON, or
 * manifests' public fields.
 */
import { Kind } from '../../../src/engine';
import type { Civ } from '../../../src/engine';
import {
  Pix,
  WORKER_ACTION_BASE,
  drawBuildingSprite,
  drawCombatSprite,
  drawHelionAction8Dir,
  drawScoutStripCell,
  drawWorker8Dir,
} from '../../../src/sprites';
import type { Rgba } from '../../../src/sprites';
import {
  actionFrameKeys,
  combatFrameKeys,
  workerFrameKeys,
  type AssetDefinition,
  type FrameGroup,
} from './registry';
import { ASSET_BY_ID } from './registry';
import { frameKeyOrder } from './baseline-schema';

/** One produced cell. `error` set (with a blank pix) when the painter threw. */
export type FrameSource = { key: string; pix: Pix; error?: string };

/** Civ index -> Civ name (internal; voidmarked never reachable from the catalog). */
const CIVS: readonly Civ[] = ['vespari', 'aurion', 'voidmarked'];

/** Combat strip row per asset: lumen=0, solar=1, rift=2, burden=3. */
const COMBAT_ROW: Readonly<Record<string, number>> = {
  'sunweaver-lumen-guard': 0,
  'sunweaver-solar-strider': 1,
  'gravemark-rift-guard': 2,
  'gravemark-burden-walker': 3,
};

function combatRowFor(assetId: string): number {
  const row = COMBAT_ROW[assetId];
  if (row === undefined) throw new Error(`no combat row mapping for "${assetId}"`);
  return row;
}

/** Wrap a single paint call: capture errors as {key, pix (blank), error}. */
function capture(key: string, w: number, h: number, paint: () => Pix): FrameSource {
  try {
    return { key, pix: paint() };
  } catch (err) {
    return {
      key,
      pix: Pix.alloc(w, h),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function paintFrame(def: AssetDefinition, key: string, group: string): Pix {
  switch (def.adapterId) {
    case 'combat': {
      const m = /^dir(\d)-pose([01])$/.exec(key);
      if (!m) throw new Error(`bad combat frame key "${key}"`);
      return drawCombatSprite(combatRowFor(def.assetId), Number(m[1]), Number(m[2]));
    }
    case 'worker8': {
      if (group === 'actions') {
        const m = /^act(\d)-dir(\d)$/.exec(key);
        if (!m) throw new Error(`bad worker action frame key "${key}"`);
        return drawHelionAction8Dir(Number(m[2]), WORKER_ACTION_BASE + Number(m[1]));
      }
      const m = /^dir(\d)-walk([01])$/.exec(key);
      if (!m) throw new Error(`bad worker frame key "${key}"`);
      return drawWorker8Dir(def.legacyCiv, Number(m[1]), Number(m[2]));
    }
    case 'scout': {
      if (key !== 'hd') throw new Error(`bad scout frame key "${key}"`);
      return drawScoutStripCell(def.legacyCiv * 7);
    }
    case 'building': {
      if (key !== 'iso') throw new Error(`bad building frame key "${key}"`);
      return drawBuildingSprite(def.legacyKind as Kind, CIVS[def.legacyCiv]);
    }
    default:
      throw new Error(`adapter "${def.adapterId}" not implemented`);
  }
}

/**
 * Render one frame group of an asset: 'primary' (default) or a named group
 * ('actions' on sunweaver-worker). Per-frame error capture; never throws for
 * paint failures. Throws only for unknown assetIds.
 */
export function getFrames(assetId: string, group: FrameGroup = 'primary'): FrameSource[] {
  const def = ASSET_BY_ID[assetId];
  if (!def) throw new Error(`getFrames: unknown assetId "${assetId}"`);
  const keys = frameKeyOrder(assetId, group);
  return keys.map((key) => capture(key, def.dims.w, def.dims.h, () => paintFrame(def, key, group)));
}

// ── §4 source adapters (exported surface; row/civ/kind args are numeric internals) ──

/** combatRow(row): 16 cells via drawCombatSprite(row, dir, pose); row 0..3. */
export function combatRow(row: number): FrameSource[] {
  const keys = combatFrameKeys();
  return keys.map((key) => capture(key, 64, 64, () => {
    const m = /^dir(\d)-pose([01])$/.exec(key);
    if (!m) throw new Error(`bad combat frame key "${key}"`);
    return drawCombatSprite(row, Number(m[1]), Number(m[2]));
  }));
}

/** worker8(civIndex): 16 cells via drawWorker8Dir(civ, dir, walk); civ 0=vespari 1=aurion. */
export function worker8(civIndex: number): FrameSource[] {
  const keys = workerFrameKeys();
  return keys.map((key) => capture(key, 32, 48, () => {
    const m = /^dir(\d)-walk([01])$/.exec(key);
    if (!m) throw new Error(`bad worker frame key "${key}"`);
    return drawWorker8Dir(civIndex, Number(m[1]), Number(m[2]));
  }));
}

/**
 * Sunweaver worker action group: 32 cells (act{a}-dir{d}, a=0..3, d=0..7) via
 * drawHelionAction8Dir(dir, WORKER_ACTION_BASE + a). Aurora (civ 1) workers have
 * no action rows in production; returns [] for any civIndex other than 0.
 */
export function workerActions(civIndex: number): FrameSource[] {
  if (civIndex !== 0) return [];
  const keys = actionFrameKeys();
  return keys.map((key) => capture(key, 32, 48, () => {
    const m = /^act(\d)-dir(\d)$/.exec(key);
    if (!m) throw new Error(`bad worker action frame key "${key}"`);
    return drawHelionAction8Dir(Number(m[2]), WORKER_ACTION_BASE + Number(m[1]));
  }));
}

/** scoutHd(civIndex): 1 cell (128px) — strip col civ*7: col 0 = Helion HD, col 7 = x4 upscale. */
export function scoutHd(civIndex: number): FrameSource[] {
  return [
    capture('hd', 128, 128, () => drawScoutStripCell(civIndex * 7)),
  ];
}

/** building(kind, civ?): 1 iso cell via drawBuildingSprite(kind, civ); civ defaults to vespari. */
export function building(kind: number, civ: Civ = 'vespari'): FrameSource[] {
  const w = kind === Kind.Hall ? 64 : 32;
  const h = w;
  return [
    capture('iso', w, h, () => drawBuildingSprite(kind as Kind, civ)),
  ];
}

// ── Sandbox candidate (§17) ───────────────────────────────────────────────────
// Deterministic visible transform for ONE asset: lumen-guard amber -> teal
// (fixed token map: SUN_AMBER #F0C15A -> SUN_TEAL/leaf #4E8A5A). Changes no
// production source, no other asset, no baseline. Pure: never mutates input.

const SANDBOX_AMBER: Rgba = [240, 193, 90, 255];
const SANDBOX_TEAL: Rgba = [78, 138, 90, 255];

export type SandboxOverride = (pix: Pix) => Pix;

/**
 * Returns the sandbox recolor for 'sunweaver-lumen-guard' — pixels whose RGB
 * equals amber [240,193,90] AND that sit inside the shield region
 * (x 14..35, y 14..50, matching the VS-4 row0 shield anatomy box) become teal
 * [78,138,90]. Pixels outside the region are untouched, so the override is a
 * visible, scoped, deterministic candidate change. Null for every other asset.
 */
const SANDBOX_REGION = { minX: 14, minY: 14, maxX: 35, maxY: 50 } as const;

export function getSandboxOverride(assetId: string): SandboxOverride | null {
  if (assetId !== 'sunweaver-lumen-guard') return null;
  return (pix: Pix): Pix => {
    const out = Pix.alloc(pix.w, pix.h);
    for (let y = 0; y < pix.h; y++) {
      for (let x = 0; x < pix.w; x++) {
        const i = (x + y * pix.w) * 4;
        const inRegion =
          x >= SANDBOX_REGION.minX && x <= SANDBOX_REGION.maxX &&
          y >= SANDBOX_REGION.minY && y <= SANDBOX_REGION.maxY;
        if (
          inRegion &&
          pix.d[i] === SANDBOX_AMBER[0] &&
          pix.d[i + 1] === SANDBOX_AMBER[1] &&
          pix.d[i + 2] === SANDBOX_AMBER[2]
        ) {
          out.d[i] = SANDBOX_TEAL[0];
          out.d[i + 1] = SANDBOX_TEAL[1];
          out.d[i + 2] = SANDBOX_TEAL[2];
        } else {
          out.d[i] = pix.d[i];
          out.d[i + 1] = pix.d[i + 1];
          out.d[i + 2] = pix.d[i + 2];
        }
        out.d[i + 3] = pix.d[i + 3];
      }
    }
    return out;
  };
}
