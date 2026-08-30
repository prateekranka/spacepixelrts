# A6 — Baseline & Change Model Audit

**Auditor:** A6 · **Repo:** `spacepixelrts-forge-art-lab` · **Date:** 2026-08-26
**Status:** Read-only analysis + design spec. No repo mutations made.
**HEAD at audit time:** `ced0b94` (worktree clean).

This audit specifies the immutable ACCEPTED BASELINE system for Forge Art Lab: artifact schema,
directory layout, candidate diff model, acceptance command algorithm with exit codes, malformed/
partial behavior, and the threat model keeping baselines dev-only.

---

## 0. Ground truth established from the repo

| Source | Fact |
|---|---|
| `tests/vs4-combat-assets.test.ts` L45–96, L264–266, L606–609 | Frozen hashes are `sha256` over the **full Pix RGBA byte array** (`p.d`), keyed `row:dir:pose`. Rows **0, 1, 3 are frozen (48 cells)**, key `'0:0:0'`..`'3:7:1'`. |
| same, L607 comment + `docs/VS4_RIFT_GUARD_REBUILD.md` L14–17 | **Row 2 is the VS4A replacement**: R3 Rift Guard failed readability ("more scale/tint cannot create anatomy"); VS4A replaced only row 2's authored core layout. Every other unit must stay byte-identical. |
| `docs/VS1_COMBAT_ASSETS.md` L71–74 | Row→unit map: row0 Lumen Guard, row1 Solar Strider, row2 Rift Guard, row3 Burden Walker. Pose 0 = idle/live frame 0; pose 1 = walk frames 1/2 + attack 3. |
| `scripts/qa-vs4-combat-assets.mjs` L559–566 | `cellSha256(png, originX, originY)` — extracts CELL×CELL×4 RGBA bytes from the PNG region and hashes; **byte-equivalent** to the in-memory test hash for the same cell pixels. |
| same, L16, L112–121, L930–934 | `CELL=64`, atlas 1024×256 (4 rows × 8 cols). Evidence exports go to `--out` which **must be absolute and outside the repo** (`resolveOut` rejects in-repo paths). |
| `package.json` | Conventions: `tsx` for tests (`test:vs4`), `node` for QA scripts (`qa:vs4`). **No `forge:*` scripts exist yet** — this audit proposes them. `pngjs ^7.0.0` is a devDependency. |
| `vite.config.ts` L10–16 | Build inputs are exactly `index.html`, `desktop.html`, `town-center-viewer.html`. Nothing under `tools/` is an input or imported by `src/` → **baselines can never be bundled**. |
| `.gitignore` | `dist/` ignored; no `tools/` entry → baselines under `tools/forge-art/` are intentionally **tracked in git** (dev-only, in-repo). |
| `docs/VS1_COMBAT_ASSETS.md` L135–154 | Evidence conventions: exports outside repo; automated checks (alpha 12–55%, no empty cell, N-vs-E delta >18, frame delta 4–45, silhouette IoU <78%, emissive 0.5–5%, no magenta survivors). |

**Empirically verified (node, pngjs 7):** `PNG.sync.write` on identical RGBA buffers produces
byte-identical files (two writes → `deterministic: true`), round-trips RGBA exactly, and writes
**no `tIME` chunk** (no timestamps). pngjs output is fully deterministic given (buffer, dims,
colorType, pngjs version); it never embeds wall-clock time or random data.

---

## 1. Baseline artifact schema

**Decision: ONE baseline PNG per asset + ONE manifest.json per asset.**
Rationale: the combat atlas already proves a 64px-cell grid works; a single PNG lets hashes be
re-derived from the file itself with the exact `cellSha256` PNG-region algorithm (qa script L559),
keeps git history clean, and makes `--apply` a two-file atomic swap. Per-cell files (17 files per
asset) add no integrity value — the per-frame hashes live in the manifest either way.

### Layout inside one baseline.png (canonical grid)

Per-asset grid derived from the source's `dirs × poses` matrix (combat assets: 8 dirs × 2 poses):

- `baseline.png` = `(dirs × CELL) × (poses × CELL)` = **512×128** for a 16-cell combat asset
- Cell order: **dir-major** (`dir0-pose0`, `dir0-pose1`, `dir1-pose0`, … `dir7-pose1`)
- Cell origin for frame `dir N, pose P`: `originX = N * CELL`, `originY = P * CELL`
- Hash of every cell is re-derivable from the PNG alone via the qa-script algorithm → baseline is
  independently verifiable without invoking the generator.

### manifest.json schema (schemaVersion 1)

