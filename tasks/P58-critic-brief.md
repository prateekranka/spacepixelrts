You are a **FRESH** Composer 2.5 critic for Spacepixel RTS **Wave 3 feel** (piece **P58**).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev (`0.4.5-wave3`)
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/DESIGN.md` §5.4 §7 §9 — feel/polish vs Age of Empires II: DE. Wave 2 match-arc already passed. This is **command feel + battle VFX + empire HUD**.

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p58-critic.png --fps-seconds 3 --wait 3`
2. Fail if version is older than `0.4.5-wave3`.
3. Opening: tableau + sparks, no HP wallpaper, p99 < 22, `hitSfx` climbing.
4. Command: idle-worker can pulse; formation exists in sim (you may issue Move post-tick 300).
5. §9 #2 and #6: would you keep playing *as commanding*, not only as a tableau?

Pass = genuinely wowed for Wave 3 feel. Fail = **one sentence** biggest remaining gap.

Write `tasks/P58-critic.md`. Commit `P58: critic verdict on Wave 3 feel`. No huge PNGs.
