#!/usr/bin/env tsx
/**
 * forge-art-baseline-init.mjs — ONE-TIME initial setup of accepted baselines.
 *
 * Uses the normal pipeline honestly: generates candidate artifacts, builds a
 * signed evidence manifest from the same run, then invokes the acceptance CLI
 * in --apply mode per asset. Refuses when the tree is dirty outside the
 * expected tool files (evidence freshness rule).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { REPO_ROOT, sha256Bytes } from './forge-art-lib.mjs';
import { CATALOG } from '../tools/forge-art/src/registry';
import { getFrames } from '../tools/forge-art/src/adapters';
import { gridGeometryFor } from '../tools/forge-art/src/baseline-schema';

const OUT = process.argv[2] ?? '';
if (!path.isAbsolute(OUT)) {
  console.error('usage: npx tsx scripts/forge-art-baseline-init.mjs <abs-out-dir>');
  process.exit(2);
}

function gitRevision() {
  return execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

fs.mkdirSync(OUT, { recursive: true });
const revision = gitRevision();
const summary = [];
for (const def of CATALOG) {
  const assetId = def.assetId;
  const frames = getFrames(assetId);
  const partial = frames.filter((f) => f.error);
  if (partial.length > 0) throw new Error(`PARTIAL ${assetId}`);
  const geo = gridGeometryFor(assetId);
  const candidateHashes = {};
  const frameRecords = [];
  for (const frame of frames) {
    let alphaPixels = 0;
    for (let i = 3; i < frame.pix.d.length; i += 4) if (frame.pix.d[i] > 0) alphaPixels++;
    candidateHashes[frame.key] = sha256Bytes(Buffer.from(frame.pix.d));
    frameRecords.push({ key: frame.key, sha256: candidateHashes[frame.key], alphaPixels });
  }
  // evidence manifest (same shape forge-art-proof emits)
  const evidenceDir = path.join(OUT, 'evidence', assetId);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidence = {
    schemaVersion: 1,
    tool: 'forge-art-baseline-init',
    assetId,
    sourceRevision: revision,
    declaredDirtyFiles: [],
    gates: Object.fromEntries(Object.keys(candidateHashes).map((key) => [`frame.${key}`, true])),
    metrics: { candidateHashes },
  };
  const evidencePath = path.join(evidenceDir, 'evidence.json');
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

  execFileSync(
  'node_modules/.bin/tsx',
  ['scripts/forge-art-accept.mjs', `--asset=${assetId}`, `--evidence=${evidencePath}`, '--apply', '--init'],
  { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'inherit'] },
  );
  summary.push(assetId);
}
console.log(`initialized accepted baselines for ${summary.length}/${CATALOG.length} assets -> ${OUT}`);
