# Sunweaver Town Center — Iteration 8 Sightline Fix

Scope: move only the four secondary turrets off the front mandorla sightline. Preserve all other geometry, stages, materials, banners, camera, and runtime behavior.

## Evidence

Ray-picking the canonical 1024×768 front render returned:

- cream cone inside mandorla → `secondary-turrets`
- cyan pendant below mandorla → `secondary-turrets`
- saturated cyan heart → `front-almond-jewel`
- gold frame and weave → `front-approach`

The mandorla is present and correctly saturated. One cardinal secondary turret is projected directly across it.

## Required correction

- Keep exactly four secondary turrets with 90-degree spacing.
- Rotate the entire turret ring off the local entrance axis and the fitted front-camera sightline.
- Use a local offset near `-Math.PI * 0.125` (−22.5 degrees), which places the nearest turrets about 45 degrees from the canonical camera direction after the model display rotation.
- Do not change turret dimensions, crown crystal, banners, buttress count, footprint, stair, camera, or facade.
- Verify that no secondary-turret mesh ray-picks inside the cyan mandorla region in the canonical front view.
- Verify four turrets remain clear in top and rear views.

Run typecheck, build, canonical screenshots, pixel ray-pick probe, performance, strict spec, part coverage, multi-angle, and turntable. Fresh Grok 4.6 XHigh decides acceptance.
