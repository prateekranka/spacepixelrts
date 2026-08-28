# R2 Review — Pixels & Metrics (Forge Art Lab v1)

Reviewer: R2 (pixels & metrics) · Date: 2026-08-26 · Repo: `spacepixelrts-forge-art-lab`
Scope: metrics library calibration, frozen digests, mirror pairs, baseline artifact hashes, gate false-pass analysis, sandbox preservation.
Methods: independent recomputation (own node:crypto + pngjs extraction), code reading, live test runs. Verification script kept at `tasks/forge-art/reviews/r2-verify.mts` (reviewer-owned).

---

## 1. Calibration test — `tests/forge-art-metrics.test.ts` — PASS (verified by running)

`npx tsx tests/forge-art-metrics.test.ts` → `FAL metrics calibration + published ranges: PASS`, `calibrationCells: 48`, `alphaRange: [1265,1684]`, worker ground contact stable at row 47, `bottomGapMax: 0`.

Test-read confirmation (does it truly check all 48 digests?):
- [NIT] — Line 113 asserts the table holds exactly 48 keys; the draw loop (lines 117–133) renders all 64 cells via `drawCombatSprite(row,dir,pose)` wrapped in `metrics.pixView`, and asserts `imageSha256(cell) === FROZEN_R3_CELL_SHA256["r:d:p"]` for rows 0,1,3 — exactly the 48 frozen keys, each checked once, against the library's own `imageSha256`. Row 2 is intentionally unfrozen (VS4A replacement row) — documented in the test.
- Caveat: the table is a hand-copied mirror of `tests/vs4-combat-assets.test.ts`'s table; both could be wrong identically. Mitigated below (spot digests recomputed independently) and by the VS-4 oracle file, which I confirmed contains the identical digests (spot-checked `0:0:0`, `1:0:1`, `3:2:0`, `3:6:0`).

## 2. Independent spot digests — PASS (all 3 match both frozen table and metrics.ts)

My own `node:crypto` sha256 over the raw RGBA stream of `drawCombatSprite` (no tool function reuse):

| cell | my digest | frozen | metrics.imageSha256 |
|---|---|---|---|
| row0 dir3 pose1 | b46c042d…236b67 | b46c042d…236b67 ✓ | b46c042d…236b67 ✓ |
| row3 dir6 pose0 | ca032215…09c45 | ca032215…09c45 ✓ | ca032215…09c45 ✓ |
| row1 dir0 pose1 | 2bc28f9b…0dd0a4 | 2bc28f9b…0dd0a4 ✓ | 2bc28f9b…0dd0a4 ✓ |

## 3. Mirror pairs — declared pairs all hold; E/W pair is a finding

Verified for all 4 rows × 2 poses via BOTH manual array reversal and `metrics.isMirrorPair` — 100% agreement between the two methods:
- [PASS] Declared pairs `[1,3]`, `[0,4]`, `[7,5]` (registry `UNIT_MIRRORS`, test lines 165–172): every check holds.
- [MINOR — art observation, NOT a false pass] `dir2`/`dir6` are NOT mirror images in any row: `flipX(dir2) ≠ dir6` everywhere. In rows 1 (solar strider) and 3 (burden walker), `dir6` is byte-identical to `dir2` (frozen digests `1:2:x == 1:6:x`, `3:2:x == 3:6:x`) while the image is not self-symmetric (`flipX ≠ self`), so those units visibly face E in both E and W facings. Rows 0/2 have distinct non-mirrored bitmaps. Consistent with `authoredFacings=5` + declared pairs (2/6 are separately authored, not mirror-contracted), so no gate is bypassed — but the W-facing reuse is worth an art-direction call.

## 4. Baseline artifacts — PASS (3 assets, own extraction)

Wrote my own PNG cell-region extractor (pngjs row-copy + node:crypto; geometry from registry, since on-disk accepted `manifest.json` is the slim evidence record — only schemaVersion/assetId/label/faction/category/revision/frames/createdAt, no cellLayout):
- `sunweaver-lumen-guard`: 16/16 frame hashes match manifest AND registry; `baseline.png` file sha and `manifest.json` file sha both match `registry.json`.
- `gravemark-worker`: 16/16 match (32×48 cells, walk-major grid); file hashes match.
- `sunweaver-core`: 1/1 match; file hashes match.
- [NIT] Note the on-disk manifest omits `cellLayout`/`source`/`paletteStats`/`gates` required by `baseline-schema.validateBaselineManifest` — the full-shape manifest only exists in the out-of-repo evidence path (`forge-art-baseline.mjs` writes it to `--out`). The accepted record is intentionally slimmed; validation of it is impossible with the schema function, so freshness/validation of accepted records relies on registry.json hashes. Works today; slightly confusing contract split.

## 5. False-pass / false-fail risk audit — `tools/forge-art/src/workbench.ts` computeGates (538–747) + computeStatus (779–792)

