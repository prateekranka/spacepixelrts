/**
 * Forge Art Lab v1 — accepted-baseline schema, validation, and hashing helpers
 * (docs/FORGE_ART_LAB.md §5, audits/A6). Pure module: schema types + validation +
 * byte hashing. NO CLI code — the CLI lives in scripts/forge-art-*.mjs (lead-owned).
 *
 * cellSha256FromBytes uses node:crypto on purpose: hashes are computed by Node CLI
 * scripts and tsx tests. The lookup is lazy and window-guarded (same pattern as
 * metrics.ts) so importing this module never touches node builtins in a browser.
 */
import { ASSET_BY_ID, isPublicAssetId, gridGeometryFor as registryGridGeometryFor, type FrameGroup } from './registry';

export const SUPPORTED_SCHEMA_VERSION = 1;
export const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Per-frame hash record inside a baseline manifest (§5). */
export interface BaselineFrame {
  key: string;
  /** sha256 over the exact RGBA cell bytes (row-strided region copy). */
  sha256: string;
  alphaPixels: number;
}

/** Baseline manifest schema v1 — exact fields per §5 of the frozen contract. */
export interface BaselineManifest {
  schemaVersion: 1;
  assetId: string;
  label: string;
  faction: 'sunweaver' | 'gravemark';
  category: 'unit' | 'building';
  /** Git SHA of src/ at generation. */
  revision: string;
  /** ISO-8601; informational only, never hashed into frames. */
  createdAt: string;
  source: { adapter: string; dims: [number, number] };
  cellLayout: { cellW: number; cellH: number; cols: number; rows: number; order: 'dir-major' | 'grid' };
  anchor: { x: number; y: number };
  worldScale: { x: number; y: number };
  /** One entry per primary frame key, in frame-key order. */
  frames: BaselineFrame[];
  paletteStats: Record<string, number>;
  thresholdsUsed: Record<string, unknown>;
  gates: Record<string, boolean>;
}

/** Single asset entry in baselines/registry.json (A6 §2). */
export interface RegistryEntry {
  revision: string;
  acceptedAt: string;
  manifestSha256: string;
  baselinePngSha256: string;
  frameSha256: Record<string, string>;
}

/** baselines/registry.json schema v1 (A6 §2). */
export interface RegistryFile {
  schemaVersion: 1;
  assets: Record<string, RegistryEntry>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Minimal structural node:crypto surface (no @types/node dependency). */
interface NodeCryptoLike {
  createHash(algo: string): {
    update(data: Uint8Array): { digest(enc: 'hex'): string };
  };
}

/**
 * Lazy node:crypto lookup, guarded so browsers never touch node builtins.
 * Uses process.getBuiltinModule (Node >= 22.3) or a CJS global require.
 */
function nodeCrypto(): NodeCryptoLike | null {
  try {
    const g = globalThis as {
      window?: unknown;
      process?: { getBuiltinModule?: (name: string) => unknown };
      require?: (name: string) => unknown;
    };
    if (typeof g.window !== 'undefined') return null;
    if (typeof g.process !== 'undefined' && typeof g.process.getBuiltinModule === 'function') {
      return g.process.getBuiltinModule('node:crypto') as NodeCryptoLike;
    }
    if (typeof g.require === 'function') return g.require('node:crypto') as NodeCryptoLike;
  } catch {
    // fall through
  }
  return null;
}

/** sha256 hex digest over the exact RGBA cell bytes (byte-equivalent to VS-4 Pix.d hashing). */
export function cellSha256FromBytes(u8: Uint8Array): string {
  const crypto = nodeCrypto();
  if (crypto === null) {
    throw new Error('cellSha256FromBytes requires a Node runtime with node:crypto');
  }
  return crypto.createHash('sha256').update(u8).digest('hex');
}

/**
 * Baseline PNG grid geometry for an asset id (§5), delegating to the registry
 * computation: combat 64px cols8 rows2 => 512x128; worker 32x48 cols8 rows2 =>
 * 256x96; scout 128x128 1x1; buildings 64x64 (core) or 32x32 (habitat/yard) 1x1.
 */
export function gridGeometryFor(assetId: string): {
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
} {
  const def = ASSET_BY_ID[assetId];
  if (!def) throw new Error(`gridGeometryFor: unknown assetId "${assetId}"`);
  return registryGridGeometryFor(def);
}

/**
 * Ordered frame keys for an asset's frame group, matching adapters.getFrames order.
 * 'primary' -> the asset's baseline grid keys; named groups ('actions' on
 * sunweaver-worker) -> their keys; unknown group -> [].
 */
export function frameKeyOrder(assetId: string, group: FrameGroup = 'primary'): string[] {
  const def = ASSET_BY_ID[assetId];
  if (!def) throw new Error(`frameKeyOrder: unknown assetId "${assetId}"`);
  if (group === 'primary') return [...def.frames];
  return def.groups ? [...(def.groups[group] ?? [])] : [];
}

/**
 * Validate a candidate baseline manifest (schema v1). Returns [] when valid,
 * otherwise a list of human-readable error strings. For public asset ids the
 * frame-key set/order and grid geometry are cross-checked against the registry.
 */
export function validateBaselineManifest(json: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(json)) return ['manifest must be a JSON object'];

