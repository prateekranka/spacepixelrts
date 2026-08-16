# Unit & Building Character Redesign — spec (P90)

## Problem (verified by Grok-vision critic on the running build)

Units currently render as **geometric "marbles/flasks"** — a shared per-civ hex/diamond/blob
body with a tiny role overlay. At 32px they read as "blue teardrops", "gold marbles",
"perfect blue marbles", not as soldiers/workers/vehicles. Buildings are "identical cubes
with a flat mint-green rectangle on the face" — no door, roof, windows, or identity.

The SDF pipeline is fine. The **sprite drawing** (`src/sprite-sdf.ts`) is the problem: it
faithfully ported the OLD weak geometric shapes instead of drawing characters.

## Goal

Every unit must read as a **distinct creature/vehicle with anatomy and a weapon, facing a
direction**, at 32px, silhouettable against a colored pawn — the way a Longbowman reads as
"a person with a bow" at a glance in AoE2:DE.

## Design principles (apply to every sprite)

1. **Silhouette-first.** Each role gets a DIFFERENT outline. A fighter, worker, scout, siege
   must NOT share a body shape. If you squint, you should still tell them apart.
2. **Anatomy.** Units are bodies: a head (or cockpit/walker core), a torso/hull, limbs or
   treads, and a WEAPON or TOOL. Facing must be readable (weapon points one way).
3. **Role tell is the dominant feature**, not a 3px overlay. A worker carries a big ore crate
   / mining rig; a scout is a lean speed hull with a sensor dish and exhaust; a fighter holds
   a gun/spear; siege is a heavy treaded crawler with a big cannon.
4. **Civ identity = material + palette + body family**, not shape. Helion (vespari) = organic
   hive-chitin rounds; Kryos (aurion) = angular faceted crystal; Nihiline (voidmarked) =
   tattered asymmetric tendrils. Keep these motifs but subordinate them to role.
5. **Crisp pixel look** stays: nearest-neighbor, limited palette, hard edges, 1px dark ink
   outline like the rest of the game.

## The roster to redraw (all 3 civs × these roles)

- **worker** — hunched, carries a big glowing ore/gas crate or a mining drill; hard-hat beacon.
- **scout** — lean, low, forward-thrust; big sensor dish/wing, engine exhaust glow.
- **fighter** — braced stance, a clear gun/spear barrel pointing forward, shoulder armor.
- **siege** — heavy crawler/tank, large elevated cannon, treads/wheels, anti-building weight.
- **ravager** (vespari unique) — frenzied melee beast, big scythe/claw arms lunge forward.
- **prism** (aurion unique) — floating crystal with a focus lens, beam weapon.
- **shade** (voidmarked unique) — cloaked infiltrator, visible only as tatters + one glowing eye.

## Buildings to redraw (all 3 civs × these)

- **hall** (town center) — a REAL structure: distinct roof, an entrance/door, a central
  spire/mast, civ masonry. NOT a flat rectangle with a green billboard.
- **house** — small but identifiable: pitched/domed roof, a door, a light/window.
- **barracks** — military: banner/weapon racks on the face, a gate.
- **unique building** — the civ's signature silhouette (Spore Nursery / Refraction Spire /
  Umbra Relay) — most distinctive of all.

## Implementation notes

- Everything stays in `src/sprite-sdf.ts`, GLSL SDF primitives (`inCirc`, `inDiam`, `inHex`,
  `inBox`, `paint`, `paintMag`, `line` if present). Add a `line(a,b)` SDF if missing for
  weapons/limbs. No textures, no atlas — procedural only (user directive).
- Coordinate space: `p`/`q` in the range roughly [-16..16] for a 32px unit ([-32..32] for the
  64px hall). Keep units within bounds; buildings use their half-size.
- Keep `spriteCore` / `unitBody` / `unitRole` entry points wired the same, so render.ts and
  the frame/animation/corpse logic keep working. You may restructure the internals freely.
- Team color remains the `paintMag` magenta-key mechanism (don't break it).
- Animation frames must still work (the `frame`/`bob` and dissolve/corpse branches).

## Definition of done

A fresh Grok-vision critic, comparing a zoomed screenshot blind to AoE2:DE, can name each
visible unit's role AND faction at a glance, and says the units look like *characters with
weapons*, not colored tokens. Iterate until that critic passes.
