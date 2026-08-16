You are a **FRESH** Composer 2.5 critic for Spacepixel RTS **Wave 5 wrap** (full 1v1 coherence vs AoE2:DE). Piece id: **P70**.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/DESIGN.md` §9 — all six wow points on the **running game**. Waves 1–4 already passed. P68/P69 shipped Nihiline via picker / `?civ=voidmarked`. Default boot must stay Helion vs Kryos (P41).

Live: https://spacepixelrts.pages.dev (`0.6.0-wave5`)

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p70-default.png --fps-seconds 3 --wait 3`
2. Fail if version is older than `0.6.0-wave5`.
3. Default opening still wows (Helion vs Kryos wrecks, sparks, peel, HUD). p99 < 22.
4. `?civ=voidmarked`: third people on canvas (Shade + tendril silhouettes). Screenshot `critic/out/p70-voidmarked.png`.
5. Match arc still there at tick ≥420 (mixed-arms inbound or win path exists) — you may step sim via `__STARHOLD_WORLD__`.
6. §9 #1–#6: winning the mid fight, commanding, three peoples, a place, 60 fps, **would you keep playing a full 1v1**.

Pass = Wave 5 locked (name leftovers that are not Wave 5). Fail = one sentence biggest remaining coherence gap.

Write `tasks/P70-critic.md`. Commit `P70: critic verdict on Wave 5 coherence`. No huge PNGs.
