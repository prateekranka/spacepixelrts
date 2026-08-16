# P90-v2 — sprite art: the SPECIFIC failures to fix

The v1 pass confirmed units STILL read as "kids' blocks robot / colored marbles," not
characters. Grok-vision named exact failures. Fix THESE, concretely.

## The 5 failures (each must be visibly fixed)

1. **Disconnected anatomy.** Fighter has "foot rectangles with a gap under the torso, no
   legs." Feet are not connected to the body. Fix: draw legs as a CONNECTED form (pelvis +
   thigh + knee + foot) in one or two filled regions that overlap the torso. No floating
   rectangles. A leg is a tapered column that touches the torso and reaches the ground.

2. **Hands/arms are sticks in the air.** Worker "two cream rectangles in a Y, no elbows,
   no hands." Fix: arms bend, end in a hand/gripper that TOUCHES the tool/weapon. The
   worker's BOTH hands must visibly wrap the crate/drill (draw the grip as hand overlapping
   the cargo edge).

3. **Weapon/tool not dominant or not readable.** A "cream slab" is not a gun. Fix: give each
   unit ONE tool that is the biggest single element of its silhouette after the body:
   - worker: a crate/drill that is ~1/3 of the sprite width, held in TWO hands against the chest.
   - fighter: a rifle with a visible STOCK (at shoulder), BODY, and MUZZLE (2px tip) — longer
     than the torso is tall.
   - scout: a sensor dish that is a clear circle-with-bracket (bigger than the body is tall).
   - siege: a cannon that is a clearly elevated, thick barrel + muzzle brake, NOT a gray line.

4. **No shading, no light.** "5-9 quantized fills, flat, aliased, no light, no material."
   Fix: every body uses a consistent 3-tone model — a LIT face (upper/left), a SHADOW face
   (lower/right), and the base color — all from the same top-left key light. Add a 1px dark
   ink outline (already via finish/outline equivalent in GLSL: a second dark pass just
   outside the alpha). This single change ("turn the light on") is what separates "token"
   from "sprite with volume."

5. **Buildings are "logos," not places.** The hall is "a lime circle in a box with a flag."
   Fix: a building is a ROOF + WALLS + DOOR, drawn in perspective (taller roof plane above a
   lower wall plane, the door as a dark opening near the bottom). Windows are 1px lit slots.
   The civ motif (round/angular/tattered) shapes the ROOF and SILHOUETTE, not a banner.

## The hard rule: light from ONE direction, top-left

Every sprite — units AND buildings — must look like it's lit from the same top-left. Pick
two shades per material (lit = upper-left surfaces, shadow = lower-right surfaces) plus the
base. This is the biggest single lever. If nothing else changes, ADD THIS.

## Concretely redraw (in `src/sprite-sdf.ts`, GLSL SDF only, no textures)

Priority order — perfect these first, they're what the opening shot shows:
1. **fighter** — connected biped (head+neck+torso+pelvis+2 legs), rifle with stock+barrel+muzzle, lit/shadow.
2. **worker** — hunched biped, two arms gripping a large crate, hard-hat, lit/shadow.
3. **siege** — tread base (not "two U-holes") + raised cannon with muzzle, lit/shadow.
4. **scout** — low hull + big sensor dish + exhaust, lit/shadow.
5. **hall** — roof + walls + door + windows, lit/shadow.
Then the rest (ravager/prism/shade, house/barracks/unique) at the same standard.

## A unit must pass this test

Zoomed 4x, a naive player can: (a) name the ROLE by silhouette alone (weapon/tool), (b) see
it's LIT (not flat), (c) tell which way it FACES, (d) see feet that touch the torso and the
ground. If a foot floats, or a weapon is a gray line, the sprite is not done.

## Verify (do not skip)

- `npx tsc --noEmit` clean, `npm run build` succeeds.
- Screenshot the dev server ZOOMED IN (use the debug zoom or screenshot a crop) and eyeball
  each sprite against the 5 failures above. Fix what still looks like blocks.
- Commit `P90: v2 — connected lit anatomy + dominant weapon/tool + real buildings`.

Do not claim "distinct silhouettes" from code. Look at the actual pixels.
