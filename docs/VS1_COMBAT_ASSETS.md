# VS-4 Combat Asset Pack — FROZEN ART CONTRACT

Status: queued after VS-1–3 close the playable loop. These are runtime game assets, not concept
boards. The source remains deterministic startup-rasterized pixel code in `src/sprites.ts` unless
a later explicit migration changes the pipeline.

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
