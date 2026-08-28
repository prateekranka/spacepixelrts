# A2 — Unit Contract Audit: metrics library extraction for Forge Art Lab

Agent: audit A2 · Date: 2026-08-26 · Scope: READ-ONLY except this file
Sources read:
- `tests/vs4-combat-assets.test.ts` (full, 814 lines) — pure pixel gate, 64×64 Pix cells via `drawCombatSprite(row, dir, pose)`
- `scripts/qa-vs4-combat-assets.mjs` (lines 1–1103) — PNG-side duplicates + Playwright runtime contract
- `docs/VS1_COMBAT_ASSETS.md` — frozen art contract (facings, mirror rules, rim, world scales)

Goal: a reusable PURE metrics library for the workbench at `tools/forge-art/src/metrics.ts`, adapted from the accepted VS-4 algorithms **without weakening** `tests/vs4-combat-assets.test.ts` (it keeps its own copies; all checks stay duplicated).

Constants that everything keys off: `COMBAT_CELL = 64`, atlas 1024×256, 16 cols (8 dirs × 2 poses, `dir = col % 8`, `pose = floor(col / 8)`), 4 rows, `MAG = [255,0,255,255]`, `QUIET_TERRAIN_LUMA = 30`, `R3_LUMA_FLOOR = 90`.

---

## 1. Per-metric inventory

Legend: **Pix** = in-memory cell (`Pix { w, h, d: Uint8ClampedArray }`, index `(x + y*w)*4`, alpha at +3) · **PNG** = pngjs buffer region at atlas offset `(ox, oy)` (row stride = atlas width × 4).

### A. Alpha coverage & bounds

#### alphaAt
| | |
|---|---|
| Inputs | Pix cell, or PNG cell at (ox,oy); x,y |
| Algorithm | `d[(x + y*w)*4 + 3] > 0` — alpha strictly greater than zero |
| VS-4 thresholds | none alone; feeds every alpha-derived metric (alpha > 0 convention everywhere) |
| Generalizes | Yes, unchanged. Only parameterization: optional `minAlpha` (VS-4 uses 1; a >20 convention would change every downstream number) |

#### alphaCount
| | |
|---|---|
| Inputs | Pix / PNG cell |
| Algorithm | count of pixels with alpha > 0 over stride-4 scan |
| VS-4 thresholds | `ALPHA_MIN = 64*64*0.12` ≈ 491, `ALPHA_MAX = 64*64*0.55` ≈ 2252 (12–55% coverage); `alpha > 0` non-empty; also the **denominator** for luma/bright/MAG shares |
| Generalizes | Yes, algorithm; thresholds are **fractions of cell area** → must be recomputed per cell size (worker8 32×48 → 0.12/0.55 of 1536; scout 128×128; buildings 64×64). Do NOT copy 491/2252 as constants |

#### sourceBounds
| | |
|---|---|
| Inputs | Pix / PNG cell |
| Algorithm | min/max x/y over alpha > 0 pixels; `{minX,minY,maxX,maxY}` |
| VS-4 thresholds | width/height derived; guards ≥ 24×44, walkers ≥ 44×28 (R2); `sourceHeight` 40..52; `minY <= 2`, `maxY <= 51` |
| Generalizes | Yes, algorithm. All size thresholds unit-class specific — parameterize per asset class |

#### alphaInRows / coreAlphaInRows
| | |
|---|---|
| Inputs | Pix; minY..maxY row band (core variant excludes rim colors) |
| Algorithm | count alpha pixels (core: alpha && !rimColor) in the band |
| VS-4 thresholds | `alphaInRows(0..2) >= 4` (spear tip reaches row 0); `coreAlphaInRows(0..0) >= 2` (row-0 core pixels connected to spear, not floating rim) |
| Generalizes | Yes, algorithm. Bands are unit-specific |

### B. Luminance

#### rec709Luma
| | |
|---|---|
| Inputs | r,g,b |
| Algorithm | `0.2126r + 0.7152g + 0.0722b` |
| VS-4 thresholds | none (pure function) |
| Generalizes | Universal, unchanged |

