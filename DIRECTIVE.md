# DIRECTIVE — Isometric rewrite, Wave A (the skeleton). Locked plan.

Read `docs/ISO_REWRITE_PLAN.md` first — it is the locked contract with 9 user-confirmed
decisions + a scope guardrail. Follow it exactly.

## What you are doing now: Wave A (bones before skin)

The user wants the game to LOOK like StarCraft II / Brood War (space, 3 races). The design
is fine (preserve it); only the look is being rewritten. Wave A is the foundation — three
changes, in this order:

1. **ISOMETRIC 3/4 projection.** Convert the top-down orthographic renderer to StarCraft-style
   iso (~2:1 diamond). Buildings show two sides + roof; units are upright depth-sorted sprites. The
   world is a 2D grid, so this is mostly a camera + sprite-billboarding + depth-sort change
   in `src/render.ts`, not a sim change. The sim (src/sim.ts, src/engine.ts) is UNTOUCHED.

2. **PROCEDURAL TERRAIN ELEVATION (mountains + valleys).** The user explicitly wants
   mountains/valleys on EVERY map as battle-changers (chokepoints, high ground, ramps) — not
   flat plains. Implement a heightmap in map generation: elevation levels, cliff faces, ramp
   tiles, high-ground readable in iso. Quiet low-frequency ground color (the noisy checkerboard
   we kept fighting must stay gone). See `references/` map sheets + terrain-*.jpg for the look.

3. **EMISSIVE TEAM COLOR.** Replace the loud `#FF00FF` facade banner with ONE subtle emissive
   glow region (lens/engine/staff-orb/trim) tinted to team color, per the references. Kill the
   magenta-banner look.

## Hard rules

- PRESERVE the game design and the sim. Branch/commit so the sim and all critic-passed Wave
  2-5 gameplay keep working. Only visual/render/terrain files change.
- Sub-agents are Composer 2.5, bounded (no `timeout` — it's absent on macOS; reap processes +
  tmux sessions when done, no leaks). Verify each with a fresh Grok-vision critic against the
  ACTUAL running build — never from a self-report:
  `cursor-agent --trust --print --model cursor-grok-4.6-xhigh "<screenshot> judge blind vs StarCraft II, name the single biggest gap"`.
- 60fps holds (p99 < 8ms). Deploy each pass to Cloudflare Pages `spacepixelrts`; commit each
  piece; keep PROGRESS.md and notes.md current.

## Sequencer

Do (1) projection first (everything hangs off it), then (3) emissive team color (small,
isolated), then (2) terrain elevation. Get a critic PASS on the projection + team color
before the bigger terrain-elevation work, so we don't build terrain on a wrong projection.

Report status by updating PROGRESS.md. This is the active work; do not idle.
