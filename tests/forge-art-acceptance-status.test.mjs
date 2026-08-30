#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  approveCandidateManifest,
  canonicalApprovalJson,
} from '../scripts/forge-art-approval-lib.mjs';

const draft = {
  schemaVersion: 1,
  assetId: 'sunweaver-lumen-guard',
  status: 'draft',
  source: { kind: 'reference-image', path: 'reference.png' },
  target: { cellW: 64, cellH: 64, cols: 8, rows: 2, frameCount: 16 },
  integrity: { candidateSha256: 'a'.repeat(64) },
};
const approved = approveCandidateManifest(draft);
assert.equal(draft.status, 'draft', 'approval must not mutate the caller manifest');
assert.equal(approved.status, 'approved');
assert.deepEqual(
  { ...approved, status: 'draft' },
  draft,
  'approval must preserve every field except status',
);
assert.notEqual(approved, draft, 'approval must return a fresh object');
assert.equal(approveCandidateManifest(approved).status, 'approved', 'approval must be idempotent');
assert.throws(() => approveCandidateManifest(null), /manifest must be an object/);
assert.throws(() => approveCandidateManifest({ status: 'rejected' }), /status must be draft or approved/);

const canonical = canonicalApprovalJson(approved);
assert.equal(canonical, `${JSON.stringify(approved, null, 2)}\n`);
assert.ok(canonical.endsWith('\n'), 'canonical approval JSON must end with one newline');

console.log('FAL acceptance candidate-status contract: PASS');
