# PTC-CLAY-05 — Solid Talon Cage (replace hollow arch frames)

## Single visual concern

Gate (b) still FAILs. The Luna blind critic (round 4): "the ribs converge at the crown but do not visibly cross the mandorla in depth. The front still reads as bordered lancets." The canted geometry from PTC-CLAY-04 is fine (ribs now converge inward, apex radius ~0.36). The remaining cause is the FORMS: each cage element is a HOLLOW extruded arch FRAME (an outline around an opening). Outline = reads as a window/lancet border. The reference's four cage prongs are SOLID, continuous talon ribs that visibly cross the mandorla and overlap each other in depth.

The mandorla, front spine, finial, and collar from PTC-CLAY-03 are ACCEPTED — do not touch them. Wings, towers, stair, camera, materials, effects are locked.

## Required change (cage elements only, in `src/sunweaver-town-center-structural.ts`)

Replace the four HOLLOW cage arch frames with four SOLID rib/falon panels, keeping the PTC-CLAY-04 positions, yaw and cant:

1. **Solid arched panel, no cut-out hole.** Each cage element becomes a FILLED pointed-arch-shaped solid: outer pointed arch profile (width ~0.95-1.05 at the base), extruded depth ~0.24-0.28, with a real interior (no inner hole). Optionally the panel may taper (slightly narrower toward the top) if that reads better — keep it continuous, do not split into two legs.
2. **Keep the four-position arrangement exactly as accepted in CLAY-04**: orbit radius ~1.56, base Y ~3.48, yaw [0, -36, 180, +36], cant ~30 degrees inward (apex sweeping to orbit radius <= 0.5 over the mandorla, apex Y ~6.8). Only the frame/profile changes from hollow outline to solid panel.
3. **Front-view target**: two or more SOLID arch faces must visibly CROSS the mandorla silhouette (not just converge above it) and overlap each other / the front spine at visibly different depths. The bordered-lancet read is BANNED. If the solid panels at orbit 1.56 still do not cross the mandorla on screen, bring the flanking arches' orbit inward to ~1.05-1.2 (their inner edges then clearly over the mandorla) — but keep the feet visually anchored to the collar rim (a short outward flare at the foot is allowed).
4. No fifth cage element. No part exceeds orbit radius 1.9 or crown top Y 7.2. Keep 4 elements. Do not touch stage semantics (Stage 3 = collar; Stage 4 = mandorla + spine + finial + 4 cage ribs).

## Constraints

- Mandorla, front spine, finial, collar geometry: UNCHANGED.
- Neutral clay #B8B4AC, flat-shaded, runtime API unchanged.
- Update the structural manifest honestly (cage profile changed to solid rib; record any orbit change).

## Verification

1. `npx tsc --noEmit`
2. `npm run build`
3. `npx vite build --config vite.structural.config.ts`
4. Structural vite dev server on 5174 (background), curl HTTP 200, `node scripts/town-center-structural-shots.mjs` — 0 console/page errors, no empty/black captures, gameplay-close/normal/far distinct, fresh qa/report.json. Kill the server after.
5. FPS probe on front-3q beauty view: p99 < 8 ms.
6. Fresh qa/report.json: 4 cage elements present; mandorla/spine/finial/collar unchanged; no rear stair; footprint 7.0; errors [].

## Commit

Commit only `docs/PTC_CLAY_05_SOLID_TALON_CAGE.md`, `src/sunweaver-town-center-structural.ts`, and capture/report files that must change, prefix `PTC-CLAY-05`. No unrelated files. Do not touch `src/sim.ts` / `src/engine.ts`. Do not self-approve visually.

## Implementation record

- Cage profile: filled pointed-arch solid rib, with no inner hole or split legs.
- Panel dimensions: base width `0.98`, local height `CAGE_ARCH_HEIGHT = 3.8336`, extruded depth `0.26`; the solid pointed talon tapers to a `0.57`-wide spring before the pointed apex.
- Arrangement: south/north orbit radius `1.56`, east/west flanking orbit radius `1.16` (the permitted inward fallback), base Y `3.48`, apex Y `6.8`, yaw `[0, -36, 180, +36]`, inward cant `30°`; each inward flank has a short `0.48` outward foot flare to the collar rim.
- Structural manifest: `cageArchProfile = solid-rib`, `cageArchDepth = 0.26 / 7`, `cageArchOrbitRadius = 1.56 / 7`, `cageArchFlankOrbitRadius = 1.16 / 7`, and the recorded flank foot flare dimensions.