  if (json.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SUPPORTED_SCHEMA_VERSION}`);
  }

  if (typeof json.assetId !== 'string' || json.assetId.length === 0) {
    errors.push('assetId must be a non-empty string');
  } else if (!KEBAB_RE.test(json.assetId)) {
    errors.push(`assetId "${json.assetId}" must be kebab-case`);
  }

  if (typeof json.label !== 'string' || json.label.trim().length === 0) {
    errors.push('label must be a non-empty string');
  }
  if (json.faction !== 'sunweaver' && json.faction !== 'gravemark') {
    errors.push('faction must be "sunweaver" or "gravemark"');
  }
  if (json.category !== 'unit' && json.category !== 'building') {
    errors.push('category must be "unit" or "building"');
  }
  if (typeof json.revision !== 'string' || json.revision.length === 0) {
    errors.push('revision must be a non-empty string');
  }
  if (typeof json.createdAt !== 'string' || Number.isNaN(Date.parse(json.createdAt))) {
    errors.push('createdAt must be an ISO-8601 date string');
  }

  if (!isRecord(json.source)) {
    errors.push('source must be an object');
  } else {
    if (typeof json.source.adapter !== 'string' || json.source.adapter.length === 0) {
      errors.push('source.adapter must be a non-empty string');
    }
    if (
      !Array.isArray(json.source.dims) ||
      json.source.dims.length !== 2 ||
      !json.source.dims.every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0)
    ) {
      errors.push('source.dims must be [width, height] of positive numbers');
    }
  }

  if (!isRecord(json.cellLayout)) {
    errors.push('cellLayout must be an object');
  } else {
    const { cellW, cellH, cols, rows, order } = json.cellLayout;
    for (const [name, v] of [
      ['cellW', cellW],
      ['cellH', cellH],
      ['cols', cols],
      ['rows', rows],
    ] as const) {
      if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) {
        errors.push(`cellLayout.${name} must be a positive integer`);
      }
    }
    if (order !== 'dir-major' && order !== 'grid') {
      errors.push('cellLayout.order must be "dir-major" or "grid"');
    }
  }

  if (!isRecord(json.anchor)) {
    errors.push('anchor must be an object');
  } else {
    if (typeof json.anchor.x !== 'number' || !Number.isFinite(json.anchor.x)) {
      errors.push('anchor.x must be a finite number');
    }
    if (typeof json.anchor.y !== 'number' || !Number.isFinite(json.anchor.y)) {
      errors.push('anchor.y must be a finite number');
    }
  }

  if (!isRecord(json.worldScale)) {
    errors.push('worldScale must be an object');
  } else {
    if (typeof json.worldScale.x !== 'number' || !Number.isFinite(json.worldScale.x) || json.worldScale.x <= 0) {
      errors.push('worldScale.x must be a positive number');
    }
    if (typeof json.worldScale.y !== 'number' || !Number.isFinite(json.worldScale.y) || json.worldScale.y <= 0) {
      errors.push('worldScale.y must be a positive number');
    }
  }

  if (!Array.isArray(json.frames) || json.frames.length === 0) {
    errors.push('frames must be a non-empty array');
  } else {
    const seen = new Set<string>();
    json.frames.forEach((f, i) => {
      if (!isRecord(f)) {
        errors.push(`frames[${i}] must be an object`);
        return;
      }
      if (typeof f.key !== 'string' || f.key.length === 0) {
        errors.push(`frames[${i}].key must be a non-empty string`);
      } else if (seen.has(f.key)) {
        errors.push(`frames[${i}].key "${f.key}" is duplicated`);
      } else {
        seen.add(f.key);
      }
      if (typeof f.sha256 !== 'string' || !SHA256_HEX_RE.test(f.sha256)) {
        errors.push(`frames[${i}].sha256 must be a 64-char hex sha256`);
      }
      if (typeof f.alphaPixels !== 'number' || !Number.isFinite(f.alphaPixels) || f.alphaPixels < 0) {
        errors.push(`frames[${i}].alphaPixels must be a non-negative number`);
      }
    });
    if (typeof json.assetId === 'string' && isPublicAssetId(json.assetId)) {
      const expected = frameKeyOrder(json.assetId, 'primary');
      const actual = json.frames.map((f) => (isRecord(f) ? f.key : undefined));
      if (actual.length !== expected.length || actual.some((k, i) => k !== expected[i])) {
        errors.push(`frames keys must equal registry order [${expected.join(', ')}]`);
      }
    }
  }

  if (!isRecord(json.paletteStats)) {
    errors.push('paletteStats must be an object');
  }
  if (!isRecord(json.thresholdsUsed)) {
    errors.push('thresholdsUsed must be an object');
  }
  if (!isRecord(json.gates)) {
    errors.push('gates must be an object');
  } else {
    for (const [k, v] of Object.entries(json.gates)) {
      if (typeof v !== 'boolean') errors.push(`gates.${k} must be a boolean`);
    }
  }

  if (typeof json.assetId === 'string' && isPublicAssetId(json.assetId)) {
    const g = gridGeometryFor(json.assetId);
    if (isRecord(json.cellLayout)) {
      if (
        json.cellLayout.cellW !== g.cellW ||
        json.cellLayout.cellH !== g.cellH ||
        json.cellLayout.cols !== g.cols ||
        json.cellLayout.rows !== g.rows
      ) {
        errors.push(`cellLayout must equal ${g.cols}x${g.rows} of ${g.cellW}x${g.cellH} for "${json.assetId}"`);
      }
    }
    if (isRecord(json.source) && Array.isArray(json.source.dims)) {
      const [w, h] = json.source.dims as unknown[];
      if (w !== g.width || h !== g.height) {
        errors.push(`source.dims must equal [${g.width}, ${g.height}] for "${json.assetId}"`);
      }
    }
  }

  return errors;
}
