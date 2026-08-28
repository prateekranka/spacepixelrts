// FAL-HANDOFF regression: the public proof command must emit evidence that the
// public acceptance command can consume directly.
//
// This is intentionally an integration test. It is the RED test for the
// defect contract: before the repair, the public npm proof command uses plain
// node and fails to resolve the extensionless TypeScript imports.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fal-handoff-regression-'));
const assetId = 'sunweaver-lumen-guard';

try {
  execFileSync('npm', [
    'run', 'forge:art:proof', '--',
    `--asset=${assetId}`,
    `--out=${OUT_DIR}`,
  ], { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 300000 });

  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'public proof command must write manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  assert.equal(manifest.schemaVersion, 1, 'proof manifest schemaVersion must be 1');
  assert.equal(manifest.tool, 'forge-art-proof', 'proof tool marker must be preserved');
  assert.equal(manifest.assetId, assetId, 'proof manifest must name the selected asset');
  assert.equal(typeof manifest.sourceRevision, 'string', 'proof manifest must expose sourceRevision');
  assert.ok(Array.isArray(manifest.declaredDirtyFiles), 'proof manifest must expose declaredDirtyFiles');
  assert.ok(manifest.gates && typeof manifest.gates === 'object', 'proof manifest must expose gates');
  assert.ok(Object.keys(manifest.gates as object).length > 0, 'proof manifest gates must be non-empty');
  assert.ok(Array.isArray(manifest.failedFrames), 'proof manifest must expose failedFrames');

  const metricPack = (manifest.metrics as Record<string, unknown>)[assetId] as Record<string, unknown>;
  assert.ok(metricPack && typeof metricPack === 'object', 'asset-keyed proof metrics must be preserved');
  assert.ok(
    metricPack.candidateHashes && Object.keys(metricPack.candidateHashes as object).length > 0,
    'proof metrics must expose candidate hashes for the selected asset',
  );

  const acceptOutput = execFileSync('npm', [
    'run', 'forge:art:accept', '--',
    `--asset=${assetId}`,
    `--evidence=${manifestPath}`,
  ], { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe', timeout: 300000 });
  assert.match(acceptOutput, /DRY-RUN complete — nothing written\./, 'generated proof must reach real acceptance dry-run');
} finally {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
}

console.log('FAL handoff regression: PASS');
