# PTC-CLAY-06 — Death-Nail the Cage Interlock (Diagonal Talon Sweep)

## Single visual concern

Gate (b) still FAILs (round 5, 0.60 overall). Verbatim: "Four solid panels are present, but they remain beside the mandorla. They do not visibly cross it or overlap the spine at different depths. The front still reads as side-by-side lancets around a single framed opening."

## Diagnosis (orchestrator, from the geometry probe + three critic reads)

Two concrete faults, proven by the world-AABB probe:

1. **The south talon faces the camera DEAD-ON.** A solid pointed panel centered at Y about 3.5-7 with its face parallel to the view plane reads as "a single framed opening" (a door). In the reference, NOTHING faces the viewer flat — the two front talons sweep ACROSS the mandorla ("the front pair converge toward the central front boss", "front ribs sit over rear ribs").
2. **The talon bodies stay vertical beside the mandorla.** At 30° cant only the tips sweep in; at mid-height (Y~5.1) each rib's solid face is still beside the mandorla column, so there is no screen-space crossing of the crystal.

## Required change (cage only, in `src/sunweaver-town-center-structural.ts`)

Keep the ACCEPTED basics: four solid talon panels (no hole), base on the collar, apex converging over the mandorla at Y ~6.8, mandorla/spine/finial/collar untouched, wings/towers/stair/camera/materials/effects locked. Change the ARRANGEMENT so the front view genuinely interlaces:

1. **Rotate the whole 4-talon cage by 45°** so the talons sit on the DIAGONAL axes (45/135/225/315), each facing the object center. From the front ortho view, NO talon face is parallel to the camera plane — the two front talons (front-left, front-right) each show a ~45°-angled face sweeping from the collar up and IN across the mandorla, visibly crossing its silhouette and overlapping each other / the spine at different depths. This is the reference's interlock.
2. **Raise the cant to ~42 degrees** inward (from the current 30) so the talon BODY (not just the tip) leans over the mandorla: at mid-height the talon's inner edge must be over/inside the mandorla's silhouette. Keep the apex landing at orbit radius <= 0.4, apex Y ~6.8.
3. **Base orbit ~1.3-1.4** for the diagonal talons; keep the feet flared onto the collar so they do not float. Solid tapered pointed-arch talon profile (width ~0.95 at base, gentle taper), depth ~0.26.
4. **Objective self-checks the builder MUST run and report** (extend `scripts/crown-geometry-probe.mjs` if useful; adapt to work):
   - From the front ortho (world x == screen x), for at least TWO of the four talons, the talon's world-x range overlaps the mandorla's x-range [-0.55, 0.55] for at least 60% of the talon's own height (body over the crystal, not just the tip).
   - NO talon face is within ~25 degrees of facing the camera plane (no dead-on panel read). Check each talon's local +Z (or panel normal) against the world +Z axis after rotation+yaw+cant.
   - Report both numbers.

## Gates

Front ortho + front-3q must read: a solid four-talon interlocking cage whose front pair visibly crosses the faceted mandorla and overlaps in depth. BANNED: single framed opening dead-on, side-by-side lancets, side fins beside the crystal.

Other gates unchanged: 4 talons only; nothing beyond orbit 1.9 or Y 7.2; feet on collar; Stage 3 = collar only, Stage 4 = mandorla + spine + finial + 4 talons; p99 < 8 ms; console/browser errors 0; gameplay captures distinct; no rear stair; footprint 7.0.

## Verification

1. `npx tsc --noEmit`
2. `npm run build`
3. `npx vite build --config vite.structural.config.ts`
4. Structural vite server on 5174 (background), curl HTTP 200, `node scripts/town-center-structural-shots.mjs` — 0 errors, no black/empty captures, gameplay distinct, fresh qa/report.json. Kill server after.
5. FPS probe on the front-3q beauty view: report p99FrameMs (< 8 ms target).
6. Run the objective cage self-check above and paste the numbers into your report.
7. Fresh qa/report.json: 4 talons; mandorla/spine/finial/collar unchanged; no rear stair; footprint 7.0; errors [].

## Commit

Commit only `docs/PTC_CLAY_06_CAGE_DIAGONAL.md`, `src/sunweaver-town-center-structural.ts`, any capture/report files that must change, prefix `PTC-CLAY-06`. No unrelated files. Do not touch `src/sim.ts` / `src/engine.ts`. Do not self-approve visually.

## Implementation record

- Cage axes: diagonal `45°`, `135°`, `225°`, and `315°`; talon bases use orbit radii `[1.3, 1.4, 1.4, 1.3]` at `Y 3.48`.
- Talon faces point toward the center on the diagonal axes with world yaws `[225°, 315°, 45°, 135°]`; the inward cant is `42°`.
- The local talon height is `4.4675`, which places the apex at `Y 6.8`. The canted centerline holds the body near radius `0.62` through normalized height `0.6`, then converges to target apex radius `0.16`. Inward ±`0.12`/`0.18` tip offsets pull the four tips together. The front pair uses ±`0.75` body tangential sweeps with staggered normalized envelopes (`0.28→0.45→0.64` and `0.48→0.68→0.88`) and different body depth lifts (`0.60` and `0.30`) to show an over/under crossing.
- The solid pointed talon remains width `0.98` at the base and depth `0.26`. Four radial foot flares (`0.72 × 0.48 × 0.18`) land on the collar.
- The extended geometry probe reports all four talons overlapping the mandorla x-range for `100%` of sampled own height (`128/128` slices each). All four panel normals are `58.2993°` from world `+Z`; minimum `58.2993°`. The measured maximum talon radius is `1.8364`, and the maximum apex-band radius is `0.3331`.
