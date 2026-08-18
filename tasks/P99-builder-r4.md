# P99 builder round 4 — make Build unmistakably active hammering

Work in `/Users/prateekranka/Cowork/spacepixelrts`. You are the single implementation builder for this round. Do not spawn other agents.

## Single biggest remaining gap

The fresh blind critic failed only this: **“Build still reads as a lowered pick/gadget at rest, not active hammer/mallet labor at a shallow construction footing.”**

Fix that one visual gap. Preserve the accepted idle, walk, food, crystal, and attack states and the existing action wiring.

## Read before editing

- `tasks/P99-spec.md`
- `tasks/P99-critic-r3.md`
- `references/helion-worker-option5.png`, especially the BUILD inset
- `src/art-reference.ts`
- `src/sprites.ts`, especially `drawHelionVariant`, action 0, `drawWorker8Dir`, and `buildSpriteAtlas`
- `src/sprite-sdf.ts`
- `src/render.ts`, especially `frameFor` and worker scale
- `src/engine.ts`, especially `Tile`, `Ord`, `Ent`, and `dir8`
- `scripts/p99-worker-shots.mjs`
- `critic/out/p99-cell-helion-build-E.png`
- `critic/out/p99-cell-helion-build-S.png`
- `critic/out/p99-cell-helion-build-SE.png`
- `critic/out/p99-helion-build.png`

## Required correction

- Redraw only the Helion Build action so S, E, and SE read instantly as a body caught in an active hammer blow, not the normal standing body with a lowered gadget attached.
- Change the whole Build pose, not just the tool pixels: make the worker lean or brace into the strike and make both arms visibly project away from the torso. Keep two hands clearly separated on one long brown shaft; neither hand may disappear into the chest silhouette.
- Stage a forceful mid-swing/contact silhouette. Use a strong, open diagonal with visible negative space between arms, torso, and shaft. The tool must not hang vertically at the worker’s side or terminate in a pick-like hook.
- Give the mallet an unmistakable compact **T-shaped/transverse metal head**, visibly centered on and perpendicular to the shaft. Make the two blunt striking faces readable at live RTS scale; avoid a curved, hooked, crescent, pick, wrench, or gadget silhouette.
- The mallet should visibly meet one shallow ground-level lime footing at a single contact point. Keep the footing a thin 1–3 authored-pixel rim/tile with transparent space around it—no crate, filled block, or tall construction mass.
- Use a bold motion arc, displaced body/limbs, and a compact impact burst where useful. Sparks alone do not establish motion: the arms, shaft, and body silhouette must carry the swing.
- Keep the face, beard, hard-hat/lamp, shirt, belt, trousers, bracers, and boots recognizably the same worker.
- Verify the actual live Build proof plus the 6× S, E, and SE Build cells. At runtime zoom a naive viewer should say “hammering/building,” never “holding a lowered pick/gadget.”
- Keep `Ord.Build → WORKER_ACTION_BUILD` and the existing extra-row atlas mapping.
- Preserve the Build-cell dumps and separated live facings in `scripts/p99-worker-shots.mjs`; adjust staging only if necessary for a clearer actual-runtime proof through `__STARHOLD_WORLD__`.
- Regenerate all P99 screenshots so later critique uses fresh evidence.
- Bump `VERSION` in `src/main.ts` from `0.9.11-iso` to `0.9.12-iso`.

## Locked implementation and art constraints

- Procedural `Pix` in `src/sprites.ts`. Silhouette-first, top-left 3-tone light, connected anatomy (`src/art-reference.ts` technique).
- Idle/walk: empty hands. Hat = construction hard-hat + MAG lamp, not a visor.
- Atlas 512px wide = 16 cols. Pack actions as **extra Helion rows**, not extra columns.
- Preserve worker corpse/dissolve frames 4–6 on legacy 32px slots.
- Preserve the locked living worker scale: `scaleX=1.55`, `scaleY=2.32`.
- Helion only. Leave Kryos and Nihiline worker drawing as-is.
- MAG `#FF00FF` remains only the hat lamp.

## Scope and safety

- Vite is already running on `http://127.0.0.1:5173`. Do not start another server and do not kill/restart the existing one.
- Never use Flowdeck.
- Do not change gameplay/combat formulas, camera, buildings, other roles, other civs, or unrelated states.
- Preserve existing user and prior-round changes. Do not reset, checkout, revert, or overwrite unrelated edits.
- Never use `git add -A`. Never stage or commit `notes.md`.
- This builder round: do not commit; the orchestrator commits only after a fresh critic PASS.

## Verification and handoff

Run `npx tsc --noEmit` and `node scripts/p99-worker-shots.mjs` against the existing server. Fix in-scope failures. At the end report:

1. Files changed.
2. Exactly how the Build body/tool silhouette became active hammering rather than a lowered pick/gadget.
3. Confirmation that atlas/frame mapping stayed intact.
4. Verification commands and outcomes.
5. Any remaining visual risk.
