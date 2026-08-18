# P99 builder round 3 — make Build a dynamic strike, not a held tool beside a block

Work in `/Users/prateekranka/Cowork/spacepixelrts`. You are the single implementation builder for this round. Do not spawn other agents.

## Single biggest remaining gap

The fresh blind critic failed only this: **“Build reads as a mallet held upright beside a crate-like block, not as active hammering at a shallow construction footing.”**

Fix that one visual gap. Preserve the accepted idle, walk, food, crystal, and attack states and the existing action wiring.

## Read before editing

- `tasks/P99-spec.md`
- `tasks/P99-critic-r2.md`
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

- Redraw only the Helion Build action so S, E, and SE read as an active swing/impact moment, never a worker simply holding a tool upright.
- Make the strike pose unmistakably dynamic: arms extended away from the resting torso, two hands separated along a long brown handle, and the handle crossing the figure on a strong diagonal from a high/shoulder-side grip down to the impact point.
- Keep a compact contrasting metal mallet head visibly perpendicular to the handle. It must read as a tool head, not a second crate or a large horizontal block.
- Remove the crate-like construction mass. The target may be only a very shallow lime hex/diamond rim or tile at ground level (roughly 1–3 authored pixels high), with transparent space around it. Do not place a filled gray rectangular block beside the worker.
- Separate person, shaft, head, and target in the silhouette. The mallet head should meet the ground-level target at one clear impact point; use a short motion arc and a few bright impact pixels if they make the action read immediately.
- Keep the body, beard, hard-hat/lamp, shirt, belt, trousers, bracers, and boots recognizably the same person.
- Verify the actual live Build proof plus the 6× S, E, and SE Build cells. At runtime zoom the body should look like it is striking, not presenting or carrying an object.
- Keep `Ord.Build → WORKER_ACTION_BUILD` and the existing extra-row atlas mapping.
- Preserve the round-2 Build-cell dumps and separated live facings in `scripts/p99-worker-shots.mjs`; adjust staging only if necessary for a clearer actual-runtime proof through `__STARHOLD_WORLD__`.
- Regenerate all P99 screenshots so later critique uses fresh evidence.
- Bump `VERSION` in `src/main.ts` from `0.9.10-iso` to `0.9.11-iso`.

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
- Preserve existing user, round-1, and round-2 changes. Do not reset, checkout, revert, or overwrite unrelated edits.
- Never use `git add -A`. Never stage or commit `notes.md`.
- This builder round: do not commit; the orchestrator commits only after a fresh critic PASS.

## Verification and handoff

Run `npx tsc --noEmit` and `node scripts/p99-worker-shots.mjs` against the existing server. Fix in-scope failures. At the end report:

1. Files changed.
2. Exactly how the Build silhouette became a dynamic strike rather than a held tool beside a block.
3. Confirmation that atlas/frame mapping stayed intact.
4. Verification commands and outcomes.
5. Any remaining visual risk.
