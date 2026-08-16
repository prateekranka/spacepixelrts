# PROCEDURAL-FIRST RENDERING — architecture directive (from user)

## User requirement (verbatim intent)

"make whatever is possible procedural and not loading from disk/cache. keep that the first
option. cache js obviously second and safe one."

## What this means for Starhold

1. **No art loaded from disk/cache. Everything generated at runtime.**
   - Good news: the existing `src/atlas.ts` already draws every sprite procedurally at
     startup (no PNG/JSON/model assets). That baseline already satisfies "no disk assets."
   - The target is to go **further**: eliminate the baked texture atlas entirely where it
     pays off, computing shape + color in the **fragment shader** (SDFs) and simulating
     particles on the **GPU**, exactly like the references. This is procedural trivially
     because it never touches a texture in the first place.

2. **Priority order for the migration (do these in this order):**
   a. **GPU-instanced particle VFX** (`src/render.ts` sparks/bolts today are atlas quads →
      convert to a dedicated `THREE.InstancedMesh`/points with a GLSL particle shader:
      additive blending, per-particle age, seeded pseudo-random spread, "broken plume" look.
      Reference: chirovisuals "GPU-simulated instanced particles, hand-written GLSL").
   b. **Procedural terrain in shader** (replace the flat/checkerboard dust with value-weather +
      two-scale dune banding + discrete elevation steps with a 1px sun rim — references:
      junglesilicon sand shader, iced_coffee_dev terrain). Must stay pathable/readable at
      RTS zoom (no noisy soup).
   c. **SDF-based unit/building quads** (drive the existing `fragmentShader` off a per-instance
      "shape id" instead of sampling the atlas — the `p.diam/hex/circ/line` calls in
      `atlas.ts` translate 1:1 to GLSL SDF primitives, so this is a mechanical but careful port).
      Keep crisp nearest-neighbor pixel look; keep team-color key.

3. **The 60fps / landscape-iPad budget stays supreme.** Every change must keep p99 < 8ms and
   zero per-frame allocation on hot paths. GPU compute is the *ally* here, not a threat — that's
   the whole point of the references.

4. **JS remains the safe cache target.** The bundle is what gets cached; no runtime art is cached.

## Reference material (already downloaded to `references/`)

- `widelands.png` (RTS character/logistics reference), `fire-spread.png` (porous plume),
  `grass-shader.jpg`, `sand-shader.jpg` (value weather + dune banding),
  `terrain-1.jpg`, `terrain-2.jpg` (discrete elevation bands + 1px sun rim).
- Grok-vision already extracted the concrete "steals" — see `notes.md` (the procedural-first
  section) for the per-image takeaway.

## Handoff

Treat this as the next major wave after Wave 5 coherence. Don't let it collide with active
sub-agents: finish/coordinate the current P7x sub-agents first, then start the migration as
individual pieces (P80 = GPU particle VFX, P81 = procedural terrain, P82 = SDF units/buildings),
each with a Composer 2.5 builder + fresh critic, same loop as always. Keep deploying.
