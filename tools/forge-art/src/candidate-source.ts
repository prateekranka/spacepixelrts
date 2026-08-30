/**
 * Forge Art Lab — narrow typed adapter seam for Builder 2's generated runtime
 * candidate source (docs/LUMEN_GUARD_IMAGE_CANDIDATE.md "Candidate source and
 * runtime seams").
 *
 * Builder 2 owns src/generated/<assetId>-candidate.ts. The seam declares the
 * exact module contract, resolves it at the repo path, validates its shape, and
 * — when the module is absent — reports the missing source EXPLICITLY instead of
 * inventing a competing sprite generator. The forge:art:import CLI refuses
 * (partial candidate) until the module lands; the workbench falls back to the
 * procedural candidate and shows the imported-candidate metadata it can read.
 *
 * Expected generated module shape (named exports):
 *   export const assetId: string;                 // e.g. 'sunweaver-lumen-guard'
 *   export const algorithm: 'combat-reference-v1';
 *   export const cells: readonly GeneratedCandidateCell[];  // exactly 16, dir-major
 *
 * GeneratedCandidateCell: { key: 'dir0-pose0'..'dir7-pose1', width: 64, height: 64,
 *   bytes: Uint8Array }  // 64*64*4 raw RGBA, NO artificial exterior rim
 *   (the existing exterior combat rim is applied by authoredCombatSprite() once).
 *
 * Node-only module (dynamic import); the browser workbench never imports it.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ASSET_BY_ID } from './registry';
import { candidateFrameKeys } from './candidate-schema';

export interface GeneratedCandidateCell {
  key: string;
  width: number;
  height: number;
  /** Raw RGBA bytes, 64*64*4 per cell. */
  bytes: Uint8Array;
}

export interface GeneratedCandidateModule {
  assetId: string;
  algorithm: 'combat-reference-v1';
  cells: readonly GeneratedCandidateCell[];
}

export type GeneratedCandidateLoad =
  | { present: true; module: GeneratedCandidateModule; sourcePath: string }
  | {
      present: false;
      sourcePath: string | null;
      reason: 'missing-module' | 'unsupported-category';
      message: string;
    };

export function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

/**
 * Repository-relative generated source path for an asset. null for
 * non-combat assets (this vertical slice converts combat reference images only;
 * the manifest schema supports unit|building, buildings have no generated source).
 */
export function generatedCandidateSourcePath(assetId: string): string | null {
  const def = ASSET_BY_ID[assetId];
  if (!def) throw new Error(`generatedCandidateSourcePath: unknown assetId "${assetId}"`);
  if (def.adapterId !== 'combat') return null;
  return path.join('src', 'generated', `${assetId}-candidate.ts`);
}

/** Shape validation against the declared contract; [] when valid. */
export function validateGeneratedCandidateModule(
  assetId: string,
  mod: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  if (mod.assetId !== assetId) {
    errors.push(`assetId must be "${assetId}"`);
  }
  if (mod.algorithm !== 'combat-reference-v1') {
    errors.push('algorithm must be "combat-reference-v1"');
  }
  const expectedKeys = candidateFrameKeys();
  if (!Array.isArray(mod.cells)) {
    errors.push('cells must be an array');
    return errors;
  }
  const cells = mod.cells as unknown[];
  if (cells.length !== expectedKeys.length) {
    errors.push(`cells must contain exactly ${expectedKeys.length} entries (got ${cells.length})`);
    return errors;
  }
  cells.forEach((cell, i) => {
    const c = cell as Record<string, unknown>;
    if (typeof c !== 'object' || c === null) {
      errors.push(`cells[${i}] must be an object`);
      return;
    }
    if (c.key !== expectedKeys[i]) {
      errors.push(`cells[${i}].key must be "${expectedKeys[i]}" (dir-major order)`);
    }
    if (c.width !== 64 || c.height !== 64) {
      errors.push(`cells[${i}].width/height must be 64x64`);
    }
    if (!(c.bytes instanceof Uint8Array) || c.bytes.length !== 64 * 64 * 4) {
      errors.push(`cells[${i}].bytes must be a 16384-byte RGBA Uint8Array`);
    }
  });
  return errors;
}

/**
 * Load + shape-validate Builder 2's generated candidate module.
 *
 * - non-combat asset -> present:false reason 'unsupported-category'
 * - module file absent -> present:false reason 'missing-module' (explicit path)
 * - module present but malformed -> throws with named errors
 * - module present and valid -> present:true with the validated module
 *
 * `modulePath` is a test-only override; production callers resolve the repo path.
 */
export async function loadGeneratedCandidateSource(
  assetId: string,
  modulePath?: string,
): Promise<GeneratedCandidateLoad> {
  const def = ASSET_BY_ID[assetId];
  if (!def) throw new Error(`loadGeneratedCandidateSource: unknown assetId "${assetId}"`);
  const rel = generatedCandidateSourcePath(assetId);
  if (!rel) {
    return {
      present: false,
      sourcePath: null,
      reason: 'unsupported-category',
      message:
        `no generated candidate source for non-combat asset "${assetId}": the manifest schema ` +
        'supports unit|building, but this vertical slice converts combat reference images only',
    };
  }
  const resolved = modulePath ?? path.join(repoRoot(), rel);
  let mod: Record<string, unknown>;
  try {
    mod = (await import(pathToFileURL(resolved).href)) as Record<string, unknown>;
  } catch {
    return {
      present: false,
      sourcePath: resolved,
      reason: 'missing-module',
      message: `generated candidate source missing at ${resolved} — import blocked until the module lands`,
    };
  }
  const errors = validateGeneratedCandidateModule(assetId, mod);
  if (errors.length > 0) {
    throw new Error(`generated candidate source malformed (${resolved}): ${errors.join('; ')}`);
  }
  return { present: true, module: mod as unknown as GeneratedCandidateModule, sourcePath: resolved };
}