#### averageLuma
| | |
|---|---|
| Inputs | Pix / PNG cell |
| Algorithm | mean rec709Luma over alpha > 0 pixels only |
| VS-4 thresholds | R3: `>= R3_LUMA_FLOOR = 3 * QUIET_TERRAIN_LUMA(30) = 90` |
| Generalizes | Yes, algorithm. **Floor is terrain-relative** (3:1 over quiet Helios) — parameterize per terrain; 90 is proven only for this pack |

#### brightMaterialShare
| | |
|---|---|
| Inputs | Pix / PNG cell |
| Algorithm | count of alpha pixels with luma >= 65, divided by alphaCount |
| VS-4 thresholds | `>= 0.30` (R2 "material planes, not emissive") |
| Generalizes | Yes, algorithm. 65 = quiet-terrain luma 30 + 25 — terrain-relative; per-asset floor UNPROVEN (see §4) |

#### analyzePng black/empty probe (mjs only)
| | |
|---|---|
| Inputs | full frame PNG (atlas 1024×256, contact 2048×1024, viewport 1366×1024) |
| Algorithm | `maxLuma > 6 && litRatio > 0.002` where lit = luma > 10, over ALL pixels (not alpha-filtered) |
| VS-4 thresholds | `maxLuma > 6`; `lit/pixelCount > 0.002`; `exactMagenta === 0` for rendered frames (source atlas must have `> 0` MAG) |
| Generalizes | Algorithm yes, but it is a **full-frame** sanity probe. Per-cell emptiness must be alpha-based (`alphaCount > 0`) + per-cell luma floor; the 0.002 ratio does not scale to a 64×64 cell (see §4) |

### C. Exterior & rim

#### exteriorTransparency
| | |
|---|---|
| Inputs | Pix / PNG cell |
| Algorithm | 4-neighbor BFS from border pixels through alpha == 0 cells; marks "exterior" transparent pixels. Enclosed holes (e.g. shield interior negative space) are NOT exterior |
| VS-4 thresholds | none alone; feeds rim shares and coreMask |
| Generalizes | Yes, unchanged (cell-size independent). Keep 4-neighbor — it is load-bearing for the rim contract |

#### exteriorAlphaLayerShares
| | |
|---|---|
| Inputs | Pix (or PNG cell) + `RimColors {outer, inner}` |
| Algorithm | for each alpha pixel, find nearest exterior pixel within Chebyshev radius 1..2 (ring scan per radius); pixels whose nearest layer is 1 or 2 are counted; share = pixels whose RGB exactly matches outer/inner color / layer count |
| VS-4 thresholds | `outer >= 0.85`, `inner >= 0.85` (R3) |
| Generalizes | Yes, algorithm + depth param (2). **Rim color table is per row/faction**: Sunweaver rows 0–1 `amber [240,193,90] / cream [240,231,210]`; Gravemark rows 2–3 `ice [183,209,208] / sky [127,167,184]` — worker8/scout/buildings need their own tables. ⚠ mjs variant additionally requires `alpha === 255` on the match; test variant ignores alpha — divergences must be reconciled in the library (see §5) |

#### guardBodyTop / coreMinY
| | |
|---|---|
| Inputs | Pix; row; dir (guardBodyTop) / row (coreMinY) |
| Algorithm | guardBodyTop: first non-rim alpha pixel scanning column band (`row===2` → `[34,34]` if dir∈{0,3,5} else `[27,29]`; other rows → `[29,31]`). coreMinY: first non-rim alpha pixel, any column |
| VS-4 thresholds | guardBodyTop >= 11 (R2) / >= 16 (R3); `bodyTop - coreSpearTop >= 16` (spear extension); coreMinY feeds spear geometry |
| Generalizes | Algorithm yes (first non-rim alpha in a band), but **column bands are unit-specific** — parameterize as `columnBand: [minX,maxX]`; bands for worker8/scout/buildings UNPROVEN |

### D. Core mask & connectivity

#### coreMask
| | |
|---|---|
| Inputs | Pix (or PNG cell) + RimColors |
| Algorithm | flood-fill from border through `!alpha || isRimColor` (4-neighbor) → `exteriorRim`; mask = `alpha && !(exteriorRim && isRimColor)` — i.e. body minus the two-pixel exterior rim keyline |
| VS-4 thresholds | none alone; feeds all row-2 anatomy |
| Generalizes | Yes, algorithm. Rim table + rim depth (2) per asset class |

