# P99 builder round 1 — Helion option-5 body and action wiring

Work in `/Users/prateekranka/Cowork/spacepixelrts`. You are the single implementation builder for this round. Do not spawn other agents.

## Single biggest remaining gap

The current Helion worker is a crate carrier in every idle/walk direction and has no action-state atlas/render wiring. Replace it with the complete locked option-5 Habitat Builder body and wire all required villager actions.

## Read before editing

- `tasks/P99-spec.md`
- `references/helion-worker-option5.png`
- `src/art-reference.ts`
- `src/sprites.ts`, especially `drawHelionWorker`, `drawWorker8Dir`, and `buildSpriteAtlas`
- `src/sprite-sdf.ts`
- `src/render.ts`, especially `frameFor` and living-worker scale
- `src/engine.ts`, especially `Tile`, `Ord`, `Ent`, and `dir8`
- `scripts/p98-worker-shots.mjs`

## Required implementation

Implement the Helion Compact worker as option 5 from the reference:

- One stocky, bearded human laborer with a construction hard-hat and a single MAG (`#FF00FF`) lamp.
- Tan/khaki rolled-sleeve work shirt, charcoal trousers, brown pouch belt, lime hex bracers, and mag-boots.
- Idle and walk have empty, visibly open hands. Do not draw a permanent crate, weapon, visor, backpack, or combat silhouette.
- Preserve the existing authored direction convention: 0=E, 1=NE, 2=N, 6=S, 7=SE; mirror 3 from 1, 4 from 0, and 5 from 7.
- Preserve Kryos and Nihiline worker drawing exactly. Helion only.
- Add distinct Helion action art for:
  - Build (`Ord.Build`): same person using a mallet/hammer.
  - Gather/return food (`Ord.Gather` or `Ord.Return` with food/solar-style cargo): same person carrying a produce crate/basket.
  - Gather/return crystal/ore: same person carrying bright crystals or a hex star-ore crate.
  - Attack (`Ord.Attack` as a living worker): same person with the mallet raised as a weapon.
- Wire `GameRenderer.frameFor` using `Ord` and `cargoType`. Keep living idle/walk behavior and keep worker corpse/dissolve frames 4–6 on the legacy 32px unit slots.
- Keep atlas width 512px/16 columns. Existing idle+walk occupy the 16 columns of each normal worker row. Pack each new Helion action as an extra 48px-high row, with directional cells across that row; do not add columns.
- Update atlas metadata and `src/sprite-sdf.ts` sampling so living Helion actions sample those extra rows while Kryos/Nihiline idle/walk and all corpse sampling remain correct.
- Keep the live worker scale at the locked `scaleX=1.55`, `scaleY=2.32`.
- Add or adapt `scripts/p99-worker-shots.mjs` (preferred over changing P98) to use the existing Vite server at `http://127.0.0.1:5173`, force camp workers through `window.__STARHOLD_WORLD__`, and write:
  - `critic/out/p99-cell-helion-S.png`
  - `critic/out/p99-cell-helion-E.png`
  - `critic/out/p99-cell-helion-N.png`
  - `critic/out/p99-helion-close.png`
  - `critic/out/p99-helion-walk.png`
  - `critic/out/p99-helion-build.png`
  - `critic/out/p99-helion-food.png`
  - `critic/out/p99-helion-crystal.png`
  - `critic/out/p99-helion-attack.png`
  Cell dumps must be nearest-neighbor 6× crops from the actual runtime atlas. Live shots must isolate/readably stage the same Helion workers at close RTS zoom. Set `order`, `cargo`, `cargoType`, velocity/facing, and positions as needed; freeze or restage repeatedly so simulation does not immediately overwrite the intended frame before capture.
- Bump `VERSION` in `src/main.ts` from `0.9.8-iso` to `0.9.9-iso`.

## Art constraints

- Procedural `Pix` in `src/sprites.ts`.
- Silhouette-first, top-left 3-tone light, connected anatomy, following `src/art-reference.ts`.
- The same person's body, hat, beard, shirt, belt, trousers, and boots must remain recognizable in every state.
- Prioritize readable silhouette at live RTS zoom; avoid tiny decorative noise that disappears when rendered.
- MAG is only the hat lamp and is team-replaced by the shader.

## Scope and safety

- Vite is already running on `http://127.0.0.1:5173`. Do not start another server and do not kill/restart the existing one.
- Never use Flowdeck.
- Do not change gameplay/combat formulas, camera, buildings, other roles, or other civ worker art.
- Preserve existing user changes. Do not reset, checkout, revert, or overwrite unrelated edits.
- Never use `git add -A`. Never stage or commit `notes.md`.
- Commit only `src/**`, `scripts/p98-worker-shots.mjs` (or a new `scripts/p99-worker-shots.mjs`), and `tasks/P99.md`. Message: `P99: …`.
- For this builder round, do not create a commit; the orchestrator commits only after a fresh critic PASS.

## Verification and handoff

Run `npx tsc --noEmit` and run the P99 screenshot script against the already-running server. Fix any failures in scope. At the end, report:

1. Files changed.
2. Atlas row/frame mapping selected.
3. `frameFor` order/cargo mapping.
4. Verification commands and outcomes.
5. Any remaining visual risk.
