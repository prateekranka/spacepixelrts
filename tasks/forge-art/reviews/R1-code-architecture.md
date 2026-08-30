# R1 — Code & Architecture Review (Forge Art Lab v1)

Reviewer: R1 · Branch `hermes/forge-art-lab` · 14 commits vs `ced0b944` · HEAD `316f46b`
Scope: real diffs, `tools/forge-art/src/*.ts`, `scripts/forge-art-*.mjs`, production isolation.
Read-only review; no repo files modified.

## Verdict summary

| Area | Result |
|---|---|
| Production leakage | CLEAN |
| Second-renderer drift | CLEAN |
| sim.ts / engine.ts untouched | CLEAN (0-line diff) |
| sprites.ts delta scope | CLEAN (exports + 2 additions only) |
| Metrics conventions | PRESERVED |
| Acceptance CLI safety | GOOD (1 MATERIAL contract issue below) |
| Dead code | Several NIT/MINOR items |

**Material findings: 1** · Minor: 6 · Nits: 9

---

## MATERIAL

### M1. Accepted baseline manifests violate the frozen v1 schema (and fail the tool's own validator)

The committed `tools/forge-art/baselines/*/manifest.json` files contain only
`schemaVersion/assetId/label/faction/category/revision/createdAt/frames` (9 keys).
They are **missing** `source`, `cellLayout`, `anchor`, `worldScale`, `paletteStats`,
`thresholdsUsed`, `gates` — every one of which `FORGE_ART_LAB.md §5` declares part of the
accepted manifest and `validateBaselineManifest()` (baseline-schema.ts) requires.

Verified by running the validator against the committed artifacts:

```
sunweaver-lumen-guard -> INVALID: source must be an object | cellLayout must be an object | anchor must be an object | worldScale must be an object | paletteStats must be an object | thresholdsUsed must be an object
gravemark-core       -> INVALID: (same)
sunweaver-worker     -> INVALID: (same)
```

Root cause: `forge-art-accept.mjs` never validates its own output. The `--apply` path builds
`{...acceptedManifest, revision, createdAt, frames}` (or the bare 7-key stub at line 114 for
`--init`) and writes it without a `validateBaselineManifest()` call. Validation only runs on
**candidates** in `forge-art-baseline.mjs`. So schema v1 is enforced on one side of the pipeline
and silently violated on the other.

Mitigating: all current readers are tolerant — `workbench.ts loadBaseline()` reads only
`revision/createdAt/frames`; `proof.mjs acceptedCells()` reads `frames[].key` only. Nothing
crashes today. But: (a) any future strict reader or a validation gate on acceptance fails
immediately, (b) the on-disk shape diverges from the frozen §5 contract, and (c) the manifest
sha256s recorded in `registry.json` are pinned to the malformed shape.

**Fix direction:** in `forge-art-accept.mjs --apply`, construct the full §5 manifest (merge the
registry-derived geometry/palette fields — the same data `forge-art-baseline.mjs` emits) and run
`validateBaselineManifest()` on it before the atomic rename; re-baseline the 14 accepted assets
once. Confirm with R2 whether A6 intends the accepted manifest to be a *subset* of the candidate
schema — if so, §5 and the validator must say so explicitly.

---

## MINOR

### m2. Schema drift in the candidate generator: undocumented `cellLayout.count`
`forge-art-baseline.mjs:115` emits `cellLayout: {…, count: frames.length}` — `count` is in
neither the `BaselineManifest` type nor the validator (which ignores unknown fields, so candidates
pass). Type vs emitted shape drift; same family as M1. Add `count` to the type or drop the field.

### m3. Spec/doc drift: `drawScoutHdPix` alias claimed, not present
`docs/FORGE_ART_LAB.md §15` says `drawHelionScoutHdPix` is "renamed export alias `drawScoutHdPix`".
The code exports `drawHelionScoutHdPix` only; no alias exists. `tests/forge-art-metrics.test.ts:45`
resolves it defensively (`drawScoutHdPix ?? drawHelionScoutHdPix`), which hides the drift. Either
add the alias or correct §15.

### m4. Spec/doc drift: isolation script filename
`docs/FORGE_ART_LAB.md §15` names `scripts/forge-art-prod-isolation.mjs`; the real file is
`scripts/forge-art-prod-isolation.sh`. (The shell script itself is fine and passes.)

### m5. The scout-strip seam (the one new production code path) has no direct test
`drawScoutStripCell` / `upscaleNearest4` are untested in the tsx suites. The 4x-nearest path is
claimed to be byte-identical to the canvas `buildSpriteAtlas()` blit
(`imageSmoothingEnabled=false` drawImage, 32→128). It is correct *by construction* (integer 4x
nearest sampling), and gravemark-scout baselines were seeded through it via `--init` — but that
only proves self-consistency, not equivalence with the real atlas blit. No test compares
`upscaleNearest4` output against an actual canvas drawImage (tsx suites are DOM-free; the browser
QA gate never makes this comparison either). Recommend one browser-based probe asserting
candidate cell == atlas blit region for the upscale path.

### m6. `qa-forge-art.mjs` header documents 19 steps; code runs 14
Header comment lists items 1–19 (incl. construction states, footprint/scale references) that have
no corresponding `step()` calls. Stale documentation of the gate's coverage. Also
`sandbox-unrelated-preservation` ships a dead `const script = …; void script;` (lines 309–312)
instead of running that check — the real assertion is a tsx `-e` probe; delete the dead block.
Also note `lumen-guard-select-facing-play-pause`'s playback assert
(`frameB !== frameA || playing === false`) can pass spuriously — acceptably weak for a smoke gate,
but worth tightening.

