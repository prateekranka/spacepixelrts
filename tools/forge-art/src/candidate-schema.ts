/**
 * Forge Art Lab — image-backed candidate manifest schema v1
 * (docs/LUMEN_GUARD_IMAGE_CANDIDATE.md "Manifest v1").
 *
 * PURE module: exact v1 schema types, constants, validator, status mapping and
 * frame-order helpers. Browser-safe (no node builtins, no fs). The disk loader
 * for CLI/tests lives in ./candidate-disk.ts; the Builder-2 generated-source
 * seam lives in ./candidate-source.ts.
 *
 * The manifest supports category `unit | building` and sourceKind
 * `reference-image | sprite-sheet`; the combat-reference-v1 algorithm this
 * vertical slice implements converts ONLY combat reference images (64x64 cells,
 * 8 directions x 2 poses, dir-major frame order, authored dirs [0,1,2,6,7],
 * exact mirrors [3,4,5] of [1,0,7]).
 */
import { ASSET_BY_ID, isPublicAssetId, type AdapterId } from './registry';

export const CANDIDATE_SCHEMA_VERSION = 1;
export const CANDIDATE_ALGORITHM = 'combat-reference-v1' as const;
export const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REL_PATH_RE = /^[a-z0-9][a-z0-9./_-]*$/;

/** Exact combat-reference-v1 target grid (binding contract, docs §"Manifest v1"). */
export const CANDIDATE_COMBAT_TARGET = {
  cellW: 64,
  cellH: 64,
  cols: 8,
  rows: 2,
  order: 'dir-major',
  frameCount: 16,
} as const;

/** Authored directions carry directional information; 3/4/5 mirror 1/0/7 exactly. */
export const CANDIDATE_COMBAT_DIRECTIONS = {
  authored: [0, 1, 2, 6, 7],
  mirrored: [3, 4, 5],
} as const;

export const CANDIDATE_COMBAT_POSES = {
  count: 2,
  names: ['primary', 'alternate'],
} as const;

export type CandidateStatus = 'NO CANDIDATE' | 'DRAFT' | 'READY FOR REVIEW' | 'APPROVED';

export interface ForgeArtCandidateFrame {
  key: string;
  /** sha256 over the exact RGBA cell bytes (row-strided region copy). */
  sha256: string;
  width: number;
  height: number;
  alphaPixels: number;
}

/** Exact v1 schema per docs/LUMEN_GUARD_IMAGE_CANDIDATE.md (authoritative). */
export interface ForgeArtCandidateManifest {
  schemaVersion: 1;
  assetId: string;
  label: string;
  civilization: 'sunweaver' | 'gravemark';
  category: 'unit' | 'building';
  adapter: 'combat' | 'building';
  sourceKind: 'reference-image' | 'sprite-sheet';
  /** Repository-relative reference path. */
  sourcePath: string;
  sourceSha256: string;
  sourceWidth: number;
  sourceHeight: number;
  /** Repository-relative candidate.png path. */
  candidatePath: string;
  /** Repository-relative generated TS source path. */
  candidateSourcePath: string;
  generatedAt: string;
  algorithm: 'combat-reference-v1';
  status: 'draft' | 'approved';
  target: {
    cellW: number;
    cellH: number;
    cols: number;
    rows: number;
    order: 'dir-major';
    frameCount: number;
  };
  directions: { authored: number[]; mirrored: number[] };
  poses: { count: number; names: string[] };
  /** One entry per frame, dir-major grid order. */
  frames: ForgeArtCandidateFrame[];
  notes?: string;
}

/**
 * Dir-major candidate frame keys: dir0-pose0 .. dir7-pose0, dir0-pose1 ..
 * dir7-pose1 (16 keys). Same order as the combat baseline grid.
 */
export function candidateFrameKeys(): readonly string[] {
  const keys: string[] = [];
  for (let p = 0; p < 2; p++) {
    for (let d = 0; d < 8; d++) keys.push(`dir${d}-pose${p}`);
  }
  return keys;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPosInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

function isRepoRelativePath(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    v.length > 0 &&
    !v.startsWith('/') &&
    !v.startsWith('\\') &&
    !/^[a-zA-Z]:/.test(v) &&
    !v.split(/[\\/]/).includes('..') &&
    REL_PATH_RE.test(v)
  );
}

