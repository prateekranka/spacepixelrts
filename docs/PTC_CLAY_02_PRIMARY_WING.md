# PTC-CLAY-02 — Rebuild the Primary Radial Wing Module

## Single visual concern

The current four `primary_wing_source` modules read as separate square pagoda huts with oversized pyramid roofs. They dominate the top plan and replace the reference's integrated radial buttress/gallery lobes.

Do not redesign the crown, side towers, stair, camera, materials, or effects in this piece.

## Required wing grammar

Build one repeated radial wing system and clone it at the four cardinal axes.

### Stage 2: low persistent wing base

- A low radial plinth/shell projects from the lower drum toward the footprint edge.
- Use a custom extruded trapezoid or wedge profile, not a square box or cylinder.
- Tangential width: approximately `1.30–1.55` units.
- Radial depth: approximately `1.35–1.60` units.
- Height: approximately `0.55–0.75` units.
- Outer reach stays inside radius `3.48`.
- The south copy must preserve the entrance and stair axis.

### Stage 3: integrated arched gallery upper

- Add two thick side shoulder/pilaster masses.
- Add one hollow pointed arch frame facing outward.
- Add a recessed rear shell behind the arch, not a solid front block.
- Add a shallow two-plane gabled or sloped wedge roof integrated into the upper drum.
- Roof eaves must not form a broad square pyramid.
- Wing peak stays below the four side-tower peaks and far below the central crown.
- The south arch remains visibly subordinate to and aligned with the unique entrance bay.

## Top-plan target

- Four obvious radial lobes at 0°, 90°, 180°, and 270°.
- Each lobe is longer radially than tangentially.
- Clear gaps remain between cardinal wings and diagonal towers.
- The entrance/stair projection is the only south asymmetry.
- No roof corner may exceed the seven-unit foundation disc.

## Construction stages

- Stage 2 shows wing bases only.
- Stage 3 adds all four wing upper galleries/roofs without moving the Stage-2 bases.
- Stage 4 preserves them unchanged.

Update the structural manifest and semantic parts honestly. Keep the authoritative count of four primary wings; an upper/lower subpart split is allowed.

## Verification

Run typecheck, main build, structural build, all structural captures, stage contact sheet, and performance probe.

Technical gates remain:

- p99 `< 8 ms`;
- browser/page errors `0`;
- four base clones and four upper clones;
- gameplay-scale captures remain distinct;
- no rear stair.

Commit only the scoped structural factory, any necessary capture/report adjustment, and this contract with prefix `PTC-CLAY-02`.
Do not self-approve visually.