#### maskBox / boxWidth / boxHeight / boxCoordinates
| | |
|---|---|
| Inputs | Uint8 mask + region `(minX,minY,maxX,maxY)` (mask stride = cell width; test uses `COMBAT_CELL`=64) |
| Algorithm | maskBox: count + tight bbox of set bits in region (null if empty). boxWidth/Height: `max-min+1`, 0 for null. boxCoordinates: list of set `[x,y]` |
| VS-4 thresholds | head box exactly `12×12`; torso ≥ `18×16` + ≥180 px; legs ≥ `6×6` each; shield ≥ `16×29` inside x8..26/y19..49; `centerGap === 0` |
| Generalizes | Yes, algorithm — **must take explicit width/height stride**; hardcoded 64 strides are a bug source for other cells |

#### maskComponents
| | |
|---|---|
| Inputs | Uint8 mask + region |
| Algorithm | 8-neighbor connected components (dx,dy ∈ [-1,1]), each with count + bbox |
| VS-4 thresholds | head largest component ≥ 80; legs must be separate components (≥6px wide each) |
| Generalizes | Yes, unchanged (8-neighbor is the convention) |

#### primaryComponentShare
| | |
|---|---|
| Inputs | Pix / PNG cell |
| Algorithm | 8-neighbor components over alpha; largest / alphaCount |
| VS-4 thresholds | `>= 0.96` |
| Generalizes | Algorithm yes. 0.96 likely portable to worker8/scout/buildings but **UNPROVEN** for tiny sprites with floating 1px bits (see §4) |

#### longestIceRun
| | |
|---|---|
| Inputs | Pix + mask + region (test) / normalized cell {mask,pixel} (mjs, region hardcoded 29..40 × 16..27) |
| Algorithm | longest horizontal run of pixels that are in-mask AND exactly match ice color `[183,209,208]` |
| VS-4 thresholds | `>= 6` (ice visor) |
| Generalizes | Algorithm yes — generalize to `longestColorRun(img, mask, color, region, axis)`. Region + color are per-unit; exact-RGB equality is fragile to dithering/AA (see §5) |

#### hasCorePath
| | |
|---|---|
| Inputs | Uint8 mask + starts + ends (8-neighbor BFS from all starts; success when an end is reached) |
| Algorithm | BFS over set mask bits; multi-source, target set lookup |
| VS-4 thresholds | grip→tip path must exist (polearm continuous) |
| Generalizes | Yes, unchanged |

### E. Geometry / anatomy

#### polearmSpan
| | |
|---|---|
| Inputs | starts, ends coordinate lists |
| Algorithm | max pairwise `hypot(dx,dy)`; reports distance, |dx|, |dy|, slope = dy/dx (∞ if dx=0) |
| VS-4 thresholds | `distance >= 32 && dx >= 16 && 0.8 <= slope <= 2.0` |
| Generalizes | Algorithm yes (generic point-set span). Thresholds unit-specific; buildings N/A |

#### pixelMatches / rgbaEqual
| | |
|---|---|
| Inputs | Pix; x,y; color (RGB) — rgbaEqual: two Pix + x,y (full 4-channel compare) |
| Algorithm | exact byte equality of 3 (pixelMatches) or 4 (rgbaEqual) channels |
| VS-4 thresholds | used by head-shield-accent ban: sand `[214,185,138]`, ochre `[208,154,78]`, MAG → `=== 0` in head region |
| Generalizes | Yes, unchanged. Exact equality is deliberate (palette, no tolerance) |

### F. Diff & similarity

#### differingPixels / unionAlpha / silhouetteIou
| | |
|---|---|
| Inputs | two Pix (same dims) |
| Algorithm | differingPixels: count of !rgbaEqual. unionAlpha: count of (alphaA || alphaB). silhouetteIou: intersection/union of alpha masks |
| VS-4 thresholds | poseDelta = differing/union × 100 ∈ (4, 45); guardIoU = silhouetteIou(row0,row2) < 0.78; walkerIoU = silhouetteIou(row1,row3) < 0.78 |
| Generalizes | Yes, unchanged. IoU pair bounds are unit-pair-specific (proven only for Lumen-vs-Rift Guard, Solar-vs-Burden Walker) |

