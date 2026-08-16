You are the P90 builder for Starhold RTS (a pixel-art space RTS). Your ONE job: redesign the
unit and building sprites so they read as real characters, not geometric blobs.

Read first, in order:
1. tasks/P90-spec.md   (the full design spec — follow it exactly)
2. src/sprite-sdf.ts   (the current SDF sprite code you will rewrite)

Current problem (verified by a vision critic): units render as shared per-civ hex/diamond/
blob "marbles" with a tiny role overlay, so a fighter/worker/scout all look like the same
colored shape. Buildings are flat rectangles with a green banner. They must instead read as
distinct creatures/vehicles WITH anatomy and a weapon, facing a direction, at 32px — like a
Longbowman reads as "a person with a bow" in AoE2:DE.

Your task:
- Rewrite the sprite-drawing functions in src/sprite-sdf.ts per the spec: unitBody/unitRole
  (or restructure them) so each role has its OWN silhouette + weapon + facing, and each
  building has a distinct profile with door/roof/civ identity.
- Keep: GLSL SDF primitives only (no textures — procedural only), the paintMag team-color
  key, the frame/animation/corpse/dissolve branches, and the spriteCore entry points render.ts
  calls. Add an SDF line() helper if missing for weapons/limbs.
- Use the civ identity motifs (hive-round, crystal-angular, void-tattered) subordinate to role.

Verify:
- `npx tsc --noEmit` clean.
- `npm run build` succeeds.
- The dev server screenshot (localhost:5173) actually shows recognizable characters.

Commit with message "P90: redesign unit+building sprites into readable characters (no blobs)".

Do NOT stop at "compiles" — the point is the sprites must LOOK like characters. Iterate on the
shapes until a fighter reads as a gunner, a worker reads as a hauler, a scout reads as a scout,
a siege reads as a tank. Write a short report to tasks/P90.md with what you changed and a note
on which role you're least sure reads correctly. Be thorough; this is the whole deliverable.
