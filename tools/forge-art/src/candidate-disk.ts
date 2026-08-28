/**
 * Forge Art Lab — candidate disk loader (Node-only).
 *
 * Reads the repo-backed imported candidate at
 * tools/forge-art/candidates/<assetId>/{reference.png, candidate.png, manifest.json}
 * (docs/LUMEN_GUARD_IMAGE_CANDIDATE.md "Repository contract"). Used by the
 * forge:art:import CLI and tsx tests. The browser workbench never imports this
 * module — it reads the same files over HTTP (fetch) and the manifest validator
 * from ./candidate-schema.
 *
 * Disk authority rule: the loader verifies every manifest frame sha256 against
 * the exact candidate.png cell bytes and reports violations as errors.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import {
  validateCandidateManifest,
  type ForgeArtCandidateManifest,
} from './candidate-schema';
import { ASSET_BY_ID } from './registry';

export const CANDIDATES_REPO_DIR = 'tools/forge-art/candidates';

/** Repository root derived from this module's location (tools/forge-art/src). */
export function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

export function candidatesRoot(root: string = repoRoot()): string {
  return path.join(root, CANDIDATES_REPO_DIR);
}

export function candidateAssetDir(assetId: string, root: string = repoRoot()): string {
  return path.join(candidatesRoot(root), assetId);
}

export type CandidateManifestLoad =
  | { manifest: ForgeArtCandidateManifest }
  | { missing: true }
  | { error: string };

/**
 * Load + validate the candidate manifest for an asset. `missing` when the
 * manifest file does not exist; `error` when unparseable or schema-invalid.
 */
export function loadCandidateManifestFromDisk(assetId: string, root: string = repoRoot()): CandidateManifestLoad {
  const file = path.join(candidateAssetDir(assetId, root), 'manifest.json');
  if (!fs.existsSync(file)) return { missing: true };
  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return { error: `candidate manifest unparseable: ${error instanceof Error ? error.message : String(error)}` };
  }
  const errors = validateCandidateManifest(json);
  if (errors.length > 0) {
    return { error: `candidate manifest invalid: ${errors.join('; ')}` };
  }
  return { manifest: json as ForgeArtCandidateManifest };
}

export type CandidateSheetLoad =
  | { cells: Array<{ key: string; bytes: Uint8Array }>; width: number; height: number }
  | { missing: true }
  | { error: string };

/**
 * Decode candidate.png into per-frame RGBA cells in manifest frame order and
 * verify every cell hash against the manifest (disk authority). `missing` only
 * when there is no manifest at all.
 */
export function loadCandidateSheetFromDisk(assetId: string, root: string = repoRoot()): CandidateSheetLoad {
  const manifestLoad = loadCandidateManifestFromDisk(assetId, root);
  if ('missing' in manifestLoad) return { missing: true };
  if ('error' in manifestLoad) return { error: manifestLoad.error };
  const manifest = manifestLoad.manifest;
  const pngPath = path.join(candidateAssetDir(assetId, root), 'candidate.png');
  if (!fs.existsSync(pngPath)) return { error: `candidate.png missing for ${assetId}` };
  let png: PNG;
  try {
    png = PNG.sync.read(fs.readFileSync(pngPath));
  } catch (error) {
    return { error: `candidate.png undecodable: ${error instanceof Error ? error.message : String(error)}` };
  }
  const { cellW, cellH, cols, rows } = manifest.target;
  const expectW = cellW * cols;
  const expectH = cellH * rows;
  if (png.width !== expectW || png.height !== expectH) {
    return { error: `candidate.png is ${png.width}x${png.height}, expected ${expectW}x${expectH}` };
  }
  const cells = manifest.frames.map((frame, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const bytes = Buffer.alloc(cellW * cellH * 4);
    for (let y = 0; y < cellH; y++) {
      const srcStart = (col * cellW + (row * cellH + y) * png.width) * 4;
      png.data.copy(bytes, y * cellW * 4, srcStart, srcStart + cellW * 4);
    }
    return { key: frame.key, bytes };
  });
  for (let i = 0; i < cells.length; i++) {
    const sha = createHash('sha256').update(cells[i].bytes).digest('hex');
    if (sha !== manifest.frames[i].sha256) {
      return { error: `candidate.png cell ${manifest.frames[i].key} hash mismatch (disk authority violated)` };
    }
  }
  return { cells, width: png.width, height: png.height };
}

export type ReferenceInfoLoad =
  | { sha256: string; width: number; height: number }
  | { missing: true }
  | { error: string };

/** Source reference facts (file sha256 + decoded dims) for the committed reference.png. */
export function referenceInfoFromDisk(assetId: string, root: string = repoRoot()): ReferenceInfoLoad {
  const file = path.join(candidateAssetDir(assetId, root), 'reference.png');
  if (!fs.existsSync(file)) return { missing: true };
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(file);
  } catch (error) {
    return { error: `reference.png unreadable: ${error instanceof Error ? error.message : String(error)}` };
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  try {
    const png = PNG.sync.read(bytes);
    return { sha256, width: png.width, height: png.height };
  } catch (error) {
    return { error: `reference.png undecodable: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** Convenience: expected candidate asset path guard (throws for unknown ids). */
export function assertCandidateAsset(assetId: string): void {
  if (!ASSET_BY_ID[assetId]) throw new Error(`unknown asset "${assetId}"`);
}
