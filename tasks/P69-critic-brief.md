You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P68** (civ picker / Nihiline on canvas). Piece id: **P69**.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/DESIGN.md` §2 §9 #3 — three civs are different peoples, not recolors. Default boot must still be the locked Helion vs Kryos opening.

Live: https://spacepixelrts.pages.dev (`0.6.0-wave5`)

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p69-default.png --fps-seconds 3 --wait 3`
2. Fail if version is older than `0.6.0-wave5`.
3. **Bare URL:** `civ` is vespari vs aurion. Opening still Helion rank vs Kryos wrecks + mid gem. p99 < 22.
4. **`https://spacepixelrts.pages.dev?civ=voidmarked`:** probe `civ` includes `voidmarked`; at least one living `Kind.Shade` (check `engine.ts` for the id). Screenshot the Nihiline opening (`critic/out/p69-voidmarked.png`). Silhouettes must read as a third people (tendril/spore), not a Helion recolor.
5. HUD has three civ tiles (Helion / Kryos / Nihiline) — not a blocking splash that hides the clash.

Pass = default P41 intact AND Nihiline is visibly a different people. Fail = one sentence biggest gap.

Write `tasks/P69-critic.md`. Commit `P69: critic verdict on Nihiline civ picker`. No huge PNGs.
