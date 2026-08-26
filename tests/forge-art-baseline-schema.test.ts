// FAL — accepted-baseline schema contract (FORGE_ART_LAB.md §5, §14; A6 §2).
// Loads EVERY committed accepted manifest + registry entry and asserts the frozen
// v1 shape: validateBaselineManifest() must return [] for each manifest, the full
// §5 key set must be present, and the registry's manifestSha256/baselinePngSha256/
// frameSha256 must match the on-disk bytes (R1 M1 regression gate).
// Pure tsx: no network, no browser.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateBaselineManifest } from '../tools/forge-art/src/baseline-schema';
import { isPublicAssetId } from '../tools/forge-art/src/registry';

const failures: string[] = [];
const requireOk = (cond: boolean, msg: string): void => { if (!cond) failures.push(msg); };

const BASELINES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'tools',
  'forge-art',
  'baselines',
);
const sha256File = (file: string): string =>
  createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Frozen top-level key set of the §5 v1 manifest (the validator's full contract). */
const REQUIRED_TOP_KEYS = [
  'schemaVersion',
  'assetId',
  'label',
  'faction',
  'category',
  'revision',
  'createdAt',
  'source',
  'cellLayout',
  'anchor',
  'worldScale',
  'frames',
  'paletteStats',
  'thresholdsUsed',
  'gates',
] as const;

interface RegistryEntry {
  revision: string;
  acceptedAt: string;
  manifestSha256: string;
  baselinePngSha256: string;
  frameSha256: Record<string, string>;
}

const registry = JSON.parse(
  fs.readFileSync(path.join(BASELINES_DIR, 'registry.json'), 'utf8'),
) as { schemaVersion: number; assets: Record<string, RegistryEntry> };
assert.equal(registry.schemaVersion, 1, 'registry.json schemaVersion must be 1');
const assetIds = Object.keys(registry.assets);
assert.ok(assetIds.length >= 14, `registry must cover the 14 public assets (got ${assetIds.length})`);

let validated = 0;
for (const assetId of assetIds) {
  requireOk(isPublicAssetId(assetId), `${assetId}: registry entry must reference a public asset id`);
  const dir = path.join(BASELINES_DIR, assetId);
  const manifestPath = path.join(dir, 'manifest.json');
  const pngPath = path.join(dir, 'baseline.png');
  requireOk(fs.existsSync(manifestPath), `${assetId}: manifest.json missing`);
  requireOk(fs.existsSync(pngPath), `${assetId}: baseline.png missing`);
  if (!fs.existsSync(manifestPath)) continue;

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    failures.push(`${assetId}: manifest.json unparseable (${(error as Error).message})`);
    continue;
  }

  const errors = validateBaselineManifest(manifest);
  requireOk(errors.length === 0, `${assetId}: manifest fails schema v1: ${errors.join(' | ')}`);
  for (const key of REQUIRED_TOP_KEYS) {
    requireOk(key in manifest, `${assetId}: frozen field "${key}" missing from accepted manifest`);
  }

  const entry = registry.assets[assetId]!;
  requireOk(
    sha256File(manifestPath) === entry.manifestSha256,
    `${assetId}: registry manifestSha256 does not match on-disk manifest.json`,
  );
  requireOk(
    sha256File(pngPath) === entry.baselinePngSha256,
    `${assetId}: registry baselinePngSha256 does not match on-disk baseline.png`,
  );
  const frames = manifest.frames as Array<{ key: string; sha256: string }>;
  for (const frame of frames) {
    requireOk(
      entry.frameSha256[frame.key] === frame.sha256,
      `${assetId}: registry frameSha256.${frame.key} does not match the manifest digest`,
    );
  }
  validated++;
}
requireOk(validated === assetIds.length, `all ${assetIds.length} registered assets validated (validated ${validated})`);

// No orphan accepted baselines: every on-disk baseline dir must be registered.
for (const name of fs.readdirSync(BASELINES_DIR)) {
  if (name === 'registry.json') continue;
  if (!fs.statSync(path.join(BASELINES_DIR, name)).isDirectory()) continue;
  requireOk(name in registry.assets, `${name}: on-disk baseline dir has no registry entry`);
}

console.log(
  `accepted-baseline schema: ${validated}/${assetIds.length} committed manifests validate against schema v1; ` +
  `registry hashes match on-disk bytes; ${failures.length} failures`,
);
assert.equal(failures.length, 0, `FAL accepted-baseline schema contract RED: ${failures.join('; ')}`);
console.log('FAL accepted-baseline schema contract: PASS');
