# PTC-CLAY-07 — Vertical Proportions + Central Energy-Vault

## Single visual concern

All five structural gates now PASS, but overall is 0.60 (bar 0.70). The critic (round 6): "the lower front mass is too short and boxy. It lacks the reference's broad, tall central energy-vault volume, so the building reads squat beneath the crown." Proportions layer = 0.5.

Goal: make the mass beneath the crown tall and substantial (reference profile), and add the tall central front energy-vault that bridges base → crown. Nothing beyond the accepted design grammar changes.

## Reference proportions (Luna design read of the approved pack; 7-unit footprint, world units)

- Total height ≈ 11.5-12.0 (current ≈ 7.1).
- Plinth + steps: 3.3-3.5 high (stepped; NOT just a stair flight).
- Lower drum: 2.5-2.6 high.
- Upper/middle drum: 2.1-2.2 high.
- Central energy-vault (front, bridging ground/crown): outer vault ≈ 3.0 high × 3.0 wide; blue opening ≈ 2.6 high × 1.8 wide; recess 0.4-0.5 deep; inner almond/mandorla ≈ 1.7-1.8 high × 1.0-1.2 wide; small upper seam jewel ≈ 0.55-0.6 high × 0.35-0.4 wide; the actual dark entrance beneath is much smaller (≈1.0 × 0.6).
- The vault height overlaps the drum heights. It is NOT a separate stacked level.

## Current layout (accepted; to be RE-MOUNTED, not redesigned)

- foundation_disc (r3.5, Y0→0.4), plinth implicit; lower_drum r1.55 h1.4 @y1.08; entrance_bay @y1.35/z2.1; broad_front_stair 5 treads @z~3.2; primary wings (accepted CLAY-02 design) base @y0.75 upper @y1.82, orbit 2.23/2.02, outer reach 3.48; upper_drum r1.3 h1.2 @y2.38; side towers @y~1.6; secondary buttresses @y~1.2; crown (accepted CLAY-03/06): collar @y3.27 r2.02, mandorla base 3.5 → apex 7.08, spine, finial, 4 diagonal bent talons (orbit 1.3-1.4, apex band r0.33).

## Required change (all in `src/sunweaver-town-center-structural.ts`, class-by-class; do NOT redesign any accepted module — only change Y position and, where stated, scale/size)

### 1. Plinth + stair (addresses "squat base")
- Keep foundation_disc (unchanged).
- Add TWO stepped plinth tiers around the base: tier-1 ring 0.4→1.8 (outer r 3.5, top r 3.3), tier-2 ring 1.8→3.3 (outer r 3.35, top r 2.9). Tapered lathe rings (truncated cones), not boxes.
- Extend the broad front stair to climb the full plinth: continue the existing tread rhythm so the stair reaches the plinth top (Y≈3.3) on the south face. Keep ONE stair, no rear stair. Keep the existing accepted tread design; just lengthen.

### 2. Lower drum + wings + entrance (re-mount higher)
- Lower drum: r 1.95, h 2.7, center Y 4.65 (Y 3.3 → 6.0). Slightly wider AND taller than before, but wings still project past it (wing outer reach 3.48 > 1.95).
- Primary wings: clone the ACCEPTED wing base + upper design unchanged in geometry; RE-MOUNT so wing base center Y ≈ 3.9 and wing upper center Y ≈ 5.2 (i.e. +3.15 above current). Orbit radii 2.23/2.02 unchanged. Outer reach 3.48 unchanged. South wing still preserves the entrance/stair axis.
- Entrance bay: re-mount on the plinth top so its base sits around Y 3.3-3.5, arch top reaching into the vault band (see below). Keep the deep recessed pointed-arch grammar.

### 3. Upper drum + side towers + buttresses (re-mount higher)
- Upper drum: r 1.62, h 1.6, center Y 6.8 (Y 6.0 → 7.6).
- Side towers + secondary buttresses: same geometry, re-mounted so their bases sit on the upper drum (base Y ≈ 6.0-6.3), tops staying below the crown collar. Four towers on diagonals, four buttresses interleaved.

### 4. Central energy-vault (NEW, the hero front volume)
- Placed on the FRONT (south, +Z), outer vault reaching from about the plinth top up into the upper-drum band: outer frame ≈ 3.0 high × 3.0 wide, centered around Y ≈ 5.9-6.0 (so it spans ~4.4 → ~7.4). Use the existing pointed-arch frame grammar (thick frame ~0.35-0.4, real punched opening).
- Recessed opening ≈ 2.6 high × 1.8 wide, depth 0.45 (a recessed pointed-arch bay behind the frame).
- Inner almond/mandorla jewel ≈ 1.7 high × 1.1 wide, placed in the opening above the small entrance; plus a small upper seam jewel ≈ 0.55 × 0.4 near the vault top. Clay forms only (no color).
- The vault visually bridges the plinth/drums to the crown. The small dark entrance (≈1.0 × 0.6) sits at the vault's base on the plinth top.
- It must not become a fifth "tier": keep it inset into the front face, not an attached tower.

### 5. Crown (accepted design; re-mount + uniform scale)
- The accepted crown = collar + mandorla + front spine + finial + 4 diagonal bent talons. Do NOT change its design.
- Re-mount so the collar springline sits at Y ≈ 7.6 (collar center ~7.7). Apply a UNIFORM scale of ≈ 1.35 about the collar springline to the whole accepted crown assembly (mandorla base ~0.55 → scaled accordingly, apex → ~11.7, talon orbits/apex band scale along). Collar radius ≈ 2.05 (scale 2.02 by 1.0 — keep radius nearly as-is so it stays inside the footprint; only heights scale fully). If the talons' side towers collision looks worse after scaling, keep the talon orbit slight — the crown design read is what matters.

## Constraints (preserve the five accepted gates)

- (b) the interlocking four-talon cage read must survive the scale/mount change (re-run the AABB checks).
- (c) four radial wing lobes, no pyramid roofs, gaps between wings and diagonal towers.
- (d) one broad south stair, no rear stair.
- (e) circular 7-unit footprint; broad collar; side towers + buttresses secondary.
- Neutral clay #B8B4AC flat-shaded; runtime API unchanged; stage semantics: Stage 2 = plinth + lower drum + wings + stair + entrance, Stage 3 = upper drum + towers + buttresses + vault frame, Stage 4 = crown (+ vault jewel). Update the manifest and part-name semantics honestly.
- Nothing beyond footprint radius 3.5; nothing above Y 12.2.

## Verification

1. `npx tsc --noEmit`
2. `npm run build`
3. `npx vite build --config vite.structural.config.ts`
4. Structural vite server on 5174 (background), curl 200, `node scripts/town-center-structural-shots.mjs` — 0 errors, no black/empty captures, gameplay-close/normal/far distinct, fresh qa/report.json. Kill server after.
5. FPS probe on the front-3q beauty view: p99 < 8 ms.
6. Re-run the crown-geometry objective checks (talon face angle >= 25° off camera; talon x-range overlapping mandorla >= 60% of its height) and report.
7. Fresh qa/report.json integrity; no rear stair; footprint 7.0; errors [].

## Commit

Commit only `docs/PTC_CLAY_07_PROPORTIONS_VAULT.md`, `src/sunweaver-town-center-structural.ts`, `scripts/crown-geometry-probe.mjs` if changed, and capture/report files that must change, prefix `PTC-CLAY-07`. No unrelated files. Do not touch `src/sim.ts` / `src/engine.ts`. Do not self-approve visually.