- [PASS] No inverted pass conditions found; all 12 gate expressions compare in the correct direction.
- [PASS] NaN cannot make any gate vacuously true: every NaN-capable metric (`averageLuma`, `silhouetteIou`, `meanRgbaDelta`, `poseDeltaPercent`, `brightMaterialShare`, `rimLayerShares`) yields `NaN` comparisons that are false → fail-closed. `meanOf`/`minOf` propagate NaN; the `length > 0` guards only protect against empty frame lists. Empty-image frames hard-fail rather than silently pass.
- [PASS] Advisory vs hard: `computeStatus` fails the chip only on `g.proven && !g.pass`; advisory rows (`worker`/`scout`/`building` classes, `proven=false`, pass-everything thresholds) can never produce OBJECTIVE FAIL — correct per thresholds.ts header. `naRow` rows are `pass=true, proven=false` — cannot fail.
- [MINOR] Silhouette-overlap vacuous pass: `worst` starts at 0 and stays 0 when no sibling candidate is available (sibling frame error or missing), so `worst < 0.78` passes silently with note "no sibling". For proven combat class this means a broken sibling render turns the gate into a guaranteed pass. Low likelihood (own frames already PARTIAL-capped; sibling errors aren't), but it is a genuine vacuous-pass path.
- [MINOR] Gate rows silently disappear on frame errors: if `imgs[0]`/`imgs[2]`/`imgs[8]` are null (paint error), the pose-delta / N/E rows are never pushed rather than shown as failed/na — the error only surfaces via the PARTIAL chip. Acceptable, but a row-level gap.
- [MINOR] `lumaFloor=90`, `brightShareMin=0.30`, `rimOuter/InnerShareMin=0.85` are marked `proven: true` for combat but are NOT asserted by the VS-4 oracle (VS-4 only console-prints those ranges; hard asserts cover connected≥0.96, alpha bounds 24×44/44×28, poseDelta (4,45), N/E>18, IoU<0.78, magShare) and NOT re-calibrated by the metrics test. They rest on a single measured snapshot — if the painter drifts, these gates can hard-fail (false-fail risk) or quietly pass without any oracle. Either re-calibrate in `forge-art-metrics.test.ts` or mark advisory.
- [NIT] `magShareRuntimeMax: 0` in thresholds is never read by any gate (dead field; no runtime-MAG gate exists).
- [NIT] alpha-coverage aggregates the MEAN across frames (connected/bright use MIN) — one bad frame can be masked by the mean for the alpha band.

Gate pair correctness (frame order): `combatFrameKeys()` is pose-major (`dir0-pose0…dir7-pose0, dir0-pose1…`), so `imgs[0]` vs `imgs[8]` IS the true pose pair and `imgs[2]` vs `imgs[0]` IS dir2-vs-dir0 N/E — workbench and metrics test agree. Confirmed against registry + baseline grid (8 cols × 2 rows).

## 6. Unrelated-cell preservation — `tests/forge-art-pipeline.test.ts` — PASS with scope caveat

`npx tsx tests/forge-art-pipeline.test.ts` → `FAL pipeline contract: PASS`; determinism + manifest validation + content-seam checks all green.
- What it proves: re-rendering all 14 assets' candidate frames with the lumen sandbox override applied changes lumen frames (16/16) and leaves the other 13 assets byte-identical (88 frames verified via the `OTHER_IDS` loop).
- [MINOR — scope hole] The proof is at the in-memory candidate level, not the committed artifact level: it never touches `tools/forge-art/baselines/*`. There is no pre/post baseline pair in git history (all 14 baselines accepted in one `--init` commit 2c1d9ef), so "the artifacts differ ONLY in lumen cells" is not provable from history at all. The other-13 check is also near-tautological: `getSandboxOverride` returns null for every other asset, so the test's real value is proving the transform has no shared-state side effects — which code reading confirms (pure, allocates a fresh `Pix`, never mutates input).
- [NIT] Log line `all 103 frames…` is computed via `[...sandboxed.values()].filter((_, i) => i !== 0)` — relies on catalog order; CATALOG sorts gravemark-core first, so the printed 103 actually = 104 total − 1 (gravemark-core), i.e. it silently includes lumen's 16 frames in the "other assets" count. Cosmetic only; the real verification loop uses id-based `OTHER_IDS` and is correct.

---

## Verdict

**MATERIAL: none.** All six verification areas pass; the 48-digest calibration, spot digests, declared mirror pairs, and baseline artifact hashes are genuine and reproducible. The failures found are MINOR robustness/claim-scope items (vacuous silhouette pass path, uncalibrated-but-proven luma/bright/rim thresholds, sandbox proof limited to candidate level, dir2/dir6 non-mirror / W-facing reuse), plus NITs. No false pass is currently reachable through the gates under normal operation.
