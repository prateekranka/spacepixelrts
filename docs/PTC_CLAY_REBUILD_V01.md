# PTC-CLAY-01 — Neutral Modular Structural Rebuild

## Scope

Build a new geometry-only Town Center beside the frozen `SunweaverTownCenter_Blockout_v00`.

New asset ID: `SunweaverTownCenter_Structural_v01`.
Canonical civilization: `Sunweaver`.
Front/south axis: world `+Z`.

Do not edit `src/sim.ts`, `src/engine.ts`, the old blockout appearance, game content, materials, or effects.

## Authoritative inputs

1. `references/Sunweaver_TownCenter_Reference_v01/00_spec.json`
2. isolated reference images in that directory
3. `docs/SUNWEAVER_TOWN_CENTER_REBUILD_SPEC.md`
4. this piece spec

Do not inspect old candidate renders as design references.

## Required new files

- `src/sunweaver-town-center-structural.ts`
- `src/town-center-structural-viewer.ts`
- `town-center-structural-viewer.html`
- `vite.structural.config.ts`
- `scripts/town-center-structural-shots.mjs`

QA output root: `critic/out/town-center-structural-v01/`.

## Geometry contract

Use footprint diameter `7.0` world units. Apply the normalized dimensions from `00_spec.json`.

### Persistent hierarchy

```text
SunweaverTownCenter_Structural_v01
├── stage-1
│   ├── foundation_disc
│   ├── entrance_axis_marker
│   └── central_socket
├── stage-2
│   ├── lower_drum
│   ├── entrance_bay
│   ├── broad_front_stair
│   └── primary_wing_source ×4
├── stage-3
│   ├── upper_drum
│   ├── secondary_buttress_source ×4
│   ├── side_crystal_tower_source ×4
│   └── cage_base
└── stage-4
    ├── central_crystal
    ├── crystal_cage_arch_source ×4
    └── stage_4_crown
```

### Repetition

- Build one source group for each repeated module type.
- Clone the source at deterministic 90° intervals.
- Primary wing centers use cardinal axes.
- Four side towers flank the cardinal wings on the diagonal axes, so front view reads two side towers plus one taller center.
- Secondary buttresses use the diagonal rhythm without creating extra tall peaks.
- Geometry and material objects must be shared across clones where Three.js permits it.

### Form rules

- One broad ceremonial stair at `+Z` only. No rear stair.
- Four primary wings must project beyond the drums as distinct lobes.
- The lower and upper drums are support volumes, not the dominant silhouette.
- The entrance is a deep recessed pointed arch volume. Do not use a flat shield/window.
- Side towers are integrated architectural buttresses with a base, tapered shaft, and pointed cap. Do not use plain cylinders.
- The crown has four substantial cage arches around one tall faceted central volume.
- Use custom lathe profiles, extruded shapes, wedges, and shared modules. Debug primitives can exist inside modules, but the final silhouette must not read as stacked cylinders.
- Preserve an explicit 4-fold major rhythm and 8-fold secondary rhythm from top view.

## Clay material and light lock

Use exactly one visible neutral clay material for all structural geometry:

- base color near `#B8B4AC`;
- metalness `0`;
- roughness `0.82–0.9`;
- no emissive;
- no texture maps;
- no faction colors;
- no cloth;
- no foliage;
- no decorative ground crystals.

Use a flat mid-gray background, restrained hemisphere light, one soft directional key, one weak fill, and fixed exposure. Do not use bloom, saturated lights, or flattering glow.

## Runtime contract

Export a factory and runtime object with:

- `root`;
- `parts` by semantic module ID;
- `setStage(1|2|3|4)`;
- `getStage()`;
- `setExplode(t)`;
- `structuralManifest` containing module counts, source IDs, entrance axis, footprint, normalized dimensions, and world-space module centers.

The root must expose this through `userData.sculptRuntime` and `userData.structuralManifest`.

## Fixed viewer cameras

The viewer must support query parameters `ui=0`, `view=...`, `stage=1..4`, `pass=...`, `freeze=1`.

Required views:

- `front-ortho`
- `right-ortho`
- `back-ortho`
- `left-ortho`
- `top-ortho`
- `front-3q`
- `rear-3q`
- `gameplay-close`
- `gameplay-normal`
- `gameplay-far`

Required passes:

- `beauty` — neutral clay only
- `silhouette` — pure black object on white background
- `wireframe`
- `normal`
- `depth`
- `material-id` — semantic module colors for QA only; this is not an asset material pass

Every capture uses the same fixed camera definition, exposure, ground plane, and light rig for its view. No orbit auto-rotation during QA.

## Construction stages

Stages are additive and persistent:

- Stage 1: foundation, front-axis marker, center socket.
- Stage 2: lower drum, broad front stair, deep entrance volume, four wing bases.
- Stage 3: upper drum, four integrated side towers, four secondary buttresses, cage base.
- Stage 4: four cage arches and final central crown volume.

The footprint, origin, entrance direction, and prior modules do not move between stages.

## Capture harness

`scripts/town-center-structural-shots.mjs` must capture:

- ten required beauty views;
- front/right/back/left/top silhouette views;
- front wireframe, normal, depth, and material-ID views;
- four stage views from the fixed front-3q camera;
- a construction-stage contact sheet if practical.

The script must fail on browser console errors, page errors, missing runtime, or an empty/black capture.

## Performance and verification

Run:

- `npx tsc --noEmit`
- `npm run build`
- `npx vite build --config vite.structural.config.ts`
- canonical structural screenshot script
- existing FPS/console probe against the structural viewer

Target: p99 `< 8 ms`, console errors `0`.

Commit only the new structural files and this contract with prefix `PTC-CLAY-01`.
Do not claim visual acceptance. Sol and isolated Luna B judge the images.
