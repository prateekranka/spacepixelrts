# Sunweaver Town Center — Iteration 7 Occlusion and Color Fix

Scope: fix the visible facade occlusion, cyan response, side weave, and Stage 3 temporary crystal. Preserve the passed structural cleanup.

## Saturated cyan mandorla

- Add a dedicated mandorla glow material. Use saturated medium cyan rather than high-intensity near-white emission.
- Prefer an opaque `MeshBasicMaterial` with `toneMapped = false`, or a low-emission standard material that stays cyan after ACES.
- Use this saturated material for the large almond backplate and inner core.
- Keep the transparent faceted shell as a surface layer, but do not let it wash the entire heart to white.
- The final heart must show a broad saturated cyan almond silhouette with sharp top and bottom points.

## Remove entrance overlap

The older Stage 2 front entrance overlaps the lower mandorla through transparency and creates a cream cone inside it.

- Shrink the front entrance to a low doorway below the mandorla: approximately width 1.0–1.1 and height 0.95–1.05.
- Lower it so its top ends below the mandorla's bottom point.
- Remove the small front entrance jewel and rim that create the hanging cyan pendant.
- Keep the rear service portal unchanged.
- Raise the mandorla center slightly if needed, without enlarging the annex footprint.
- The broad stair must remain visible as one continuous flight beneath the facade.

## Visible side weaving

- Keep the heavy pauldron lips.
- Move the side-zone cross-laces in front of the smooth lip surfaces where required.
- Use alternating gold and dark-gold diagonals with enough thickness and contrast to read in the front screenshot.
- Keep all ribs outside the cyan almond silhouette.

## Stage 3 cage only

- Stage 2 retains its small cyan core and four low poles.
- Stage 3 shows the medium closed construction cage but no pointed crystal inside it.
- Stage 4 adds the final full crystal/cage/crown.

## Locked systems

- Clean four-secondary-plus-one skyline.
- One broad front stair; no rear stair.
- Exactly four radial banners.
- Circular four-fold/eight-rhythm plan.
- Material split, final crown cage, fitted camera, picking, and explode.

Run typecheck, build, screenshots, performance, strict spec, part coverage, multi-angle, and turntable. Fresh Grok 4.6 XHigh decides acceptance.
