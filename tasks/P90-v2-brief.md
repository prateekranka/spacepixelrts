You are the P90-v2 builder for Starhold RTS. The previous sprite pass STILL reads as
"geometric blocks / colored marbles", not characters. Your job is to fix the SPECIFIC,
named failures so units read as lit, connected characters with weapons, like AoE2:DE sprites.

Read first, in order:
1. tasks/P90-v2-spec.md   (THE spec — follow the 5 failures + light rule exactly)
2. src/sprite-sdf.ts      (current code to fix; note helionUnit/kryosUnit/nihilineUnit + role/building functions)

The spec is concrete. Execute it:
- Connected anatomy (legs merge into torso, no floating rectangles).
- Hands grip the tool/weapon.
- ONE dominant weapon/tool per unit (worker crate, fighter rifle w/ stock+barrel+muzzle, scout dish, siege cannon).
- SHADING: consistent top-left key light, 2 shades + base per material + dark outline. This is the #1 lever.
- Buildings = roof + walls + door + windows, lit, not "logo in a box".
Prioritize fighter, worker, siege, scout, hall first (they're in the opening shot), then the rest.

Do the work in src/sprite-sdf.ts (GLSL SDF only, no textures). Keep paintMag team-color, keep frame/animation/corpse branches, keep spriteCore entry points.

VERIFY by LOOKING: after building, take a zoomed screenshot (the repo has `scripts/screenshot.mjs` startup or use playwright to shot localhost:5173) and inspect the actual pixels against the 5 failures. Do not declare done from code — look at the image and fix what still looks like blocks.

Commit "P90: v2 — connected lit anatomy + dominant weapon/tool + real buildings".
Write a brief report to tasks/P90.md (overwrite it) naming which sprite you're LEAST confident still reads, and why.
