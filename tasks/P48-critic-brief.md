You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P48** (enemy fighter wave).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/DESIGN.md` §6 — inbound pressure must feel like an **army**, not a scout timer.

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p48-critic.png --fps-seconds 3 --wait 3`
2. Fail if version is still `0.3.3-wave2`.
3. Playwright live:
   - Fresh early tick: P41 tableau, no peel.
   - Tick ≥ 400: ≥ 6 living enemy military committed on the player Nexus, of which ≥ 4 are Fighters.
4. Opening still Helion vs Kryos wrecks + mid gem.

Pass = army inbound. Fail = one sentence biggest gap.

Write `tasks/P48-critic.md`. Commit `P48: critic verdict on enemy fighter wave`. No huge PNGs.
