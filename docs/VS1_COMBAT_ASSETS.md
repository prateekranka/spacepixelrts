# VS-4 Combat Asset Pack — FROZEN ART CONTRACT

Status: **ACTIVE R2 / FROZEN** after VS-1–3 closed the functional playable loop. These are
runtime game assets, not concept boards. R1 (`1b4c658`, local/unpushed) passed all 64 pixel/shader/
performance contracts but fresh Sol failed normal-scale readability: Rift Guard collapsed into a
near-black bar and Burden Walker merged with terrain. R2 applies the critic's exact measurable
prescription before any acceptance. The source remains deterministic startup-rasterized pixel code
in `src/sprites.ts`. The managed image endpoint timed out three times before charging, so it is not a
production dependency; this pack uses the repository's regenerable pixel pipeline.

## Shared production rules

- full isometric 3/4 camera: 45° yaw, 30° visual elevation;
- upright unit source height 48px in a 64×64 transparent cell;
- 8 facings; author N, NE, E, SE, S and mirror the rest where valid;
- 2-frame walk/idle motion per facing; existing hit/muzzle/corpse systems remain;
- near-black 1–2px connected outline; no detached pixels at normal gameplay scale;
- top-left key light; three-value material ramps; no smooth gradients;
- one small emissive team/faction focus per unit, never a full-body glow;
- readable as a black silhouette at 48px and at normal 1366×1024 camera height;
- one shared combat atlas, NearestFilter, no extra per-unit textures or draw calls.

## Sunweaver material language

- ivory calcite / cloth body mass;
- polished sun-gold brass structure;
- teal sunlit fabric or panel secondary;
- turquoise/cobalt small mechanism detail;
- cyan-amber focus lens;
- rounded arcs, rays, circles, light/open negative space.

### Lumen Guard — `Kind.Fighter` + Sunweaver

Anchor silhouette. Body behind one round shield occupying ~40% of sprite width. Long spear extends
above and outside shield. Helmet/cowl small; planted wide stance. The shield carries the only bright
sun-ring focus. Must never read as Worker or Wind Strider.

### Solar Strider — `Kind.Ravager` + Sunweaver

Low quadruped support walker. Four independent legs, long horizontal hull, raised circular sun-disk
engine over shoulders, compact forward emitter. Width ~1.5× height. No humanoid torso. Emissive
focus is the engine center.

## Gravemark material language

- carved basalt and ash-gray stone plate;
- obsidian shadow mass;
- bone-gold runes/edge clamps;
- dark grave cloth only as a small flexible secondary;
- one cobalt-blue void-crystal focus;
- square blocks, heavy verticals, wedges, compressed negative space.

### Rift Guard — `Kind.Fighter` + Gravemark

Anchor silhouette. Tall rectangular tower shield occupying ~45% of width and almost full body
height. Crystal spear rises over the opposite shoulder. Deep hood/visor, compact legs. Emissive
focus is one shield-set cobalt crystal. Must be visibly heavier and more rectangular than Lumen
Guard.

### Burden Walker — `Kind.Prism` + Gravemark

Massive high-backed quadruped industrial walker. Four thick block legs, short heavy hull, raised
rift-engine drum/cargo block, forward crystal cannon. Width ~1.4× height but visually taller and
heavier than Solar Strider. Emissive focus is the engine crystal, not all seams.

## Locked runtime architecture

Keep the existing 32px unit/building atlas stable. Add one separate combat strip to `SpriteAtlas`:

- `combatCanvas`: 1024×256 RGBA;
- cell 64px, 16 columns (`8 facings × 2 live poses`), four rows;
- row 0: Sunweaver Fighter / Lumen Guard;
- row 1: Sunweaver Ravager / Solar Strider;
- row 2: Gravemark Fighter / Rift Guard;
- row 3: Gravemark Prism / Burden Walker;
- pose 0 serves idle/live frame 0; pose 1 serves walk frames 1/2 and attack frame 3;
- corpse/dissolve frames 4–6 stay on the tested legacy atlas;
- other internal civ/kind combinations stay legacy.

`SDF_FRAG` samples this strip only for the four live combinations. It receives one shared
NearestFilter texture and adds no mesh/material/draw call. Extend `SpriteAtlas`/renderer uniforms;
do not add per-unit textures.

Moving combat units preserve real world 8-dir facing with the existing exported `dir8`; this is
presentation state only. Existing legacy billboards may keep their horizontal mirror behavior.
`drawCombatSprite(row, dir, pose): Pix` remains the pure exported regeneration/test seam; authored
directions are E/NE/N/S/SE and W/NW/SW stay exact mirrors.

Normal-world R2 scale (raised only because normal-scale evidence failed):

- Lumen Guard: ~1.18 wide × 1.40 high;
- Solar Strider: ~1.52 wide × 1.14 high;
- Rift Guard: ~1.24 wide × 1.42 high;
- Burden Walker: ~1.52 wide × 1.34 high.

## R2 normal-scale readability floor

The following checks are added RED before any R2 source edit:

- each Guard source alpha bound is at least 24×44px;
- each Walker source alpha bound is at least 44×28px in every facing;
- each Guard spear reaches into rows 0–2 while the main body begins at row >=11, so the weapon
  projects at least 10px beyond the body;
- at least 30% of every unit's non-transparent pixels have luma >=65 (at least 25 points above
  quiet Helios terrain); this uses material planes, not added emissive;
- Rift Guard's shield receives a broad slate/steel plane and its ice spearhead remains visibly
  outside the shield; Burden Walker's hull/engine receive broad slate/steel planes and a wider
  front/back footprint;
- Solar Strider receives connected side stabilizers so front/back bounds meet the 44px Walker floor;
- source MAG share remains 0.5–5%, runtime MAG remains zero, connectivity/mirror/direction/pose/IoU
  gates remain green, and draw calls remain unchanged.

The R2 visual gate uses the same unlabeled normal-scale lineup and battle framing as R1. No crop-only
or contact-sheet pass can override a failed normal-scale frame.

## Export and objective proof

A Playwright export script writes outside repo:

- combat atlas PNG;
- 4×8 facing contact sheet at 4× nearest-neighbor scale;
- normal-scale lineup over quiet Helios terrain;
- battle frame with both factions.

Automated checks:

- every cell alpha coverage 12–55%;
- no empty cell;
- N vs E mean pixel delta > 18;
- two motion frames delta > 4 and < 45;
- silhouette overlap between Lumen/Rift Guards < 78%;
- silhouette overlap between Solar/Burden Walkers < 78%;
- emissive share 0.5–5%;
- no magenta key pixels survive runtime substitution;
- draw calls unchanged from pre-pack battle fixture.

Fresh Sol judges one normal-scale battle frame blind. Required visible verdict: factions and all four
combat roles are distinguishable without labels. If not, fix the single largest silhouette gap.
