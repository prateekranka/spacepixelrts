# Sunweaver Town Center — Iteration 4 Implementation Spec

Scope: replace only the failed front solar-heart system in the standalone Town Center asset. Preserve the iteration-3 cage, banners, stages, camera, runtime hierarchy, and unrelated files.

## Failure

The current facade uses `crystalGeometry` plus an elliptical torus rim. It reads as an offset octagonal gem on a ledge. Scaling or moving this primitive cannot produce the concept's broad almond solar heart.

## Required primitive replacement

- Add a custom symmetric `almondShape(width, height)` in the facade plane.
- The outline must have sharp top and bottom points and continuous convex left/right curves.
- Extrude and bevel that shape into a shallow volumetric shell. It must remain visibly three-dimensional in the front and side views.
- Add a smaller nested almond core with stronger emissive cyan/white response.
- Add a separate thick aged-gold almond frame made from the same outer shape with an almond-shaped hole.
- Remove the facade torus rim and the octagonal `crystalGeometry` facade shell/core. The roof crystal keeps its existing faceted geometry.

## Placement and hierarchy

- Keep the heart centered inside the deep pointed-arch recess. It must not sit on a ledge or outside the arch.
- Place the shell and core close to the arch plane. Use depth ordering only to avoid z-fighting.
- The deep cavity remains a backdrop around the almond, not an empty gothic doorway competing with it.
- Keep the complete facade attached near the radial shell. Do not enlarge the annex footprint.
- If needed, reduce the complete `front-approach` scale slightly while increasing the almond relative to its frame. The four-fold plan must remain clean.

## Gold architecture

- Keep two heavy curved pauldron lips as the outer front armor.
- Add visible crossed or interlaced gold ribs between the almond frame and the pointed arch. They must read as woven support, not thin parallel rails.
- The almond frame is the primary gold boundary. The pointed arch is the secondary stone/gold boundary.

## Locked acceptance systems

- Four readable roof-cage prongs around one cyan crown crystal.
- Exactly four deep-blue sunburst cloth banners; no other deep-blue patches.
- Circular seven-unit clamp, four-fold major plan, eight-fold surface rhythm.
- One front stair from Stage 1; no rear stair.
- Additive stages and current fitted front camera.
- Semantic picking and top-level-only explode behavior.

## Verification

Run typecheck, build, all Town Center screenshots, performance probe, strict spec, part coverage, multi-angle, and turntable gates. Do not declare visual PASS. Fresh Grok 4.6 XHigh decides acceptance.