```jsonc
{
  "schemaVersion": 1,
  "assetId": "rift-guard",                    // kebab-case, unique
  "canonicalLabel": "Gravemark Fighter / Rift Guard",   // docs/VS1 L71-74 naming
  "faction": "gravemark",                     // sunweaver | gravemark
  "category": "combat-unit",                  // combat-unit | building | terrain ...
  "revision": "ced0b94",                      // git SHA of src/ at generation (short or full)
  "createdAt": "2026-08-26T12:00:00.000Z",    // ISO-8601, informational only (never hashed into frames)
  "source": { "adapter": "procedural-pix", "dims": [512, 128] },
  "cellLayout": { "cellSize": 64, "cols": 8, "rows": 2, "order": "dir-major", "dirs": 8, "poses": 2 },
  "anchor": { "x": 32, "y": 63 },             // ground-contact point in cell-local pixels
  "worldScale": { "x": 1.67, "y": 1.92 },     // VS1 instance scale (unchanged by VS4A)
  "frames": [
    { "key": "dir0-pose0", "sha256": "d7741fab...", "alphaPixels": 1414 }
    // ... 16 entries; key scheme: `dir<d>-pose<p>`; sha256 = cellSha256 over the PNG region,
    // byte-equivalent to the test's sha256 over Pix.d (row:dir:pose keyed)
  ],
  "cells.pngPath": "baseline.png",            // relative to manifest; the single per-asset PNG
  "paletteStats": {
    "uniqueColors": 14,
    "alphaPixels": 22310, "alphaCoverage": 0.212,       // VS1 gate 12–55%
    "averageLuma": 96.4, "brightMaterialShare": 0.021,  // emissive 0.5–5% gate
    "rimOuterShare": 0.18, "rimInnerShare": 0.11,
    "magShare": 0.0, "directionDeltaMin": 19.2, "poseDeltaMin": 5.1,   // >18 / 4–45 gates
    "silhouetteOverlapMax": 0.71,             // <78% gate
    "sourceHeight": 52                        // row0 spear-to-foot <=52px
  },
  "thresholdsUsed": {
    "alphaMin": 0.12, "alphaMax": 0.55, "nVsEDeltaMin": 18,
    "frameDeltaMin": 4, "frameDeltaMax": 45, "silhouetteOverlapMax": 0.78,
    "emissiveMin": 0.005, "emissiveMax": 0.05, "lumaFloor": 90,
    "magKey": [255, 0, 255, 255]
  },
  "gates": { "readability": true, "anatomy": true, "frozenRowsIntact": true }
}
```

Notes:
- **Determinism guarantee** (verified above): baseline.png bytes depend only on the RGBA grid +
  pngjs version. `createdAt` is excluded from any hash; frames hash only cell bytes.
- `revision` pins the exact source SHA; a baseline is only valid for that SHA (see §4 V5).
- `thresholdsUsed` snapshots gate values so a future threshold change is visible as a diff, not a
  silent re-baseline.

---

## 2. Directory layout & atomic `--apply`

```
tools/forge-art/
  baselines/
    registry.json                 # single source of truth for ALL accepted baselines
    rift-guard/
      baseline.png                # 512x128 grid of 16 cells
      manifest.json               # schema above
    lumen-guard/
      baseline.png
      manifest.json
    solar-strider/  ...           # one dir per accepted asset; every asset dir is self-contained
    burden-walker/  ...
```

### registry.json (schemaVersion 1)

```jsonc
{
  "schemaVersion": 1,
  "assets": {
    "rift-guard": {
      "revision": "ced0b94",            // source SHA the baseline was accepted at
      "acceptedAt": "2026-08-26T12:00:00.000Z",
      "manifestSha256": "a1b2...",      // hash of manifest.json bytes
      "baselinePngSha256": "c3d4...",   // hash of baseline.png bytes
      "frameSha256": { "dir0-pose0": "d774...", "...": "..." }   // mirror of manifest.frames
    }
    // ... every other asset, untouched by any single-asset accept
  }
}
```

### `--apply` atomic swap (EXACTLY one asset)

1. Generate new `baseline.png` + `manifest.json` for the target asset into the target dir's
   **temp files** (`manifest.json.tmp`, `baseline.png.tmp` — same filesystem ⇒ atomic rename).
2. `fs.renameSync(tmp → final)` for both files (per-file atomic on POSIX).
3. Re-hash the written files from disk; abort-and-rollback if they don't match the intended bytes.
4. Rebuild `registry.json` **from the previous registry object**, replacing only the target
   asset's entry; serialize and write via `registry.json.tmp` + rename.
5. Verify: re-read registry; every non-target entry must be byte-identical to before (compare
   against pre-image in memory) — otherwise restore from `.tmp` and exit 6.
