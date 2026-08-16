You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P51** (muzzle + impact VFX).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/DESIGN.md` §5.4 #5–7 — you can read the mid fight from **muzzle and impact**, not HP chrome.

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p51-critic.png --fps-seconds 3 --wait 3`
2. Fail if version is still `0.3.5-wave2`.
3. Look at the opening screenshot: exchange-belt sparks (muzzle and/or impact) must be visible. Tableau still Helion vs Kryos wrecks + mid gem.
4. p99 < 22.

Pass = clash reads from VFX. Fail = one sentence biggest gap.

Write `tasks/P51-critic.md`. Commit `P51: critic verdict on muzzle and impact`. No huge PNGs.
