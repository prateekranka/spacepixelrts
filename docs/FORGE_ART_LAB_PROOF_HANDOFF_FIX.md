# Forge Art Lab — proof-to-accept handoff repair

Status: **ACTIVE DEFECT CONTRACT**. Piece: `FAL-HANDOFF`.

## Defect

Forge Art Lab v1 is visually and mechanically green, but its public proof-to-promotion seam is not executable:

1. `npm run forge:art:proof`, `forge:art:baseline`, and `forge:art:accept` invoke plain `node` while their scripts import TypeScript modules through extensionless paths. The public proof command exits with `ERR_MODULE_NOT_FOUND`.
2. `forge-art-proof.mjs` writes a proof `manifest.json` without the acceptance schema fields required by `forge-art-accept.mjs` (`schemaVersion`, `sourceRevision`, `declaredDirtyFiles`, `gates`, `failedFrames`). Its `metrics` value is also keyed by asset ID, while acceptance reads `metrics.candidateHashes` directly.
3. `qa:forge-art` verifies proof generation and synthetic acceptance refusals separately. It does not run the generated proof through the real dry-run acceptance command. The broken handoff therefore passes QA.

## Scope

Repair only the public CLI and generated-evidence handoff. Do not change visual assets, accepted baseline pixels, runtime simulation, renderer behavior, game UI, or production build inputs.

Allowed implementation files:

- `package.json`
- `scripts/forge-art-proof.mjs`
- `scripts/forge-art-accept.mjs`
- `scripts/qa-forge-art.mjs`
- focused Forge Art Lab test files when required

This contract file and `PROGRESS.md` are lead-owned.

## Required behavior

### Public commands

All three commands must execute from the package scripts without an external wrapper:

```bash
npm run forge:art:proof -- --asset=sunweaver-lumen-guard --out=<absolute-dir-outside-repo>
npm run forge:art:baseline -- --asset=sunweaver-lumen-guard --out=<absolute-dir-outside-repo>
npm run forge:art:accept -- --asset=sunweaver-lumen-guard --evidence=<absolute-proof-manifest>
```

Use the repository's installed `tsx` runtime. Do not duplicate or transpile production modules.

### Single-asset proof manifest

The generated `manifest.json` must remain useful to current proof consumers and must also be directly consumable by `forge:art:accept`.

It must include, at minimum:

- `schemaVersion: 1`
- `tool: "forge-art-proof"`
- `sourceRevision` equal to the proof's Git revision
- `declaredDirtyFiles` equal to the proof's recorded dirty-file list
- `assetId`
- `gates`: a non-empty boolean map for proof-integrity gates and all applicable proven objective gates
- `failedFrames`: frame keys that failed generation
- candidate hashes for the selected asset
- the existing capture, Git, error, production-isolation, and change-report data

Acceptance may normalize either a direct metrics object or the existing asset-keyed metrics object, but there must be one documented and tested path from the generated manifest to the candidate hashes.

### Gate safety

- `forge:art:accept --apply` must refuse an empty or absent `gates` object.
- A generated single-asset proof must include non-empty gates.
- Gate booleans must include proof completeness, zero browser/page errors, production isolation, no failed frames, and all applicable **proven** objective gates.
- Advisory rows must remain advisory and must not silently become hard failures.
- Do not fabricate a critic verdict or lead approval in the manifest.

### Dry-run handoff

This exact sequence must exit zero and write no baseline or registry bytes when current candidate and source are unchanged:

```bash
npm run forge:art:proof -- --asset=sunweaver-lumen-guard --out=<fresh-out>
npm run forge:art:accept -- --asset=sunweaver-lumen-guard --evidence=<fresh-out>/manifest.json
```

Dry-run output must name the selected asset, changed-frame count, destination baseline files, and state that nothing was written.

### QA regression

Extend `qa:forge-art` so it:

1. invokes the **public npm proof command**, not a private `tsx` shortcut;
2. validates the acceptance fields in the generated manifest;
3. runs dry-run acceptance using that exact generated manifest;
4. proves baseline PNG, accepted manifest, and registry hashes/mtimes are unchanged;
5. retains the stale, failed-gate, hash-mismatch, unrelated-drift, and sandbox refusal checks.

A QA pass that does not exercise the generated proof-to-dry-run handoff is invalid.

## Definition of done

- Focused RED exists before the repair and fails for the current public command/schema handoff.
- Public proof, baseline, and acceptance commands resolve TypeScript imports.
- Generated proof -> real dry-run acceptance exits 0 and writes nothing.
- Empty gates are refused.
- `npm run test:forge-art`, `npm run forge:art:typecheck`, `npm run forge:art:build`, and `npm run qa:forge-art -- --out=<absolute-dir>` pass.
- `npm run build` and production-isolation checks pass.
- `src/sim.ts`, `src/engine.ts`, accepted baseline PNGs, and accepted baseline manifests remain byte-identical.
- No Vite, Chromium, or helper process leaks.