6. No other directory under `baselines/` is ever listed, opened for write, or touched.

### Production-bundle exclusion (verified, belt + suspenders)

- `vite.config.ts` build inputs are only the three HTML entries; `tools/` is never an input and
  never imported by `src/` → baselines physically cannot reach `dist/`.
- `.gitignore` already excludes `dist/`; baselines remain tracked in-repo (dev-only path).
- **Guard (new, cheap):** add a `forge:baseline:verify-dist` step to the build pipeline that scans
  `dist/` for `baseline` / `registry.json` and fails the build if found — turns the exclusion
  property into a tested invariant instead of a hope.

---

## 3. Candidate diff model

The candidate is the **current source output** (`src/sprites` procedural renderer), generated by
the CLI into a temp grid and hashed per frame with the same `cellSha256` algorithm. Compare is
candidate-vs-accepted (baseline manifest).

```jsonc
{
  "assetId": "rift-guard",
  "baselineRevision": "ced0b94",
  "candidateRevision": "c0ffee1",
  "otherAssetsUnchanged": { "lumen-guard": true, "solar-strider": true, "burden-walker": true },
  // RULE: for an isolated asset change, every OTHER registered asset must be true.
  // Any false here is drift, not part of this change.
  "changedCells": [
    {
      "key": "dir0-pose0",
      "acceptedSha": "d7741fab...", "candidateSha": "e5a2...",
      "differingPixelCount": 37,                  // RGBA bytes differing, /4
      "alphaBoundDelta": { "minX": 10, "minY": 12, "maxX": 51, "maxY": 55, "count": 33 },
      // bounding box of ALL differing pixels + count of differing ALPHA states (added/removed alpha)
      "changedAlpha": { "added": 18, "removed": 15 }
    }
  ],
  "unchangedCells": [ "dir1-pose0", "dir1-pose1", /* ... 12 more */ ],
  "addedCells":   [],          // key present in candidate, absent in accepted manifest
  "removedCells": [],          // key present in accepted manifest, absent in candidate
  "atlasRegionAffected": "row2"   // atlas-row/region the asset occupies (combat strip: row N)
}
```

Semantics:
- `changedCells`/`unchangedCells` partition the accepted frame set; `addedCells`/`removedCells`
  catch pose/direction-set changes (e.g. a new attack pose).
- `differingPixelCount` counts RGBA quads that differ; `alphaBoundDelta` gives the spatial extent
  of the change plus exact alpha-state flips — enough to eyeball "rim-only touch" vs "core rewrite".
- `otherAssetsUnchanged` is computed by re-deriving every other registered asset's frame hashes
  from its stored `baseline.png` and comparing against `registry.json` **and** against the
  candidate run — an isolated change must show all-true, or compare refuses (exit 6).

---

## 4. Acceptance command algorithm

CLI: `node tools/forge-art/baseline-accept.mjs --asset <assetId> --evidence <path> [--apply]`

- `--evidence` is a proof manifest produced by the QA/export run (qa-vs4-style, written **outside
  the repo** per `--out` convention) containing `metrics.candidateHashes` and the gate results.
- **Dry-run is the default.** Without `--apply` the tool prints the full planned replacement
  (every frame hash old→new, diff summary, registry delta) and exits 0 **without writing anything**.

### Validation order (all must pass before ANY write)

| # | Check | Fail → |
|---|---|---|
| V1 | CLI shape: `--asset` + `--evidence` present, assetId kebab-case | exit 2 (usage) |
| V2 | `baselines/<assetId>/` exists with `baseline.png` + `manifest.json` decodable (dims match `cellLayout`) | exit 7 (MISSING BASELINE) |
| V3 | `assetId` present in `registry.json`; registry parses | exit 8 (unknown asset) / exit 1 (malformed registry) |
| V4 | Evidence parses; `evidence.schemaVersion === 1` and matches tool's supported version | exit 1 (unsupported/malformed evidence) |
| V5 | **Freshness:** `evidence.sourceRevision === current HEAD SHA` **and** `git status --porcelain` is empty **or** lists only the candidate artifact file the user declares | exit 3 (stale evidence) |
| V6 | Every `evidence.gates.* === true` (readability, anatomy, frozenRowsIntact, alpha/emissive/delta gates) | exit 4 (failed gate) |
| V7 | Recompute candidate hashes from current source; every frame must equal `evidence.metrics.candidateHashes[key]` | exit 5 (hash mismatch) |
| V8 | `evidence.unrelatedAssets` lists every other registered asset; tool re-derives each from its stored baseline.png and confirms equality with registry AND candidate run | exit 6 (unrelated asset drift) |
| V9 | Print planned replacements (dry-run) | exit 0, no writes |