#### meanRgbaDelta (directionDelta)
| | |
|---|---|
| Inputs | two Pix (same dims) |
| Algorithm | Σ|a.d[i] − b.d[i]| over ALL bytes, divided by `a.d.length` (width×height×4) — **NOT alphaCount** |
| VS-4 thresholds | N vs E pose-0 `> 18` |
| Generalizes | Algorithm yes, but preserve the /d.length convention exactly (transparent background dilutes the mean; threshold is scale-dependent — see §5) |

### G. Color share

#### magShare
| | |
|---|---|
| Inputs | Pix / PNG cell |
| Algorithm | count of exact `[255,0,255,255]` matches / alphaCount |
| VS-4 thresholds | `0.005 <= share <= 0.05` (source cells); runtime frames `=== 0` |
| Generalizes | Algorithm yes — generalize to `colorShare(img, color)`. 0.5–5% is proven for MAG on these 4 units; sentinel-color and building floors UNPROVEN (a building with zero MAG must not fail a 0.5% floor) |

### H. Hashing

#### sha256 (Pix) / cellSha256 (PNG region)
| | |
|---|---|
| Inputs | Pix full RGBA buffer, or PNG cell region (row-by-row copy of CELL×CELL×4 bytes with atlas row stride) |
| Algorithm | SHA-256 over the complete RGBA byte stream (alpha included) |
| VS-4 thresholds | frozen per-cell digests for rows 0,1,3 (48 cells; row 2 is the living VS4A row); exact equality, no tolerance |
| Generalizes | Yes, unchanged. Frozen digests are per-asset snapshots — new assets freeze their own digests only after acceptance; any byte (incl. RGB residue under alpha=0) breaks the hash (see §5) |

### I. Mirror & facing variance

#### flipX deepEqual mirror verification
| | |
|---|---|
| Inputs | two Pix: `cells[row][mirror][pose]` vs `cells[row][source][pose].flipX()` |
| Algorithm | `assert.deepEqual(Array.from(mirror.d), Array.from(source.flipX().d))` — flipX must return a NEW array; exact full-RGBA equality |
| VS-4 thresholds | pairs `[1,3], [0,4], [7,5]` (author E/NE/N/S/SE = dirs 0,1,2,6,7; mirror W/NW/SW), all rows/poses |
| Generalizes | Algorithm yes. Mirror-pair table is per-asset config (author-dir + mirror map); the VS-4 table is proven only for the four combat units |

#### normalizedFacing
| | |
|---|---|
| Inputs | dir |
| Algorithm | `dir===3 → 1, dir===4 → 0, dir===5 → 7`, else dir — row-2 anatomy is measured on the authored right-facing frame after flipX |
| VS-4 thresholds | all row-2 anatomy runs on normalized cells |
| Generalizes | Yes — part of the mirror-table config |

### J. PNG-side + runtime contract (mjs)

#### analyzeCombatRows per-cell metrics
| | |
|---|---|
| Inputs | atlas PNG region per cell (1024×256 asserted) |
| Algorithm | per-cell alphaCount, bbox w/h, averageLuma, brightShare (luma ≥ 65), rim shares, sha256 — exact duplicates of the Pix metrics over PNG regions; mjs rounds to 4 decimals in the manifest |
| VS-4 thresholds | same as Pix side: luma ≥ 90, rim ≥ 0.85, no empty cell, frozen rows 0/1/3 hashes, row-2 anatomy suite |
| Generalizes | Yes — this is the extraction template: the library takes an `RgbaImage` so Pix and pngjs both fit |

