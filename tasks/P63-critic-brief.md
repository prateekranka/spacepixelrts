You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P62** (opening right-click Move vs Attack-lock). Piece id for your report/commit: **P63**.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/DESIGN.md` §7.3 — right-click empty ground = Move; right-click enemy sprite = Attack. Opening tableau must still hold Attack on its own.

Live: https://spacepixelrts.pages.dev (`0.5.2-wave4`)

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p63-critic.png --fps-seconds 3 --wait 3`
2. Fail if version is older than `0.5.2-wave4`.
3. Opening still Helion rank vs Kryos wrecks + mid gem. p99 < 22. Clash fighters still on Attack without player input (tick < 240).
4. Playwright, **tick < 240**:
   - Select a team-0 Fighter. Dispatch a right-click (`button: 2`) on empty ground **not on an enemy sprite** (dust behind the player rank is fine). After the event, that fighter's `order` is **Move** (not Attack).
   - Right-click **on** a living Kryos hull (project sprite, click those CSS coords): still Attack.
5. You may run `node scripts/p62-probe.mjs --url https://spacepixelrts.pages.dev` as a helper; still look at the screenshot yourself.

Pass = marshal can peel with a ground right-click and can still attack a hull. Fail = one sentence biggest gap.

Write `tasks/P63-critic.md`. Commit `P63: critic verdict on Attack-lock peel`. No huge PNGs.
