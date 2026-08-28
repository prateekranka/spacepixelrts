#!/usr/bin/env node
/** Pure candidate-manifest promotion helpers shared by acceptance and tests. */

export function approveCandidateManifest(manifest) {
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('candidate manifest must be an object');
  }
  if (manifest.status !== 'draft' && manifest.status !== 'approved') {
    throw new Error('candidate manifest status must be draft or approved');
  }
  return { ...manifest, status: 'approved' };
}

export function canonicalApprovalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
