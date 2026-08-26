# AAA Front-End Art Spec — Starhaven Civilization Scene Packs

Status: **FROZEN** (lead-owned). Branch: `hermes/starhaven-aaa-front-end`.
Parent: `codex/starhaven-menu-rebuild` (PR #10, DOM menu architecture preserved).
Replace: procedural scenes in `src/front-end-scene.ts` (placeholder geometry).

## 1. Objective

Replace the current procedural Sunweaver and Gravemark menu/loading scenes with final
AAA-quality illustration packs. A pack = authored layered art assets in one shared
1920x1080 coordinate system. No flattened single image. No hue-rotated copy.

Four packs:
1. `sunweaver/menu`
2. `sunweaver/loading`
3. `gravemark/menu`
4. `gravemark/loading`

Deliverable path (public assets, relative to repo root):

```text
public/front-end/civilizations/
  sunweaver/menu/    sky.webp celestial-body.webp far-terrain.webp settlement.webp
                     foreground.webp atmosphere.webp lights-mask.png ships.png
                     ship-thrusters-strip.png beacon-strip.png flag-strip.png energy-strip.png
  sunweaver/loading/ sky.webp celestial-body.webp settlement.webp foreground.webp
                     atmosphere.webp carrier.png dropships.png thrusters-strip.png beacon-strip.png
  gravemark/menu/    sky.webp celestial-body.webp far-terrain.webp quarry-city.webp
                     foreground.webp atmosphere.webp lights-mask.png grav-skimmers.png
                     crane-strip.png mineral-strip.png gravity-field-strip.png
  gravemark/loading/ sky.webp celestial-body.webp fortress.webp foreground.webp
                     atmosphere.webp heavy-carrier.png drop-pods.png thrusters-strip.png
                     gravity-beam-strip.png
```

Plus `manifest.json` in `sunweaver/` and `gravemark/` listing every layer with
z-order, blend mode, display rect (960x540 logical space = half of 1920x1080),
and animation metadata (see integration spec).

## 2. Coordinate system

- Master canvas: exactly 1920x1080 (exported from generator output: crop/resize to fit).
- Scene logical space: 960x540 (canvas is drawn at 960x540 and CSS-scales with
  `object-fit: cover`). Every asset rect in `manifest.json` is in 960x540 units.
- The generator output is near-16:9; the export step cover-crops/letter-free-fits
  all generations through the same mapping so layers stay aligned.

## 3. Quality bar (blind gates must beat this)

Match the previously approved Starhaven key art (`03-approved-neon-colony-main-menu.png`,
`04-approved-helios-rift-loading.png`):

- Highly detailed sci-fi pixel-art illustration. Pixel steps visibly crisp at 1x.
- Modern AAA lighting and depth: rim light, bloom, hard key + soft fill.
- Rich atmospheric perspective: at least 5 depth planes (sky/body → far terrain →
  settlement → ground → foreground) with value and saturation falloff.
- Strong foreground/midground/background separation; readable silhouettes.
- Deep space atmosphere; dense-but-controlled environmental detail.
- No generic procedural geometry, no low-poly placeholder look.
- No UI text, buttons, logos, or labels baked into any layer.

## 4. Civilization art direction

### 4.1 Sunweaver — elegant solar civilization

Environment: giant warm star / sunrise / luminous solar body (upper-left third).
Architecture: refined vertical towers with solar lattice filigree, elegant energy
spires, suspended bridges between towers, open plaza terraces, airy voids.
Vehicles: light agile spacecraft, sail-like Wind Strider traffic.
Palette: warm white, amber, gold, restrained cyan, deep indigo sky.
Composition: open horizon, generous negative space, tall slender masses,
optimistic intelligence. `menu` scene keeps an open, calm right side
(sky+dust only) behind the DOM menu. `loading` scene keeps the lower-center calm
behind the progress readout.

### 4.2 Gravemark — industrial extraction

Environment: fractured moon / asteroid field / dark ringed planet (upper-left third),
gravity anomaly glow.
Architecture: fortified quarry-city embedded into cliffs and mineral terrain;
excavation shafts, gravity cranes, ore conveyors, armored structures;
heavy industrial silhouettes, low and wide.
Vehicles: Grav-Skimmers, heavy carriers, massive machinery.
Palette: obsidian, steel, mineral green, ice blue, restrained warning lights.
Composition: denser foreground framing (cables, gantries, rocks), lower heavier
skyline, territorial mass; `menu` keeps a calm right side; `loading` keeps
lower-center calm.

No recolor of Sunweaver; distinct silhouette language, geometry, and palette.

## 5. Layer contract (z-order for a menu pack)

1. `sky.webp` — opaque full-bleed gradient + stars + atmospheric glow. No body.
2. `celestial-body.webp` — additive (screen) glow disc on pure black. Alpha=light.
3. `far-terrain.webp` — transparent-backed ridge/backdrop band. Chroma-keyed.
4. `settlement.webp` / `quarry-city.webp` — transparent-backed architecture mass.
5. `foreground.webp` — transparent-backed dark framing shapes (corners/bottom).
6. `atmosphere.webp` — additive haze/light shafts on black (screen blend).
7. `lights-mask.png` — programmatic white mask of the settlement's bright lights
   (used for twinkle animation; NOT art).
8. Sheets: `ships.png` (multi-sprite sheet), `*-strip.png` (N-cell animation strips).

Loading packs: same but `settlement` → `carrier.png`/`dropships.png` (Sunweaver),
`fortress.webp` + `heavy-carrier.png`/`drop-pods.png` (Gravemark).

## 6. Production method

1. Generate two strong 16:9 menu key-art candidates per civilization (lead).
2. Visually review against the brief + approved bar; select the strongest.
3. Refine the selected master once if a specific gap exists (composition, density, calm zone).
4. Generate a matching loading-screen composition per civilization.
5. Generate separate layer art guided by the selected master (same anchors:
   body position, horizon line, settlement baseline, calm zone).
6. Consistent styling: all generations share the style block from §7.
7. Cut/export each asset to the 1920x1080 master coordinate system; strips and
   sheets get exact cell geometry; sprites get transparent backgrounds
   (chroma green key for opaque sprites, black+luminance-alpha for glow sprites).
8. Assemble a full-frame composite locally and gate it before integration.

## 7. Style block (append to every generation prompt)

"Premium AAA strategy-game key art, painted PIXEL ART illustration, crisp visible
pixel steps at 1x, absolutely no text, no letters, no UI, no icons, no borders;
modern AAA lighting with rim light and bloom, rich atmospheric perspective,
deep space atmosphere, dense but controlled environmental detail, strong
foreground-midground-background separation, readable silhouettes, no generic
procedural geometry, no low-poly placeholder look, 1920x1080 16:9 composition."

## 8. Acceptance gates (run before integration)

G1. Every listed file exists, formats correct (webp for scenic, png for sheets/masks).
G2. Every scenic asset is exactly 1920x1080 (cover-mapped); sheets/strips/masks lie
    on the same coordinate system.
G3. Layered composite of `menu` assets re-forms the master composition
    (vision gate: PASS on deep space atmosphere, depth planes, silhouette readability).
G4. The right 45% of menu masters is calm enough for DOM overlay; the lower-center
    of loading masters stays readable under the progress UI.
G5. No text/letters/UI pixels in any asset (mask sweep: no white label blobs).
G6. Sunweaver vs Gravemark genuinely distinct: different environment, architecture,
    vehicles, silhouettes, palette composition (blind critic verifies).
G7. Strips contain 6 cells each (6 frames at 12 fps = 0.5 s loop), EXCEPT
    `flag-strip.png` and `energy-strip.png` (8 cells) — frame counts match manifest.
G8. 1920x1080 export of every master; master files kept under
    `assets/front-end/masters/` for provenance.
