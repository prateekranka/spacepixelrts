# P99 builder round 2 — make Build unmistakable mallet labor

Work in `/Users/prateekranka/Cowork/spacepixelrts`. You are the single implementation builder for this round. Do not spawn other agents.

## Single biggest remaining gap

The fresh blind critic failed only this: **“Build does not read as hammer/mallet labor; the worker holds or tends a crate-like block instead of swinging a tool.”**

Fix that one visual gap. Preserve the accepted idle, walk, food, crystal, and attack states and the existing action wiring.

## Read before editing

- `tasks/P99-spec.md`
- `references/helion-worker-option5.png`, especially the BUILD inset
- `src/art-reference.ts`
- `src/sprites.ts`, especially `drawHelionVariant`, action 0, `drawWorker8Dir`, and `buildSpriteAtlas`
- `src/sprite-sdf.ts`
- `src/render.ts`, especially `frameFor` and worker scale
- `src/engine.ts`, especially `Tile`, `Ord`, `Ent`, and `dir8`
- `scripts/p99-worker-shots.mjs`
- `critic/out/p99-helion-build.png`

## Required correction

- Redraw only the Helion Build action so every important shown direction reads instantly as active hammer/mallet construction.
- Give the tool a dominant, continuous silhouette: a clearly visible long brown handle connected through the worker’s gripped hand(s) to a compact contrasting metal mallet head.
- Pose the worker as swinging or striking diagonally/downward, not merely standing beside a dark block.
- Any construction target must read as a low glowing hex foundation/tile under the strike, not a carried crate. Keep it shallow and secondary to the person and mallet. A few bright impact pixels/sparks are appropriate if they improve the labor read.
- Keep the body, beard, hard-hat/lamp, shirt, belt, trousers, bracers, and boots recognizably the same person.
- Verify S, E, and SE/front-biased live examples; the mallet and action must not disappear behind the body.
- Keep `Ord.Build → WORKER_ACTION_BUILD` and the existing extra-row atlas mapping.
- Update `scripts/p99-worker-shots.mjs` only if needed to stage a clearer build proof. It may arrange the shown facings or include a low construction target supplied by the sprite, but must still capture actual runtime rendering through `__STARHOLD_WORLD__`.
- Regenerate all P99 screenshots so later critique uses fresh evidence.
- Bump `VERSION` in `src/main.ts` from `0.9.9-iso` to `0.9.10-iso`.

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
- Preserve existing user and round-1 changes. Do not reset, checkout, revert, or overwrite unrelated edits.
- Never use `git add -A`. Never stage or commit `notes.md`.
- Commit only `src/**`, `scripts/p98-worker-shots.mjs` (or a new `scripts/p99-worker-shots.mjs`), and `tasks/P99.md`. Message: `P99: …`.
- For this builder round, do not create a commit; the orchestrator commits only after a fresh critic PASS.

## Verification and handoff

Run `npx tsc --noEmit` and `node scripts/p99-worker-shots.mjs` against the existing server. Fix in-scope failures. At the end report:

1. Files changed.
2. Exactly how the Build silhouette was made legible.
3. Confirmation that atlas/frame mapping stayed intact.
4. Verification commands and outcomes.
5. Any remaining visual risk.