#### Runtime contract checks
| | |
|---|---|
| Inputs | live page probe: `combatCanvas`, combat mesh uniforms, `iMeta`/`instanceMatrix`, shader source, renderer info |
| Algorithm | (1) mappings JSON deep-equal `[{kind:2,civ:0,row:0},{kind:4,civ:0,row:1},{kind:2,civ:1,row:2},{kind:5,civ:1,row:3}]`; (2) exactly 1 mesh with `uCombatAtlas`; (3) `magFilter === 1003 && minFilter === 1003` (NearestFilter); (4) uniforms `size === [1024,256]`, `cell === 64`, `cols === 16`, `rows === 4`, `enabled === 1`; (5) shader contains clauses `kind > 1.5 && kind < 2.5 && civ < 0.5`, `kind > 3.5 && kind < 4.5 && civ < 0.5`, `kind > 1.5 && kind < 2.5 && civ > 0.5 && civ < 1.5`, `kind > 4.5 && kind < 5.5 && civ > 0.5 && civ < 1.5`, `frame < 4.0`; (6) world-scale matrix probe: column-norm of instanceMatrix columns (`scaleX = hypot(m[0],m[1],m[2])`, `scaleY = hypot(m[4],m[5],m[6])`) vs `EXPECTED_WORLD_SCALES` = Lumen `[1.59,1.89]`, Solar `[2.05,1.54]`, Rift `[1.67,1.92]`, Burden `[2.05,1.81]`, tolerance `< 0.0001`; (7) draw calls equal with combat on vs `?combat=0`; (8) p99 frame < 8ms (or sim-share < 8ms on software GL); (9) rendered lineup/battle have 0 exact-MAG pixels |
| Generalizes | Probe technique generalizes; every expected value is pack-specific config (mappings, scales, shader clauses are string-fragile — keep them exact-match, never fuzzy) |

---

## 2. Proposed pure-library shape — `tools/forge-art/src/metrics.ts`

Pure functions over a minimal image abstraction so `Pix` (src/sprites) and pngjs buffers both adapt without copying:

