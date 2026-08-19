# PTC-CLAY-03 — Rebuild the Crown Assembly

## Single visual concern

The current crown reads as ONE thin pointed arch around a narrow shard from any ortho view. The reference crown reads as a BROAD faceted central crystal/mandorla enclosed by FOUR unmistakable interlocking cage arches (a four-prong cage) that visibly overlap the crystal in depth. The Luna blind critic (gpt-5.6-luna, on the current structural front+top captures vs the approved reference pack) scored this gate FAIL and named it the single largest remaining gap.

Do not redesign the wings, side towers, stair, entrance, camera, materials, or effects in this piece. The wings from PTC-CLAY-02 are ACCEPTED — do not touch them.

## Design data (from a Luna design read of the approved reference pack; world units, footprint D = 7)

- Crown collar (where the crown meets the upper drum): a shallow segmented annular band, outer radius ~2.0-2.1, with upper and lower rim lips. It is BROADER than the upper drum (r 1.3) and reads as an elliptical collar, not a thin ring.
- Crown total height above the collar springline: ~4.5-4.7 units. The crown is the tallest element by far.
- Central crystal: a FACETED almond/mandorla, not a thin shard. Base half-width ~0.50-0.60 units (≈25% of collar diameter). It tapers toward a pointed finial top.
- Cage arches: 4 radial pointed-arch frames, thickness ~0.24-0.28 units, that wrap the crystal so two or more arch faces are VISIBLE in any ortho front view, with the front arch(es) overlapping the crystal and its center spine in depth (parallax). A single flat arc will NOT match the reference.
- A narrow vertical spine/ridge runs down the front center of the crystal, proud of its surface, joining the finial to a low bezel at the front of the collar.

## Current crown geometry to REPLACE (in `src/sunweaver-town-center-structural.ts`)

- `cage_base` cylinder (r1.25, h0.32 @y3.15) — too small; becomes the broad collar.
- `central_crystal` (almond lower r0.16->0.42, upper r0.05->0.16, spire r0.03->0.08, peaks at y~6.9) — too narrow; becomes the broad faceted mandorla with a front spine.
- `crystal_cage_arches` (4 x thin archFrame, height 2.6, thickness 0.2, at r1.25 on cardinal axes) — the culprit: cardinal-aligned thin frames read edge-on as ONE arch. Rebuilt as thick interlocking cage (below).
- `stage_4_crown` (tiny tapered piece) — becomes a proper finial/apex on the crystal.

## Required new crown grammar (World units. Replace only the four modules listed above.)

### Stage 3: the broad collar (replaces `cage_base`)
- Shallow flared annular collar at Y 3.02-3.52 (center Y 3.27): outer radius 2.02, inner radius 1.55, height 0.5.
- Two rim lips: upper lip ring (r 2.02, h 0.12) and lower lip ring (r 1.88, h 0.15), both tapered lathe or torus segments, giving the segmented elliptical collar read.
- The collar visibly overhangs the upper drum (r 1.3) like the reference's elliptical collar.
- Keep the part name space honest: `cage_base` may be renamed or split; record the new IDs in the manifest.

### Stage 4: broad faceted central crystal (replaces `central_crystal`)
- Faceted almond/mandorla: base half-width 0.52-0.56, rising from Y 3.5 to a pointed apex at Y 7.0-7.2. Use a custom lathe or extruded faceted profile (6-8 segments), never a smooth cylinder. It must be BULKY at the base, tapering to a finial ~Y 7.1.
- ADD a front center spine: a narrow vertical ridge (thin elongated shape ~0.10-0.14 wide, standing ~0.08-0.12 proud of the crystal face) running from the collar bezel (Y 3.6) up to the finial (Y 6.9). In flat-shaded clay the ridge reads as a visible center line — this is the parallax "in front" cue.
- Small finial: short pointed tip at the apex (replaces `stage_4_crown`).

### Stage 4: four interlocking cage arches (replaces `crystal_cage_arches`)
- 4 thick pointed-arch frames, arch thickness 0.24-0.28, frame outer width ~0.95-1.05, springing from the collar rim (Y ~3.5) up to arch apex ~Y 6.8. Use the existing extruded pointed-arch shape with a proper arch-shaped hole (keep the deep opening, do not fill it).
- Placement: arch centers orbit the crystal at radius ~1.55-1.62. To defeat the edge-on read, YAW the four arches so their faces fold inward toward the object center:
  - South arch faces +Z (yaw 0) directly at the viewer.
  - East arch is yawed ~-40 to -50° (its face points toward the front-center) so it is NOT edge-on from the front.
  - West arch yawed ~+40 to +50° symmetric.
  - North arch faces -Z (yaw 180).
  From the front view this yields two flanking arch faces converging toward the front center line (the reference "front pair converge toward the central front boss") plus the south arch and the crystal spine overlapping in depth. From any other ortho, the same rule guarantees at least two visible arch faces.
- Arch feet must land visibly on the collar rim (not float). No part of any arch exceeds radius 1.9 or the crown top Y ~7.2.

## Gate (single gate this round)

Front-ortho and 3-quarter views must clearly read: a broad faceted crown inside a four-prong interlocking cage, with two or more arch faces visible overlapping the crystal and its center spine; crown unmistakably the tallest element; no floating arches; no change to footprint, wings, towers, stair, or stage semantics.

## Construction stages

- Stage 3 shows the broad collar only (no crystal, no arches). Stage-2 crown piece (`stage_2_crown`) is untouched visual state.
- Stage 4 adds crystal + front spine + finial + the four yawed cage arches. Stages 1-3 visuals otherwise unchanged from the accepted PTC-CLAY-02 state.

## Verification

Run from repo root:
1. `npx tsc --noEmit`
2. `npm run build`
3. `npx vite build --config vite.structural.config.ts`
4. Start the structural vite server on port 5174 (background), wait for HTTP 200, then `node scripts/town-center-structural-shots.mjs` — must pass: 0 console/page errors, no empty/black captures, gameplay-close/normal/far distinctly different, fresh report at critic/out/town-center-structural-v01/qa/report.json. Kill the server after.
5. FPS probe on the front-3q beauty view: p99 < 8 ms (cap the arch lathe segments so draws stay bounded; current draw count ~86).
6. Report runtime internals from the fresh report.json: 4 cage arch clones present, collar present, crystal present, no rear stair, footprint diameter still 7.0.

Technical gates: p99 < 8 ms; console errors 0; gameplay captures distinct; no rear stair; arch clones = 4.

## Commit

Commit only `docs/PTC_CLAY_03_CROWN.md`, `src/sunweaver-town-center-structural.ts`, and any capture/report files that must change, with prefix `PTC-CLAY-03`. Do not commit unrelated dirty files. Do not touch `src/sim.ts` or `src/engine.ts`. Do not self-approve visually.