function sameNumberArray(a: unknown, expected: readonly number[]): boolean {
  return (
    Array.isArray(a) &&
    a.length === expected.length &&
    a.every((n, i) => typeof n === 'number' && n === expected[i])
  );
}

/**
 * Validate a candidate manifest against the exact v1 schema
 * (docs/LUMEN_GUARD_IMAGE_CANDIDATE.md). Returns [] when valid, otherwise a
 * list of human-readable error strings. For public asset ids the manifest is
 * cross-checked against the registry (category, adapter, civilization, target
 * grid, frame keys/order).
 */
export function validateCandidateManifest(json: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(json)) return ['candidate manifest must be a JSON object'];

  if (json.schemaVersion !== CANDIDATE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${CANDIDATE_SCHEMA_VERSION}`);
  }

  if (typeof json.assetId !== 'string' || json.assetId.length === 0) {
    errors.push('assetId must be a non-empty string');
  } else if (!KEBAB_RE.test(json.assetId)) {
    errors.push(`assetId "${json.assetId}" must be kebab-case`);
  } else if (!isPublicAssetId(json.assetId)) {
    errors.push(`assetId "${json.assetId}" is not a public catalog asset`);
  }

  if (typeof json.label !== 'string' || json.label.trim().length === 0) {
    errors.push('label must be a non-empty string');
  }
  if (json.civilization !== 'sunweaver' && json.civilization !== 'gravemark') {
    errors.push('civilization must be "sunweaver" or "gravemark"');
  }
  if (json.category !== 'unit' && json.category !== 'building') {
    errors.push('category must be "unit" or "building"');
  }
  if (json.adapter !== 'combat' && json.adapter !== 'building') {
    errors.push('adapter must be "combat" or "building"');
  }
  if (json.sourceKind !== 'reference-image' && json.sourceKind !== 'sprite-sheet') {
    errors.push('sourceKind must be "reference-image" or "sprite-sheet"');
  }

  for (const field of ['sourcePath', 'candidatePath', 'candidateSourcePath'] as const) {
    if (!isRepoRelativePath(json[field])) {
      errors.push(`${field} must be a repository-relative path (no leading "/", no "..")`);
    }
  }

  if (typeof json.sourceSha256 !== 'string' || !SHA256_HEX_RE.test(json.sourceSha256)) {
    errors.push('sourceSha256 must be a 64-char hex sha256');
  }
  if (!isPosInt(json.sourceWidth)) errors.push('sourceWidth must be a positive integer');
  if (!isPosInt(json.sourceHeight)) errors.push('sourceHeight must be a positive integer');

  if (typeof json.generatedAt !== 'string' || Number.isNaN(Date.parse(json.generatedAt))) {
    errors.push('generatedAt must be an ISO-8601 date string');
  }

  if (json.algorithm !== CANDIDATE_ALGORITHM) {
    errors.push(`algorithm must be "${CANDIDATE_ALGORITHM}"`);
  }
  if (json.status !== 'draft' && json.status !== 'approved') {
    errors.push('status must be "draft" or "approved"');
  }

  if (!isRecord(json.target)) {
    errors.push('target must be an object');
  } else {
    const { cellW, cellH, cols, rows, order, frameCount } = json.target;
    for (const [name, v] of [
      ['cellW', cellW],
      ['cellH', cellH],
      ['cols', cols],
      ['rows', rows],
      ['frameCount', frameCount],
    ] as const) {
      if (!isPosInt(v)) errors.push(`target.${name} must be a positive integer`);
    }
    if (order !== 'dir-major') errors.push('target.order must be "dir-major"');
  }

  if (!isRecord(json.directions)) {
    errors.push('directions must be an object');
  } else {
    if (!sameNumberArray(json.directions.authored, CANDIDATE_COMBAT_DIRECTIONS.authored)) {
      errors.push(`directions.authored must equal [${CANDIDATE_COMBAT_DIRECTIONS.authored.join(', ')}]`);
    }
    if (!sameNumberArray(json.directions.mirrored, CANDIDATE_COMBAT_DIRECTIONS.mirrored)) {
      errors.push(`directions.mirrored must equal [${CANDIDATE_COMBAT_DIRECTIONS.mirrored.join(', ')}]`);
    }
  }

  if (!isRecord(json.poses)) {
    errors.push('poses must be an object');
  } else {
    if (!isPosInt(json.poses.count) || json.poses.count !== 2) errors.push('poses.count must be 2');
    if (
      !Array.isArray(json.poses.names) ||
      json.poses.names.length !== 2 ||
      json.poses.names[0] !== 'primary' ||
      json.poses.names[1] !== 'alternate'
    ) {
      errors.push(`poses.names must equal ['primary', 'alternate']`);
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
      if (!isPosInt(f.width)) errors.push(`frames[${i}].width must be a positive integer`);
      if (!isPosInt(f.height)) errors.push(`frames[${i}].height must be a positive integer`);
      if (typeof f.alphaPixels !== 'number' || !Number.isFinite(f.alphaPixels) || f.alphaPixels < 0) {
        errors.push(`frames[${i}].alphaPixels must be a non-negative number`);
      }
    });
    if (json.frames.length !== 16) errors.push('frames must contain exactly 16 cells');
    const expected = candidateFrameKeys();
    const actual = json.frames.map((f) => (isRecord(f) ? f.key : undefined));
    if (actual.length === expected.length && actual.some((k, i) => k !== expected[i])) {
      errors.push(`frames keys must equal dir-major order [${expected.join(', ')}]`);
    }
  }

  if (json.notes !== undefined && typeof json.notes !== 'string') {
    errors.push('notes must be a string when present');
  }

  // Registry cross-checks for public asset ids.
  if (typeof json.assetId === 'string' && isPublicAssetId(json.assetId)) {
    const def = ASSET_BY_ID[json.assetId];
    const expectedAdapter: AdapterId = def.adapterId === 'combat' ? 'combat' : 'building';
    if (json.civilization !== def.faction) {
      errors.push(`civilization must equal registry faction "${def.faction}"`);
    }
    if (json.category !== def.category) {
      errors.push(`category must equal registry category "${def.category}"`);
    }
    if (json.adapter !== expectedAdapter) {
      errors.push(`adapter must equal registry adapter "${expectedAdapter}"`);
    }
    const isCombat = def.adapterId === 'combat';
    if (isCombat) {
      if (!isRecord(json.target)) {
        // already reported above
      } else {
        const t = json.target;
        if (t.cellW !== def.dims.w || t.cellH !== def.dims.h) {
          errors.push(`target cells must be ${def.dims.w}x${def.dims.h} for "${json.assetId}"`);
        }
        if (t.cols !== 8 || t.rows !== 2 || t.frameCount !== 16) {
          errors.push('target grid must be 8 cols x 2 rows x frameCount 16 for combat assets');
        }
      }
      if (Array.isArray(json.frames)) {
        const expectedFrames = candidateFrameKeys();
        const actualKeys = json.frames.map((f) => (isRecord(f) ? f.key : undefined));
        if (actualKeys.length !== expectedFrames.length || actualKeys.some((k, i) => k !== expectedFrames[i])) {
          errors.push(`frames keys must equal [${expectedFrames.join(', ')}]`);
        }
      }
      const targetCell = isRecord(json.target) ? json.target : null;
      if (Array.isArray(json.frames)) {
        json.frames.forEach((f: unknown, i: number) => {
          if (!isRecord(f)) return;
          const cellW = targetCell && isPosInt(targetCell.cellW) ? targetCell.cellW : def.dims.w;
          const cellH = targetCell && isPosInt(targetCell.cellH) ? targetCell.cellH : def.dims.h;
          if (f.width !== cellW || f.height !== cellH) {
            errors.push(`frames[${i}].width/height must equal ${cellW}x${cellH}`);
          }
        });
      }
    }
  }

  return errors;
}

/**
 * Public candidate status chip mapping (workbench `data-fal-candidate-status`):
 * no manifest -> NO CANDIDATE; approved -> APPROVED; draft with every proven
 * objective gate passing -> READY FOR REVIEW; draft otherwise -> DRAFT.
 */
export function candidateStatusFor(
  manifest: ForgeArtCandidateManifest | null | undefined,
  provenGatesPass: boolean,
): CandidateStatus {
  if (!manifest) return 'NO CANDIDATE';
  if (manifest.status === 'approved') return 'APPROVED';
  return provenGatesPass ? 'READY FOR REVIEW' : 'DRAFT';
}
