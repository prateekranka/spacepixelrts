You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P44** (Spark → Orbit age-up).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/DESIGN.md` §4 and §9 — this piece is **can you age up**, not the opening tableau (already passed).

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p44-critic.png --fps-seconds 3 --wait 3`
2. Fail if version is still `0.3.0-wave2` or missing `teams[0].epoch`.
3. Playwright 1180×820 on live (or local 5174 if live stale):
   - Fresh: `epoch === 0`. Hall Age Up exists. Fighter train on Yard disabled (or sub `Orbit`).
   - Grant ore/charge via `__STARHOLD_WORLD__.teams[0]` if needed, click Age Up, confirm spend and that Hall cannot train a Worker while aging.
   - Complete age (fast-forward `ageT` or wait). `epoch === 1`. Yard Fighter train enabled.
4. Fresh-load opening screenshot still Helion rank vs Kryos wrecks + mid gem.

Pass = Spark→Orbit works on the running game and P41 tableau is intact. Fail = **one sentence** biggest gap.

Write `tasks/P44-critic.md`. Commit `P44: critic verdict on Spark to Orbit`. No huge PNGs.
