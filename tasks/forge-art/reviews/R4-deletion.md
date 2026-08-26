# R4 — First-Principles Deletion Review (Forge Art Lab v1)

Reviewer: R4 · 2026-08-26 · READ-ONLY (this file is the only write)
Repo: `spacepixelrts-forge-art-lab` · Scope floor: `docs/FORGE_ART_LAB.md` §2 non-goals + `tasks/forge-art/audits/A8-scope-deletion.md` §1

Method: read all of `tools/forge-art/src/*.ts` (7,873 lines incl. scripts), `scripts/forge-art-{lib,baseline,baseline-init,accept,proof}.mjs`, `scripts/qa-forge-art.mjs`, the three pure suites (`tests/forge-art-{registry,metrics,pipeline}.test.ts`), `index.html`, `rig.html`. Every candidate was cross-checked with grep for importers/callers before classification.

## 0. Loop floor (what must survive)

select → inspect → edit source → save/HMR → compare accepted vs candidate → objective gates → proof pack → accept. Everything below is measured against that loop plus the frozen-contract text.

---

## 1. Deletable now — zero risk, nothing lost (MATERIAL)

### M1. Dead metrics exports — ~470 LOC (`metrics.ts`)
Exported, **never imported or called anywhere** (workbench, scripts, tests): `alphaAt`, `alphaInRows`, `rec709Luma`, `maxLuma`, `litRatio`, `isEmptyOrBlack`, `hasCorePath`, `longestColorRun`, `polearmSpan` (+`Span` iface), `rgbaEqual`, `facingVariance`, `facingBoundsSwim`, `facingCentroidSwim`, `colorShare`, `teamColorShare`, `exteriorTransparency`, `coreMask`, `coreMinY`, `coreAlphaInRows`, `bodyTop`, `regionSha256` (imported by `workbench.ts` but never called). The metrics calibration test resolves exactly 19 functions by name (`imageSha256, alphaCount, sourceBounds, averageLuma, primaryComponentShare, meanRgbaDelta, silhouetteIou, poseDeltaPercent, magShare, flipX, isMirrorPair, maskBox, boxWidth, boxHeight, maskComponents, boxCoordinates, groundContactRow, bottomGapRows, pixView`) — none of the M1 list is among them, and `qa:forge-art` never touches them.
- Behavior lost: **nothing** in code. Caveat: spec §10 enumerates these as "A2 signatures verbatim", so deletion needs a one-line spec amendment (§10 list trimmed to the 19 tested + workbench-consumed). No test, no QA step, no gate recomputes them.
- `jsSha256` is **not** dead: it is the browser fallback path of `sha256Bytes` (workbench `publishProbe` runs it in-browser). Keep.

