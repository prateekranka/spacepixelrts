You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P45** (win/lose banners + clickable HUD).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/DESIGN.md` §8 §9 — this piece is **match end is readable**, not the opening tableau.

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p45-critic.png --fps-seconds 3 --wait 3`
2. Fail if version is still `0.3.1-wave2` or `winner` missing on the probe.
3. Playwright 1180×820 on live:
   - Fresh: `winner === -1`. Click a HUD button (Idle worker or Train after selecting Hall) — the element must remain in DOM (no detach-every-frame).
   - Kill enemy Hall through `__STARHOLD_WORLD__`, step until `winner === 0`. Screenshot must show a **VICTORY** banner, not a blank pause.
   - Fresh load, kill player Hall, `winner === 1`, **DEFEAT** banner.
4. Fresh-load opening still Helion rank vs Kryos wrecks + mid gem.

Pass = banners exist and command buttons stay clickable. Fail = one sentence biggest gap.

Write `tasks/P45-critic.md`. Commit `P45: critic verdict on win/lose`. No huge PNGs.