```ts
export interface RgbaImage { readonly width: number; readonly height: number; readonly data: Uint8Array | Uint8ClampedArray; } // RGBA interleave, row stride = width*4
export type Rgb = readonly [number, number, number];
export type Rgba = readonly [number, number, number, number];
export interface Box { count: number; minX: number; minY: number; maxX: number; maxY: number; }
export interface RimColors { outer: Rgb; inner: Rgb; }
export interface Span { distance: number; dx: number; dy: number; slope: number; }

// ---- hashes ----
export function sha256Bytes(bytes: Uint8Array): string;                      // crypto SHA-256 hex
export function imageSha256(img: RgbaImage): string;                         // full RGBA stream incl. alpha
export function regionSha256(img: RgbaImage, ox: number, oy: number, size: number): string; // row-strided copy, atlas-safe

// ---- alpha coverage / bounds ----
export function alphaAt(img: RgbaImage, x: number, y: number, minAlpha = 1): boolean;
export function alphaCount(img: RgbaImage, minAlpha = 1): number;
export function alphaCoverage(img: RgbaImage, minAlpha = 1): number;         // alphaCount / (w*h)
export function sourceBounds(img: RgbaImage, minAlpha = 1): Box | null;      // null when empty
export function alphaInRows(img: RgbaImage, minY: number, maxY: number, minAlpha = 1): number;
export function groundContactRow(img: RgbaImage, minAlpha = 1): number | null; // last alpha row (maxY)
export function bottomGapRows(img: RgbaImage, minAlpha = 1): number;         // (h-1) - groundContactRow

// ---- luminance stats ----
export function rec709Luma(r: number, g: number, b: number): number;
export function averageLuma(img: RgbaImage, minAlpha = 1): number;           // over alpha pixels only
export function brightMaterialShare(img: RgbaImage, lumaFloor = 65, minAlpha = 1): number;
export function maxLuma(img: RgbaImage): number;
export function litRatio(img: RgbaImage, lumaFloor = 10): number;            // all pixels, frame-level probe
export function isEmptyOrBlack(img: RgbaImage): boolean;                     // maxLuma > 6 && litRatio(10) > 0.002 (frame-level)

// ---- connectivity / regions (mask ops take explicit stride) ----
export function maskBox(mask: Uint8Array, w: number, h: number, region: Box): Box | null;
export function boxWidth(box: Box | null): number;
export function boxHeight(box: Box | null): number;
export function boxCoordinates(mask: Uint8Array, w: number, h: number, region: Box): Array<readonly [number, number]>;
export function maskComponents(mask: Uint8Array, w: number, h: number, region: Box): Box[]; // 8-neighbor
export function hasCorePath(mask: Uint8Array, w: number, h: number, starts: Array<readonly [number, number]>, ends: Array<readonly [number, number]>): boolean;
export function primaryComponentShare(img: RgbaImage, minAlpha = 1): number;  // 8-neighbor over alpha
export function longestColorRun(img: RgbaImage, mask: Uint8Array | null, color: Rgb, region: Box, axis: 'x' | 'y'): number;

// ---- geometry ----
export function polearmSpan(starts: Array<readonly [number, number]>, ends: Array<readonly [number, number]>): Span;

// ---- silhouette / diff (all require equal dims; return NaN on empty union) ----
export function rgbaEqual(a: RgbaImage, b: RgbaImage, x: number, y: number): boolean;
export function differingPixels(a: RgbaImage, b: RgbaImage): number;
export function unionAlpha(a: RgbaImage, b: RgbaImage): number;
export function silhouetteIou(a: RgbaImage, b: RgbaImage): number;           // ∩/∪ of alpha masks
export function meanRgbaDelta(a: RgbaImage, b: RgbaImage): number;           // Σ|Δ| / (w*h*4) — VS-4 convention, NOT alphaCount
export function poseDeltaPercent(a: RgbaImage, b: RgbaImage): number;        // differing/union*100

// ---- mirror verification (never mutates) ----
export function flipX(img: RgbaImage): RgbaImage;                            // NEW image; source untouched
export function isMirrorPair(source: RgbaImage, mirror: RgbaImage): boolean; // deepEqual(flipX(source).data, mirror.data)

// ---- facing / pose variance ----
export function facingVariance(cells: RgbaImage[]): { meanDelta: number; maxDelta: number; minDelta: number }; // adjacent-dir meanRgbaDelta stats
export function facingBoundsSwim(cells: RgbaImage[]): { minX: number; maxX: number; minY: number; maxY: number; widthSwim: number; heightSwim: number };
export function facingCentroidSwim(cells: RgbaImage[]): number;             // max pairwise centroid distance across facings

// ---- color share / emissive ----
export function colorShare(img: RgbaImage, color: Rgba, minAlpha = 1): number; // exact RGBA match / alphaCount
export function magShare(img: RgbaImage): number;                            // colorShare with MAG
export function teamColorShare(img: RgbaImage, colors: readonly Rgb[], minAlpha = 1): number;

// ---- rim / core (faction parameterized) ----
export function exteriorTransparency(img: RgbaImage, minAlpha = 1): Uint8Array;          // 4-neighbor BFS, enclosed holes stay interior
export function rimLayerShares(img: RgbaImage, rim: RimColors, depth = 2, minAlpha = 1): { outer: number; inner: number };
export function coreMask(img: RgbaImage, rim: RimColors, depth = 2, minAlpha = 1): Uint8Array;
export function coreMinY(img: RgbaImage, rim: RimColors, minAlpha = 1): number;
export function coreAlphaInRows(img: RgbaImage, minY: number, maxY: number, rim: RimColors, minAlpha = 1): number;
export function bodyTop(img: RgbaImage, rim: RimColors, columnBand: readonly [number, number], minAlpha = 1): number;
```

Plus two non-metric exports:
```ts
export interface AssetContract {
  cellSize: number; authorDirs: number[]; mirrorPairs: Array<readonly [number, number]>;
  rimByRow?: Record<number, RimColors>; thresholds: Record<string, number | [number, number]>; frozenSha256?: Record<string, string>;
}
export interface MetricReport { name: string; value: number; ok: boolean; threshold: string; }
export function evaluateContract(cells: RgbaImage[][][], contract: AssetContract): MetricReport[]; // row/dir/pose grids → pass/fail report
```
`evaluateContract` lets the workbench render any asset sheet against a declared contract without the vs4 test file knowing about it.

---

## 3. What MUST stay duplicated vs safe extraction

