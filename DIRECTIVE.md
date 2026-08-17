# DIRECTIVE — art quality: 3 concrete gaps to close (validated reference available)

A validated pixel-art technique now exists. The user wants the game's units/buildings/terrain
to actually LOOK like AoE2:DE. Grok-vision (the critic) has inspected the REAL build and
named EXACTLY 3 remaining gaps. Close them in this order of impact.

## The validated reference (read this first)

`src/art-reference.ts` — my hand-written reference showing the TECHNIQUE that works:
- Draw a dark INK silhouette of the WHOLE connected form (head+neck+torso+pelvis+legs, weapon) FIRST.
- Fill with a top-left key light, 3 tones (Hi on upper-left, Mid, Dk on lower-right).
- ONE dominant weapon/tool, HELD by skin-tone grip pixels.
- Building = roof (wide at eaves, narrow at peak) + wall plane + a short dark door INSET at
  bottom-center + 1px lit window slots.
See it rendered at http://localhost:5173/reference.html (run `npm run dev`, screenshot).

## GAP 1 — QUIET THE GROUND (biggest win, do first)

Critic verdict: "purple-and-white zigzag tiling is so noisy that small units vanish into it
and dark building slabs lose their edges." The terrain is DROWNING the sprites.
Fix: make the ground a CALM, low-contrast dust field — near-flat base tone with subtle,
large-scale value variation (not high-frequency zigzag/checkerboard). Kill the repeating
stamp. Sprites must pop against it. Reference: the quiet-dust value-weather idea in
`references/sand-shader.jpg` + `notes.md`. Priority: this alone will make everything readable.

## GAP 2 — BUILDINGS still read as "black slabs, no doors/windows"

My door/roof fix landed in `src/art-reference.ts` but NOT in the full-roster `src/sprites.ts`
(which is what `sprite-sdf.ts`/render.ts actually uses). Port the fix: every building (hall,
house, barracks, unique × 3 civs) must have a readable ROOF (wide at eaves), a wall plane
with 1px lit WINDOW slots, and a short dark DOOR at bottom-center on the ground. No black box
with a gold sticker.

## GAP 3 — some units still render as "tiny orbs" and "floating gold diamonds" (no weapon)

Not every role got the character treatment. Audit `src/sprites.ts`: EVERY unit role (worker,
scout, fighter, siege + ravager/prism/shade) across all 3 civs must be a CONNECTED character
with a dominant weapon/tool and facing — no small orbs, no floating diamond-with-no-gun.

## How to execute (fan out)

1. Spawn one Composer 2.5 builder per gap, IN THIS ORDER (GAP 1 first; it's the highest
   impact and changes the base the others render on). Command template (bounded!):
   `cursor-agent --trust --yolo --print --model composer-2.5 -p "$(cat tasks/P9X-brief.md)" > tasks/p9x.log 2>&1`
   Do NOT use `timeout` (not on macOS). Reap each sub-agent process when it exits (kill the
   tmux session + any lingering `composer-2.5` PID). No leaks.
2. After EACH gap, verify yourself with `scripts/screenshot.mjs` (or playwright) + a fresh
   Grok-vision critic (`cursor-agent --model cursor-grok-4.6-xhigh <screenshot> "judge vs AoE2:DE"`),
   NEVER from the builder's own report.
3. Iterate a gap until the critic passes it, then move to the next.
4. Keep 60fps (startup sprites + instances; no per-frame cost), deploy each pass, commit with
   the piece id, update PROGRESS.md.

Report status by updating PROGRESS.md and notes.md's art section. This is the active work;
do not idle.
