You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P60** (viewport culling). Piece id for your report/commit: **P61**.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/ARCHITECTURE.md` §8 — off-screen units must not inflate instance uploads; opening tableau must still draw.

Live: https://spacepixelrts.pages.dev (`0.5.1-wave4`)

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p61-critic.png --fps-seconds 3 --wait 3`
2. Fail if probe version is older than `0.5.1-wave4`.
3. Opening still Helion rank vs Kryos wrecks + mid gem, sparks, no HP wallpaper. p99 < 22. `__STARHOLD__.rendererInfo.drawn` is a number > 20 (not 0 — cull must not empty the clash).
4. Run `node scripts/p60-probe.mjs --url https://spacepixelrts.pages.dev` (or equivalent Playwright):
   - Spawn ≥180 Fighters at far corner `(4,4)` with camera on opening look-at: **`drawn` stays within ~30 of opening `drawn`**.
   - Spawn ≥180 Fighters at look-at: **`drawn` rises by ≥80**.
5. Screenshot: opening clash still readable (not missing edge sprites that belong in frame).

Pass = cull works and opening still wows. Fail = one sentence biggest gap.

Write `tasks/P61-critic.md`. Commit `P61: critic verdict on viewport culling`. No huge PNGs.