**All VS-4 checks stay in `tests/vs4-combat-assets.test.ts`, verbatim and untouched.** The accepted test is the gate: it must be able to fail independently of any library, its local helper copies are frozen behavior (alpha>0, 8-neighbor, 4-neighbor BFS, /d.length mean, exact-RGB equality, `flipX` deepEqual, frozen digests). Refactoring it to import the library would (a) couple gate to library correctness, (b) risk silent threshold drift — the duplication is intentional isolation and stays.

**Safe extractions** (pure, stateless, byte-deterministic; validated against known-good values, never by editing the test):
- `imageSha256` / `regionSha256` — must reproduce `FROZEN_R3_CELL_SHA256` for rows 0,1,3 (48 known digests).
- `alphaCount`, `sourceBounds`, `averageLuma`, `brightMaterialShare`, `rimLayerShares` — validated against the published metric ranges (the test's final `console.log` ranges and the manifest `sourceMetrics` mins/maxes are the oracle).
- `maskBox`/`boxWidth`/`boxHeight`/`maskComponents`/`boxCoordinates`/`hasCorePath`/`polearmSpan`/`pixelMatches`/`rgbaEqual`/`differingPixels`/`unionAlpha`/`silhouetteIou`/`meanRgbaDelta`/`primaryComponentShare`/`magShare`/`flipX`/`isMirrorPair` — deterministic transforms; cross-check on the known 64×64 cells.
- Calibration harness (not a rewrite): a `metrics-calibration.test.ts` asserting library outputs equal the frozen digests / fall inside the recorded ranges for the current cells. It runs alongside, not instead of, the vs4 gate.

---

## 4. Gaps: workbench metrics VS-4 lacks (placeholders marked UNPROVEN until calibrated)

| Gap | Why VS-4 doesn't cover it | Proposed metric | Placeholder (UNPROVEN) |
|---|---|---|---|
| Screen occupancy at normal camera | VS-4 asserts world scale via `instanceMatrix` columns only — never projected pixels at the 1366×1024 camera | rendered-frame alpha bbox of each unit / viewport | height share 0.03–0.15, width share 0.02–0.12 `[UNPROVEN]` |
| Empty-cell generalization | `analyzePng`'s `maxLuma>6 && litRatio>0.002` is a full-frame probe; `alphaCount>0` alone admits 1 stray pixel | per-cell `isEmptyOrBlack`: alphaCount>0 AND averageLuma ≥ floor | averageLuma ≥ 30 per cell `[UNPROVEN]` |
| Per-facing variance bounds | only N-vs-E mean delta > 18 exists; no spread across all 8 facings | `facingVariance` (mean/max/min adjacent-dir delta), per-facing silhouette self-IoU (same unit, all dirs) | min adjacent delta ≥ 10; self-IoU ≥ 0.85 `[UNPROVEN]` |
| Horizontal/vertical swim across facings | no check that feet/top stay aligned across facings (footing & silhouette stability) | `facingBoundsSwim`, `facingCentroidSwim`, per-facing `bottomGapRows` | widthSwim ≤ 4px, centroidSwim ≤ 2px, bottomGapRows ≤ 2 `[UNPROVEN]` |
| Team-color / emissive share beyond MAG | MAG is the only sentinel; runtime frames assert 0 MAG but no other glow palette exists | `teamColorShare(colors)` | 0.5–5% inherited from MAG floor; 0 floor for assets with no emissive `[UNPROVEN]` |
| Rim contract for non-combat assets | rim colors/depth hardcoded per row 0–3 | `rimByRow` config + `rimLayerShares(depth)` | depth 2, ≥ 0.85 shares carry over only if a rim is authored; buildings may legitimately have none `[UNPROVEN]` |
| Pose variance policy per asset class | 4–45% is a biped gait bound | `poseDeltaPercent` with per-class bounds; static flag | buildings: 0–2% allowed; worker8: 4–45 assumed `[UNPROVEN]` |
| Ground contact / bottom anchor | only `maxY <= 51` and height 40–52; no explicit anchor-line or "feet touch a defined world row" | `groundContactRow` vs contract anchor row; `bottomGapRows` | anchor row per asset class `[UNPROVEN]` |
| Mirror-table generalization | pairs `[1,3],[0,4],[7,5]` hardcoded | `mirrorPairs` config in `AssetContract` | VS-4 table reused only if worker8/scout keep E/NE/N/S/SE authoring `[UNPROVEN]` |
| Source-vs-screen alpha delta | source cells and rendered frames are checked independently | same-unit source-bounds vs rendered-bbox ratio | within ±1.5× `[UNPROVEN]` |

Every `[UNPROVEN]` placeholder must be calibrated from measured distributions on accepted assets before any gate consumes it; the workbench UI should show them as "advisory" until then.

---

## 5. Pitfalls

1. **Uint8ClampedArray byte order / stride**: RGBA interleave, alpha at +3, row stride = full-width × 4. In atlases the cell stride ≠ cell size — `regionSha256` must copy row-by-row from the atlas (exactly what `cellSha256` does); indexing a cell with `(x + y*CELL)*4` on the full atlas buffer reads the wrong row.
2. **alpha > 0 vs alpha > 20**: VS-4 uses `> 0` everywhere. Any "opaque" convention change silently inflates coverage/luma/MAG metrics and breaks every VS-4 number. Keep `minAlpha = 1` default; expose it, never change it silently. Related divergence already exists: mjs rim match requires `alpha === 255`, test `isRimColor` ignores alpha — pick one in the library and document.
3. **flipX must produce a new array**: mirror verification is `deepEqual(mirror.d, source.flipX().d)`; an in-place flip corrupts the source cell and the comparison. `isMirrorPair` must never mutate.
4. **sha256 covers full RGBA including alpha**: RGB residue under alpha=0 breaks frozen digests. `Buffer.from(p.d)` copies; hashing must use exactly `w*h*4` bytes. New frozen digests only after acceptance, row 2 style (living row exempt).
5. **meanRgbaDelta divides by `d.length` (w*h*4), not alphaCount**: transparent background zeros dilute the mean; the `> 18` threshold is meaningful only for same-size, mostly-transparent cells. Do not "fix" this when extracting — changing the denominator invalidates the accepted threshold.
6. **mask ops use cell stride 64 hardcoded**: `maskBox`/`maskComponents`/`hasCorePath`/`boxCoordinates` index `x + y*COMBAT_CELL`. Generalizing to other cell sizes requires explicit w/h params — the #1 off-by-stride bug source for worker8 32×48.
7. **Connectivity topology differs by function**: alpha components (`primaryComponentShare`, `maskComponents`, `hasCorePath`) are 8-neighbor; exterior flood fills (`exteriorTransparency`, `coreMask`) are 4-neighbor. Mixing them changes rim/coverage semantics.
8. **Exact-RGB equality is a feature, not a bug**: rim, MAG, visor-run, accent-ban checks use byte equality with zero tolerance — palette dithering, AA, or PNG color correction (premultiply!) breaks them. pngjs data must be unpremultiplied raw.
9. **Enclosed holes are interior**: the BFS only floods through transparent (or rim) pixels; shield-inner negative space is intentionally NOT exterior. A naive "all transparent pixels" variant mislabels rim layers and inflates rim shares.
10. **Anatomy is measured on the authored right-facing frame**: mirrored dirs (3,4,5) are flipped back (`normalizedFacing`) before row-2 measurements. Libraries must receive already-normalized cells or the mirror config, or left/right anatomy flips.
11. **Rounding and tolerance discipline**: mjs rounds metrics to 4 decimals for the manifest; frozen hashes and the scale probe are exact-ish (scale tolerance `< 0.0001` from column-norm floats). Never round before hashing; never fuzzy-match shader clause strings.
12. **InstanceMatrix is column-major**: `scaleX = hypot(m[0],m[1],m[2])`, `scaleY = hypot(m[4],m[5],m[6])` — reading columns, not rows; wrong axes report swapped world scales.
13. **Division by zero**: luma/MAG/bright shares divide by alphaCount; `silhouetteIou`/`poseDeltaPercent` divide by union. VS-4 guards emptiness first; the library must return NaN (or throw) explicitly, never crash mid-report.
14. **Thresholds are area-relative or terrain-relative**: `ALPHA_MIN/MAX` are fractions of `CELL*CELL` (0.12/0.55) and must scale with cell area; luma 90 and bright 65 are relative to quiet-Helios terrain luma 30. Copying them as literals across assets is the fastest way to false red/green.
