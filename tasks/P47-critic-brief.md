You are a **FRESH** Composer 2.5 critic for Spacepixel RTS **Wave 2 match arc** (piece **P47**).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/DESIGN.md` §4 §6 §8 §9 — **would you keep playing this as an RTS vs Age of Empires II: DE**, not only the opening screenshot.

## Inspect the running game

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p47-critic.png --fps-seconds 3 --wait 3`
2. Playwright 1180×820 on live, using `__STARHOLD__` / `__STARHOLD_WORLD__` as needed:

   **Opening (fresh load, early tick):** Helion intact rank vs Kryos wrecks, mid gem, workers, HUD, p99 < 22. Version must be `0.3.3-wave2` or newer.

   **Grow:** pop < cap; Hall can train Worker; Age Up exists (Spark→Orbit). You may grant ore/charge in the harness to complete age-up.

   **Threat:** by tick ≥ 280, enemy military committed toward the player Nexus.

   **End:** killing enemy Hall shows VICTORY; killing player Hall (fresh load) shows DEFEAT.

3. DESIGN §9: especially **#2 command feel**, **#6 would keep playing**. Name **one** biggest remaining gap if you would not keep this vs AoE2:DE as a skirmish.

Pass = genuinely wowed for Wave 2 *gameplay depth* (empire loop exists under threat, match can end). Opening tableau regression is an automatic fail.

Write `tasks/P47-critic.md`. Commit `P47: critic verdict on Wave 2 match arc`. No huge PNGs. `--yolo` is on; just work.
