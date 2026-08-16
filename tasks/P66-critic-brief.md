You are a **FRESH** Composer 2.5 critic for Spacepixel RTS **Wave 4 wrap** (60 fps / iPad / hardening). Piece id: **P66**.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/ARCHITECTURE.md` §8, `docs/DESIGN.md` §7.2 §9 #5 — landscape iPad, 60 fps while the fight is on, no marshal-quit bugs. Wave 1–3 already passed (opening, match arc, feel). Do not fail this wave for “third civ not on screen” (Wave 5) or for restaging Kryos Idle.

Live: https://spacepixelrts.pages.dev (`0.5.3-wave4`)

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p66-critic.png --fps-seconds 3 --wait 3`
2. Fail if version is older than `0.5.3-wave4`.
3. Opening still Helion rank vs Kryos wrecks + mid gem, sparks, no HP wallpaper. p99 < 22.
4. Viewport cull still holds: `node scripts/p60-probe.mjs --url https://spacepixelrts.pages.dev` — off-screen horde does not inflate `drawn`; on-screen horde does.
5. Attack-lock peel still holds: `node scripts/p62-probe.mjs --url https://spacepixelrts.pages.dev` — ground right-click is Move; hull click is Attack; clash still Attack without input.
6. HUD safe-area still holds: `node scripts/p64-probe.mjs --url https://spacepixelrts.pages.dev` — CSS has `safe-area-inset`; desktop `#bottom` ~168 px.
7. Screenshot: you'd keep commanding on a landscape iPad, not bounce off a tech demo.

Pass = Wave 4 is locked (name any leftover that belongs to Wave 5). Fail = one sentence biggest remaining Wave 4 gap (60 fps / iPad / bug).

Write `tasks/P66-critic.md`. Commit `P66: critic verdict on Wave 4 hardening`. No huge PNGs.
