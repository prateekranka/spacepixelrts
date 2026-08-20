# Sunweaver Town Center — Iteration 6 Structural Cleanup Spec

Scope: clean the macro silhouette, stage order, and arch depth without changing the passed palette, banner count, semantic runtime, or footprint.

## Clean 4+1 skyline

- Keep exactly four tall secondary turrets plus one taller central crown crystal.
- The eight buttress/facade beats remain, but their pointed fins must terminate below the main roof/crown silhouette. Lower and soften their tips so they read as drum rhythm, not extra turrets.
- Do not remove the eight-fold lower facade rhythm.
- Preserve the circular clamp and four-fold major mass.

## One broad front stair

- Keep one continuous wide step stack.
- Reduce or remove paired long runner/rail masses that make it look like two narrow flights.
- Use low side nosings or one broad central approach surface. The step field must remain the dominant read.

## Banner alignment

- Keep exactly four banners.
- Place them at one exact four-fold offset, evenly spaced by 90 degrees and aligned to the building's radial grammar.
- Use an exact 45-degree offset from the front stair if needed to avoid blocking it. Do not use the current 67.5-degree offset.
- Keep one consistent sunburst texture.

## Clean additive stages

- Stage 1: foundation, broad stair, socket only. No visible crystal, cage, towers, heart, or banners.
- Stage 2: lower/mid body plus a small cyan core and four low support poles. No final spire, heart, towers, or banners.
- Stage 3: upper body, four secondary towers, large mandorla, exactly four banners, and a medium closed four-pole construction cage. Do not show the final crown spire.
- Stage 4: retain every Stage 3 system and add the full central crystal/cage and final crown jewels.
- Move the full `createCrystalSpire` group back to Stage 4. Keep the Stage 3 temporary core as the earlier closed cage.

## Deep mandorla arch

- Keep the large almond dimensions from Iteration 5.
- Recess the cyan backplate, shell, and core behind the front gold/stone boundary. The heart must sit inside a tunnel, not flush on a plaque.
- Increase the outer arch width modestly to create visible side zones around the almond.
- Keep the annex attached close to the shell; do not extend its footprint.
- Build heavy curved pauldron lips as the primary side masses.
- Place alternating gold/dark-gold cross-laces only in the side zones. The weave must be visible but must not cross the cyan heart.

## Locked systems

- Cream/gold/navy/cyan/dark material split.
- Finished four-prong roof crystal cage.
- Four banner count and texture.
- No rear stair.
- Fitted front camera.
- Semantic picking and top-level explode.

Run typecheck, build, screenshots, performance, strict spec, part coverage, multi-angle, and turntable. Fresh Grok 4.6 XHigh decides acceptance.
