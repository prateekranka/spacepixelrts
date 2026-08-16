You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P53** (foot ellipses + combat-only HP bars).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/DESIGN.md` §5.4 #3–4.

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p53-critic.png --fps-seconds 3 --wait 3`
2. Fail if version is still `0.4.1-wave3`.
3. Opening with nothing selected: **no HP bar wallpaper**. Tableau still Helion vs Kryos wrecks + mid gem.
4. Select a unit: foot ellipse (not a box through the sprite) and HP if damaged/selected.
5. p99 < 22.

Pass = chrome is earned. Fail = one sentence biggest gap.

Write `tasks/P53-critic.md`. Commit `P53: critic verdict on ellipses and HP bars`. No huge PNGs.
