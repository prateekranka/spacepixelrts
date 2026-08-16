You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P49** (mixed-arms inbound wave).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/DESIGN.md` §6 — inbound pressure is a **mixed-arms army**, not a scout blob.

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p49-critic.png --fps-seconds 3 --wait 3`
2. Fail if version is still `0.3.4-wave2`.
3. Playwright live: early tick P41 + 0 peel. Tick ≥ 420: ≥4 Fighters and ≥1 Siege committed on the player Nexus; total ≥6 military.
4. Opening still Helion vs Kryos wrecks + mid gem.

Pass = mixed arms inbound. Fail = one sentence biggest gap.

Write `tasks/P49-critic.md`. Commit `P49: critic verdict on mixed-arms wave`. No huge PNGs.
