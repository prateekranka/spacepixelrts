# Sunweaver Town Center — Iteration 3 Implementation Spec

Scope: standalone procedural Three.js Town Center and viewer only. Do not alter the live game Hall, simulation, or unrelated files.

## Root cause 1 — buried facade heart

The current `front-approach` origin is at radius 2.42, behind the outer facade ring at radius 2.79. The heart and most of its frame are occluded.

- Move the complete front-heart assembly outward so the gold frame, pauldron lips, and almond volume sit in front of the radial crown while remaining attached to the stone shell.
- The visible front of the frame must clear the 2.79 facade radius. Use a group radius near 2.85–3.00, then verify attachment in side views.
- Keep one large volumetric almond crystal with a bright inner core. It must read as an almond, not a horizontal cyan strip.
- Increase the complete front-heart assembly only as needed after placement. Do not add a second competing facade jewel.
- Preserve the deep pointed-arch recess, heavy curved gold pauldron lips, and woven inner gold ribs.

## Root cause 2 — false banners

The deep-blue roof material is still applied to stair runners and eight buttress insets. Those surfaces read as scattered fabric patches.

- Deep blue is reserved for the four actual cloth banners.
- Reassign stair runners to stone/gold architecture.
- Reassign buttress insets to dark cavity, stone, or cyan energy. They must not read as cloth.
- Keep exactly four banner planes, one per quadrant, at a clear outer radius.
- All four use the same deep-blue gold-sunburst/cyan-core texture.
- Tilt or place the four banners so the set is legible in the top view without creating extra banner-like roof surfaces.
- Keep the same four banner objects through all construction stages.

## Root cause 3 — hidden roof cage

The current four cage tubes use radius 0.085 and sit too close to the crystal. The front crystal hides the prongs.

- Increase the cage outside radius and tube weight enough to produce four readable aged-gold prongs around the crystal.
- Keep the prongs outside the cyan shell from front, top, and rear views.
- Rotate the four-prong set around Y if needed to prevent front-view overlap while retaining four-fold structure.
- Keep one faceted cyan shell and one bright emissive core. Reduce shell width only if required to expose the cage.
- Preserve the Stage 3 closed-cage language and additive Stage 4 crown.

## Locked systems

- Circular seven-unit clamp.
- Four-fold major plan and eight-fold facade rhythm.
- One front stair from Stage 1 onward; no rear stair.
- Additive Stage 1–4 evolution.
- Four secondary towers plus one taller center.
- Existing semantic parts, picking, and top-level-only explode behavior.
- Cream stone, aged gold, deep-blue fabric, cyan energy, and dark cavities remain separate materials.

## Verification

Run:

1. `npx tsc --noEmit`
2. `npm run build`
3. `node scripts/town-center-shots.mjs`
4. `node scripts/measure.mjs --url 'http://127.0.0.1:5173/town-center-viewer.html?ui=0&view=front&stage=4&freeze=1' --fps-seconds 5`
5. Strict sculpt-spec validation, part coverage, multi-angle, and turntable gates.

Do not declare visual PASS. A fresh blind Grok 4.6 XHigh review decides acceptance.