### M2. Dead threshold data — ~40 LOC (`thresholds.ts`)
Fields never read by any consumer: `magShareRuntimeMax`, `swimMax`, `occupancyMin/Max`, `groundContactMin`, `buildingCoverageHallMin`, `buildingCoverageSmallMin` (7 fields × 4 entries + interface). The `advisory: boolean` field is also dead — `workbench.ts` renders WARN from `g.proven` only; `advisory` is exactly `!proven` (perfectly anti-correlated in all 4 rows), so one flag is redundant.
- Behavior lost: none — no gate computes swim/occupancy/ground-contact/building-coverage today (spec §10's "advisory failures render as WARN" is only half-implemented; the rows never exist). Spec amendment: trim §10 advisory list.
- Also flags a spec-vs-code gap worth one line in PROGRESS.md: advisory gates listed in §10 are **not implemented as rows** in `computeGates`.

### M3. Dead adapter exports — ~40 LOC (`adapters.ts`)
`combatRow()`, `worker8()`, `workerActions()`, `scoutHd()`, `building()` are exported, documented as the §4 adapter surface, and **imported by nothing** — all four CLI scripts, the workbench, and all three tests go through `getFrames()` (test-pinned). Also `paintFrame`'s `default: throw` ("adapter not implemented") is unreachable: `AdapterId` has exactly 4 members, all handled, and the spec's reserved `raster-atlas`/`glb-bake` adapters are registered nowhere.
- Behavior lost: none (getFrames covers every path, incl. the 'actions' group). Spec §4 text names these functions — amend §4 to say "the exported surface is `getFrames` + `getSandboxOverride`".

### M4. Dead `composeSheet` — ~41 LOC (`views.ts` + `workbench.ts`)
`composeSheet` is exported and imported by `workbench.ts` but **never called**; all real sheet composition happens in `forge-art-proof.mjs`'s inline composer page. `workbench.ts` also imports `regionSha256` without calling it (see M1).
- Behavior lost: none. Keep `sheetBytes` (used by `publishProbe`, QA-hash-pinned) and `applyPass`/`drawCellTo`/`diffImages` (stage-pinned).

### M5. Dead registry helpers — ~10 LOC (`registry.ts`)
`labelOf()` (7 LOC, no callers) and the lowercase `catalog` alias (2 LOC; tests resolve `CATALOG ?? catalog`, so they pass with `CATALOG` alone).
- Behavior lost: none.

---

## 2. Duplication to consolidate — ~95 LOC saved (MATERIAL)

All four CLI scripts + QA already import `scripts/forge-art-lib.mjs`; it is the single shared module that absorbs these **without coupling** (node-side only; `workbench.ts`'s browser cell-slice stays in TS):

| Duplicated helper | Copies | Lines each | Save |
|---|---|---|---|
| `renderGridPng(frames, geo)` — byte-identical in `forge-art-baseline.mjs` (41–59) and `forge-art-accept.mjs` (269–287); `writeSourceSheet` in `forge-art-proof.mjs` (366–384) is the same loop + write | 3 | 19 | ~38 |
| PNG cell extraction (row-strided region copy): `hashesFromPng` (accept 57–76), `acceptedCells` (proof 52–73), plus `workbench.ts` `BaselineData.cell()` (browser, keep local) | 3 | ~20 | ~30 (2 node copies → `sliceCells(png, geo)` in lib) |
| git helpers: `gitRevision()` ×3 (baseline, accept, baseline-init), `gitInfo()` (proof), `gitRevision`+`gitDirtyFiles` (qa) | 5 | 4–9 | ~20 |
| alpha-pixel counting: `countAlpha` (accept 263–267) + inline loops (baseline 103, baseline-init 43) | 3 | 2–5 | ~6 |
| `sha256Buffer` (proof 348–350) re-implements lib's `sha256Bytes` | 2 | 3 | 3 |

The task premise "slugify/sha256/escapeHtml duplicated in multiple scripts" is **partially wrong**: `slugify` and `escapeHtml` exist **once** (both in `forge-art-proof.mjs`, 6 LOC) — they are single-copy, safe to keep or lift but not duplicated. `sha256` really is triplicated (lib `sha256Bytes`, `baseline-schema.cellSha256FromBytes`, proof `sha256Buffer`) — keep `cellSha256FromBytes` (test-pinned, TS-side), route proof through lib.

A2 pitfall #1 is exactly this bug class: one canonical `sliceCells`/`renderGridPng` in the lib kills the third copy of the drift-prone stride math.

---

## 3. YAGNI — one implementation, one caller (MINOR)

### Y1. `groups` frame-group machinery — ~30 LOC of genericity
`FrameGroup = string` (loose), `groups?: Record<string, readonly AnyFrameKey[]>`, `actionFrameKeys()`, group-aware `frameKeyOrder`/`getFrames`/`groupRows`/`currentKey`, pose-row rebuild loop in `updateTransport` — all serve exactly **one** group (`'actions'` on `sunweaver-worker`; gravemark returns []). The **behavior** is test-pinned (registry test: 32 sun action frames, 0 grave), so delete nothing functional; collapse the genericity to a single `hasActions` boolean or keep as-is. Lowest-value abstraction in the tool.

### Y2. `contextFixtures` field — ~30 LOC of redundant data
14 registry entries carry per-asset fixture lists, but only **3 distinct lists** exist, fully derivable from `faction + category` (SUN_UNIT / GRAVE_UNIT / BUILDING). Consumers (`suggestedScene`, `openContext` buttons) only read the list. Replace the field with a `fixturesFor(def)` function — same behavior, no data duplication, no test/QA impact (no test reads the field).

### Y3. ThresholdEntry flat record (not a class hierarchy)
Not a class hierarchy — it is one flat interface; the YAGNI part is the 7 dead fields + dead `advisory` flag (M2). No further abstraction exists to remove.

---

## 4. MINOR / NIT deletions

### N1. sessionStorage restore path — ~42 LOC (`store.ts` `readSessionStorage` + `SS_KEY` write)
Every state key is already serialized in the `#fal=` hash; hash wins on conflict, so sessionStorage adds restore-only-when-hash-missing behavior. Spec §6 says "sessionStorage holds non-hash extras" — there are none today. Deleting loses: state restore after a user strips the hash. Keep or delete; recommend delete with a §6 amendment line.

### N2. Hash serialization breadth — ~60 LOC reducible
`canonicalHash`/`parseHash` carry 12 keys incl. transient playback (`pl`, `sp`, `w`, `f`). Spec pins the pattern (`#fal=a=..&d=..&p=..&f=..&...`) and the copy-link button; QA tests no hash round-trip. Contract-compatible trim: drop `pl/sp/w` (~20 LOC) — deep links stop carrying play state; nothing tests it.

### N3. Roster unlabeled toggle — ~12 LOC (`workbench.ts`)
`rosterUnlabeled` checkbox + change handler + label hiding. QA asserts only that roster canvases render; spec §13's `roster-unlabeled.png` is a **proof-pack** artifact produced by `forge-art-proof.mjs`, unrelated to this overlay checkbox. Delete freely.

### N4. Dead stubs/vars — ~12 LOC
- `forge-art-proof.mjs` 221–225: dead `for (const [name, selector]...)` loop with `void`d vars (4).
- `forge-art-accept.mjs` 132–133 `allowedDirty` + 237–238 `tmpPngBytes` (`void`d leftovers, 4).
- `workbench.ts` 1848+1917: `const def` in `onKeyDown` only `void def`'d (2).
- `buildFailureJson` `contextVerdicts: []` placeholder (1).
- `adapters.ts` 90–92 unreachable `default: throw` (3, with M3).

### N5. Spec-pinned but QA-untested — reduce, don't delete (NIT)
- **Keyboard help overlay** (~50 LOC incl. `?`/Esc wiring, CSS, `buildHelpOverlay`): spec §6 pins the `?` binding. QA never opens it. Lowest-value UI in the tool; keep per contract, or shrink to a static `<details>` list.
- **Catalog search** (~26 LOC: input, `filterCatalog`, `/` key): spec §6 pins `/` search. QA never types into it. Keep per contract.
- **Preview-override chip** (~5 LOC): spec §6 pins `PREVIEW OVERRIDE`. Note: current logic only flags `background !== 'checker' || cameraHalfH != 14` — zoom/passes/abMode/wipe don't set it; that's an implementation gap, not a deletion.
- `forge-art-baseline-init.mjs` (69 LOC): outside §12's command list, never invoked by QA/tests — it is the honest one-time seeding path that produced the 14 accepted baselines. Keep; optionally note it in §12.

---

## 5. Sanity — nothing in this list breaks the gates

Cross-checked every candidate against `qa-forge-art.mjs` steps and the three pure suites:

- **`npm run test:forge-art`**: registry test pins `CATALOG`/`ASSET_BY_ID`/`getFrames` (incl. `'actions'`)/`worldScale`/`mirrorPairs`/`gridGeometryFor`; metrics test pins the 19 functions listed in M1 plus `getSandboxOverride` and sprites painters; pipeline test pins `getFrames`/`getSandboxOverride`/`validateBaselineManifest`/`cellSha256FromBytes`/`CATALOG`. **No M1–M5, N1–N4 item is referenced by any test.** (M1/M2 deletion is safe even though spec §10 text lists them — the tests resolve by name and would fail loudly only if a *pinned* function vanished.)
- **`npm run qa:forge-art`**: asserts catalog ids, banned-vocab, `__FORGE_ART_TOOL__` (selectAsset/setFacing/play/pause/togglePass/setAbMode/openRoster/closeRoster — all kept), A/B hash equality (`publishProbe` → `sheetBytes`+`sha256Bytes`+`jsSha256`, kept), `[data-fal-canvas]` 2..3 (`paintStage`/`diffImages`, kept), rig single-WebGL (`context-rig.ts`, untouched), roster canvases (roster overlay kept; N3's checkbox is not asserted), proof-pack subprocess (`forge-art-proof.mjs` — consolidate only, never delete its helpers), acceptance exit codes (accept.mjs — M5/dedup only), sandbox (`getSandboxOverride`, kept).
- **Proof packs / acceptance flow** (`forge-art-proof.mjs`, `forge-art-accept.mjs`): M3's dead adapter exports are not called; the lib consolidation is behavior-preserving (same byte loops, same hashes — `renderGridPng` copies are already byte-identical today, which is exactly why one copy is safe).

### Spec-gap found en route (not a deletion)
Spec §13 roster pack names `roster-unlabeled.png / roster-labeled.png / buildings-normal.png / units-normal.png`; `forge-art-proof.mjs`'s roster branch never emits them (only per-asset `roster-<slug>[-silhouettes|-values].png`; `rosterShots['roster-unlabeled'] = null` is a stub). QA only validates the single-asset pack, so this passes green today. Needs a fix or a §13 amendment — outside this review's mandate, flagged for the lead.

---

## 6. Ranked deletion list (by LOC)

| # | Item | Class | LOC | Breaks tests/QA? |
|---|---|---|---|---|
| 1 | Dead metrics exports (21 fns + `Span`) | MATERIAL (needs §10 amendment) | ~470 | no |
| 2 | Duplicate helper consolidation into `forge-art-lib.mjs` (renderGridPng ×2, sliceCells ×2, git ×5, countAlpha ×3, sha256Buffer) | MATERIAL | ~95 | no |
| 3 | Dead `composeSheet` + `regionSha256` import | MATERIAL | ~42 | no |
| 4 | Dead threshold fields + `advisory` flag | MATERIAL (needs §10 amendment) | ~40 | no |
| 5 | Dead adapter exports + unreachable throw | MATERIAL (needs §4 amendment) | ~40 | no |
| 6 | sessionStorage restore path | MINOR | ~42 | no |
| 7 | `contextFixtures` → derived `fixturesFor()` | MINOR | ~30 | no |
| 8 | `groups` machinery genericity | MINOR | ~30 | no |
| 9 | Hash trim (`pl/sp/w`) | MINOR | ~20 | no |
| 10 | Roster unlabeled toggle | NIT | ~12 | no |
| 11 | Dead stubs/vars (proof loop, accept voids, `void def`, `contextVerdicts`) | NIT | ~12 | no |
| 12 | `labelOf` + `catalog` alias | NIT | ~10 | no |

**Totals: ~815 LOC** (~705 deletable incl. amendments; ~110 of pure dead code today). Keep (spec-pinned, QA-untested, reduce-only): help overlay (~50), catalog search (~26), preview-override chip (~5), `forge-art-baseline-init.mjs` (69).

Net answer to the audit's floor: the tool is lean at the architecture level (one rig, one metrics lib, one capture script, one deck composer — A8 §1 honored); the fat is **surface breadth** — 60+ export functions where ~25 are consumed, a 23-field threshold table where 16 are read, and five private copies of git/PNG/hash plumbing where one lib copy belongs.