### With `--apply`

Re-run V1–V8 in-process, then execute the §2 atomic swap for exactly one asset, verify post-write
disk hashes, print a summary (old revision → new revision, N changed frames), exit 0.

### Refusal cases (exit codes, stable contract)

| Exit | Meaning |
|---|---|
| 0 | Dry-run: planned replacements printed, nothing written / Apply: committed |
| 1 | Malformed evidence, malformed registry, or unsupported schemaVersion |
| 2 | Usage error (missing/invalid args) |
| 3 | **Stale evidence** — evidence generated at a different source revision than HEAD, or worktree not clean as allowed |
| 4 | **Failed gate** — at least one gate flag false in evidence |
| 5 | **Hash mismatch** — recomputed candidate ≠ evidence.candidateHashes |
| 6 | **Unrelated asset drift** — another registered asset's accepted hashes no longer verify |
| 7 | **MISSING BASELINE** — no accepted baseline for the asset (compare blocked) |
| 8 | Asset not in registry |
| 9 | Partial candidate — one or more frames failed to generate (compare reports PARTIAL, accept refused) |
| 10 | Post-write verification failed (rollback attempted; disk state flagged) |

---

## 5. Malformed / partial behavior spec

| Situation | Behavior |
|---|---|
| Baseline dir missing | Tool reports `MISSING BASELINE` for the asset; `compare`/`accept` blocked with exit 7; all other assets still list their status. Never auto-creates a baseline. |
| Baseline dir present but `baseline.png` undecodable / dims ≠ `cellLayout` | Treated as `INVALID BASELINE` (same block as MISSING, distinct message); manifest hashes cannot be re-derived from the PNG, so nothing is trusted from it. |
| Registry missing/corrupt | Every operation refuses with exit 1 and names the file; no implicit registry rebuild (that would be a write). |
| Partial candidate (source throws for one frame) | **Per-frame error capture**: the generator wraps each frame; failures land in `failedFrames: [{key, error}]`, all other frames still hash and compare. The tool never crashes mid-run. Compare reports `PARTIAL` (exit 9) and `accept` refuses until every frame generates — a baseline with missing frames would silently weaken the contract. |
| One cell out of bounds (grid smaller than expected) | Same per-frame capture; key reported as `atlasRegionAffected` overflow, exit 9. |
| Evidence referencing frames not in the asset (or vice versa) | Diff model surfaces them as `addedCells`/`removedCells`; acceptance requires the frame-set to match the asset's `dirs × poses` contract exactly, else exit 4. |

---

## 6. Threat model

1. **The browser can never write baselines.** The dev server exposes no save/accept endpoint; the
   QA page hook (`__STARHAVEN_QA__`) is read/export only, and its export path (`--out`) is
   **enforced to be absolute and outside the repo** (`resolveOut`, qa script L112–121), so even a
   compromised page cannot reach `tools/forge-art/baselines/`. Only the CLI
   `baseline-accept.mjs --apply` (invoked by a human or CI) can mutate baselines, and only after
   V1–V8 pass.
2. **HMR must not auto-regenerate accepted baselines.** Baseline generation/acceptance is purely
   explicit CLI action (`forge:baseline:*` scripts). No Vite plugin, watcher, or dev-server hook
   writes to `tools/`. Editing `src/sprites` changes the **candidate** only; the accepted baseline
   and registry stay byte-identical until an explicit `--apply`. HMR reloads code; it never
   triggers fs writes.
3. **Isolation by construction.** `--apply` swaps exactly one asset dir + one registry entry
   (§2), and V8 proves all other assets unchanged before any write — a corrupted or malicious
   candidate cannot smuggle unrelated changes into the accepted set.
4. **Evidence chain.** Proof manifests are produced outside the repo (VS1 convention), carry the
   source revision, and are re-verified by recomputation (V7) — acceptance never trusts a manifest
   on faith.
5. **Production exclusion.** Build inputs are only the three HTML entries; a `verify-dist` guard
   (§2) makes "no baselines in the bundle" a failing-check invariant rather than a convention.

---

## Proposed package.json additions (conventions: `node` scripts, matching `qa:*` style)

```jsonc
"forge:baseline:generate": "node tools/forge-art/baseline-generate.mjs",
"forge:baseline:compare":   "node tools/forge-art/baseline-compare.mjs --asset",
"forge:baseline:accept":    "node tools/forge-art/baseline-accept.mjs --asset",
"forge:baseline:verify-dist": "node tools/forge-art/verify-dist.mjs"
```
