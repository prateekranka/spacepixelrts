# PTC-CLAY-04 — Cage-Arch Depth Interlock (Talons over the Crystal)

## Single visual concern

The four cage arches still do not read as a wrapping four-prong cage. The Luna blind critic (round 3, fresh captures): gate (b) FAIL — "the front no longer reads as one arch alone, but reads as three separate pointed lancets. Two cage-arch faces do not overlap the crystal in depth." The crown's own fix (broad faceted mandorla + front spine) is ACCEPTED (gate a PASS). The mandorla, front spine, finial, and collar from PTC-CLAY-03 must NOT be touched.

Do not touch wings, side towers, stair, entrance, camera, materials, or effects.

## Why it still fails

The four arch frames are vertical. They sit at orbit radius ~1.6, outside the mandorla (max half-width ~0.56), so from the front they read as three tall side-by-side lancet windows flanking the crystal — no face crosses the crystal silhouette, so there is no depth overlap.

## Reference target (approved pack, from the Luna design read)

The reference cage is four TALON ribs: they spring WIDE from the collar (outer radius ~2.0 at the base) and sweep INWARD and UPWARD over the faceted crystal, converging toward the finial. "The front/interior ribs sit over the darker side or rear ribs near the lower third of the crystal. The center spine is also in front of the blue surface." "The front pair converge toward the central front boss." That is the interlock: continuous arch faces crossing the mandorla at two or more depths in the front view.

## Required change (cage arches only, in `src/sunweaver-town-center-structural.ts`)

Keep 4 pointed-arch frames with their real arch-shaped holes (continuous faces, never filled). Change HOW they stand:

1. **Cant each arch inward toward the object axis** so its apex sweeps over the mandorla:
   - Feet stay on the collar rim at orbit radius ~1.55-1.65 (do not move the base ring).
   - The apex of each arch must land at orbit radius <= 0.6 (i.e. over the mandorla), converging toward the finial axis. Achieve by leaning each frame ~25-35° toward the center (frame tilted around the horizontal axis perpendicular to its face, apex inward). Do NOT just add yaw — yaw alone is what produced the lancet read.
   - Arch apex height stays ~6.7-6.9; arch thickness 0.24-0.28 unchanged; arch outer width ~0.95-1.05 unchanged.
2. **From the FRONT ortho view the result must show** the two flanking arches' continuous faces sweeping across the mandorla's silhouette and appearing to pass over/behind each other and the front spine at visibly different depths. The side-by-side lancet read is BANNED. If a single flat-on arch still occludes the interlock, the two flanking arches may also be yawed ±25-40° in addition to the cant, AS LONG AS their faces still cross the mandorla.
3. Optional, matching the reference: a horizontal mid-strut band joining the arch inner edges to the mandorla at ~Y 4.6-5.0 (thin torus/ring segment, radius ~1.0-1.2) is ALLOWED if it strengthens the cage read. It must not bury the mandorla or the spine. Do not add it if it complicates the silhouette; the cant is the primary fix.

## Constraints / gates

- Mandorla, front spine, finial, collar geometry from CLAY-03: UNCHANGED.
- Four cage arches only; no fifth element added as a "cage".
- No part may exceed orbit radius 1.9 or crown top Y 7.2. No arch foot floats off the collar.
- Stage semantics: Stage 3 = collar only; Stage 4 = mandorla + spine + finial + the four canted arches.
- Update the structural manifest honestly (arch cant/tilt fields, any mid-strut).

## Verification

Run from repo root:
1. `npx tsc --noEmit`
2. `npm run build`
3. `npx vite build --config vite.structural.config.ts`
4. Structural vite server on 5174 (background), wait for HTTP 200, `node scripts/town-center-structural-shots.mjs` — must pass: 0 console/page errors, no empty/black captures, gameplay-close/normal/far distinct, fresh qa/report.json. Kill the server after.
5. FPS probe on the front-3q beauty view: p99 < 8 ms.
6. Fresh qa/report.json: 4 arch clones present; mandorla, spine, finial, collar unchanged in moduleCounts; no rear stair; footprint 7.0.

## Commit

Commit only `docs/PTC_CLAY_04_CAGE_INTERLOCK.md`, `src/sunweaver-town-center-structural.ts`, and any capture/report files that must change, prefix `PTC-CLAY-04`. No unrelated files. Do not touch `src/sim.ts` / `src/engine.ts`. Do not self-approve visually.

## Implementation transform record

The four arch feet remain at orbit radius 1.56 and Y 3.48. Each frame is canted inward by 30° around the world tangent axis at its cardinal orbit angle. The local arch height is 3.8336 so the canted apex remains at Y 6.8. The south, east, north, and west yaws are 0°, -36°, 180°, and 36°. The resulting apex radius is 0.36 before the radius-1.9 safety clamp. No mid-strut was added.
