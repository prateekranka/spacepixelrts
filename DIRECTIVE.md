# DIRECTIVE — new priority from user (read now)

The user has issued a new architecture directive: **procedural-first rendering, nothing
loaded from disk/cache.** Full spec is in `docs/PROCEDURAL.md` — read it now.

Summary of what to do:
1. Finish the current P7x sub-agent work (Wave 5 coherence) without abandoning it.
2. Then start the procedural migration as three pieces, in order:
   - **P80** GPU-instanced particle VFX (convert sparks/bolts from atlas quads to a GLSL
     particle shader — additive, per-particle age, "broken plume").
   - **P81** procedural terrain in shader (value weather + dune banding + elevation rims).
   - **P82** SDF-driven unit/building quads (shape id in fragment shader, drop the baked atlas).
3. Each piece gets a Composer 2.5 builder + fresh critic, same loop. Hold 60fps (p99 < 8ms).
4. The JS bundle remains the cache target; no runtime art is cached.

Reference images are in `references/`; per-image takeaways are in `notes.md` and
`docs/PROCEDURAL.md`. Do NOT let new builders collide with the active P7x sub-agents —
queue them until the current ones finish.
