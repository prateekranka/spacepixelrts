You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P46** (enemy marshal threatens the Nexus).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/DESIGN.md` §6 §9 — after the opening shot, the enemy must threaten your Nexus so macro has stakes.

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p46-critic.png --fps-seconds 3 --wait 3`
2. Fail if version is still `0.3.2-wave2`.
3. Playwright on live:
   - Fresh early tick: opening Helion rank vs Kryos wrecks still reads (no peel yet).
   - Advance to tick ≥ 280. At least 3 living enemy military should be committed toward the player Nexus (AttackMove / Attack tid = player Hall, or clearly marching SW toward ~10,10).
4. Fresh-load opening still P41-like.

Pass = you feel threatened while booming. Fail = one sentence biggest gap.

Write `tasks/P46-critic.md`. Commit `P46: critic verdict on enemy Nexus pressure`. No huge PNGs.