### m7. Acceptance dry-run does not surface the stale-worktree gate
`forge-art-accept.mjs:139` applies the "worktree dirty beyond declared files" freshness rule only
when `--apply` is set. A dry-run with a dirty tree reports a plan as if it would apply, with no
warning. Cheap fix: log `[warn] apply would refuse: dirty files …` in dry-run.

---

## NIT

- **n1** `forge-art-accept.mjs:132–133` — dead `allowedDirty` set (`…gitDirtyFiles().filter(() => false)`) with `void allowedDirty;`; and `:237–238` dead `tmpPngBytes`/`void`. Leftover scaffolding.
- **n2** `forge-art-proof.mjs:219–227` — dead roster loop (`for (const [name, selector] … { void name; void selector; }`) and `rosterShots['roster-unlabeled'] = null`; `:115` `await canvas.convertToBlob ? null : null;` is a no-op expression.
- **n3** `forge-art-proof.mjs:137` — rig URL passes `seed=53505`, but `context-rig.ts` never reads a `seed` param (world reset uses `STAGE_SEED`/`mulberry32(0xC0FFEE)`). Dead parameter; remove or wire it.
- **n4** `workbench.ts` — unused imports `regionSha256`, `composeSheet` (imported, never called; `noUnusedLocals:false` masks it); `onKeyDown` declares `def` then `void def;` — delete both.
- **n5** `registry.ts` — `catalog` (lowercase) alias of `CATALOG` has zero callers; `baselineRevision` field is always `null` and never read anywhere. Dead surface.
- **n6** `adapters.ts` — `worker8()`, `workerActions()`, `building()` exports have zero in-repo callers (documented §4 surface; `combatRow`/`scoutHd` are exercised). Fine to keep as frozen contract surface, but confirm intent or prune.
- **n7** `metrics.ts` — `longestColorRun`, `facingVariance`, `boxCoordinates` have no in-repo callers (A2 frozen-signature surface; keep, but they are the un-calibrated tail of the library).
- **n8** `workbench.ts:2032–2047` — `__FORGE_ART_TOOL__` is defined with a *different* object shape on the workbench page (selectAsset/setFacing/…) than the rig's `ForgeRigApi` (show/view/world) while the global declaration in `context-rig.ts` types it as `ForgeRigApi`; the `defineProperty` value bypasses the type. Harness consumers must branch per page. Rename one surface or union the type.
- **n9** `sprites.ts` — `drawScoutStripCell` clamps `col` to `[0, SCOUT_COLS-1]` defensively; the atlas loop can never produce an out-of-range slot, so the clamp is unreachable-but-harmless. Fine; note only.

---

## Checked & clean

1. **Production leakage** — zero `tools/` imports anywhere in `src/` (grep). `scripts/forge-art-prod-isolation.sh` runs: `PROD ISOLATION: CLEAN`. `dist-forge-art/` is gitignored and absent from the commit list. `package.json` diff is pure additions after `test:m3` (no existing prod script touched; `build` string unchanged; `three@^0.180.0` pre-existing at ced0b94). Main `vite.config.ts` untouched (only `vite.forge-art.config.ts` added, `outDir: dist-forge-art`).
2. **Second-renderer drift** — zero `new THREE` / `from 'three'` matches under `tools/`. `context-rig.ts` constructs exactly one `GameRenderer` (+ real `World` + `mulberry32` from src — sim, not renderer); `fixtures.ts` type-imports `World` only; `views.ts`/`workbench.ts` use Canvas2D exclusively (QA gate asserts ≤1 live WebGL canvas on the rig page, 0–1 on the workbench).
3. **sim.ts/engine.ts** — `git diff ced0b94 -- src/sim.ts src/engine.ts` = 0 lines.
4. **sprites.ts delta** — only `export` on `drawHelionAction8Dir` + `drawHelionScoutHdPix`, plus `drawScoutStripCell`/`upscaleNearest4`. No pixel-path changes. Verified `drawScoutStripCell` mirrors the `buildSpriteAtlas()` scout blit exactly (col = civ*7+frame; civ0/frame<4 → HD painter, else 4× nearest of `drawUnitSprite(Kind.Scout, civ, frame)`).
5. **Metrics conventions** — preserved: `alphaAt` `>= minAlpha` (≡ VS-4 `alpha > 0` for integer alpha); `meanRgbaDelta` divides by `a.data.length` (w·h·4); `imageSha256` hashes full RGBA stream; components/`hasCorePath` are 8-neighbor BFS, `exteriorTransparency`/`coreMask` 4-neighbor; mask ops take explicit `w`/`h` strides; NaN guards documented throughout; `node:crypto` lazy + window-guarded with pure-JS SHA-256 fallback (jsSha256). Tests pass: metrics 48/48 frozen-digest calibration, registry, pipeline all PASS.
6. **Acceptance CLI safety** — dry-run default (`--apply` opt-in); atomic temp-write + rename for png/manifest/registry; exit-code contract documented and exercised by the QA gate (3 stale, 4 failed gate, dry-run no-write via registry mtime); browser cannot write baselines (no server endpoint; workbench fetches GET only; HMR only invalidates candidates).
