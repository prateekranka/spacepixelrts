You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P64** (iPad HUD safe-area). Piece id for your report/commit: **P65**.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/DESIGN.md` §7.2 — landscape iPad home indicator / notch must not cover command tiles or resource numerals. Desktop critic layout must stay the opening tableau.

Live: https://spacepixelrts.pages.dev (`0.5.3-wave4`)

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p65-critic.png --fps-seconds 3 --wait 3`
2. Fail if version is older than `0.5.3-wave4`.
3. Opening still Helion rank vs Kryos wrecks. p99 < 22. Desktop `#bottom` height still ~168 px (insets 0).
4. HUD CSS (via `getComputedStyle` / stylesheet text) must include `safe-area-inset`. You may run `node scripts/p64-probe.mjs --url https://spacepixelrts.pages.dev`.
5. If you mock `env(safe-area-inset-bottom)` (34 px), command verb `getBoundingClientRect().bottom` must sit above `innerHeight - inset`.

Pass = insets exist, desktop opening unchanged. Fail = one sentence biggest gap.

Write `tasks/P65-critic.md`. Commit `P65: critic verdict on HUD safe-area`. No huge PNGs.
