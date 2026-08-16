You are the Composer 2.5 **builder** for Spacepixel RTS piece **P45**: win/lose banners + clickable command deck.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev
Read first: docs/DESIGN.md §8 §9, tasks/P44-critic.md, `src/sim.ts`, `src/hud.ts` (`renderCmds` innerHTML), `src/main.ts`.

Do **not** spawn agents. Do **not** restage the opening clash. Do not change epoch costs or pop from P43/P44.

## Gaps this piece owns

1. **Win/lose (DESIGN §8):** destroy enemy Nexus (all Halls of that team) → victory banner. Player Hall gone → defeat banner. Not a blank pause — sim may keep ticking; banner is the match end. v1 is 1v1 only.
2. **P44 critic marginal:** HUD `renderCmds` rebuilds `#cmds` every frame so Playwright (and iPad taps) miss Age Up. Skip `innerHTML` unless the button signature changed.

## Do this

1. `World` tracks `winner: -1 | 0 | 1` (`-1` = in play). After `thinkBuildings`/`kill`, if a team has no living `Kind.Hall` with `hp > 0` and `progress >= 1`, the other team wins. Once set, do not flip.
2. Publish `winner` on `window.__STARHOLD__`.
3. HUD overlay: large pixel panel, **VICTORY** / **DEFEAT**, one line (“Enemy Nexus shattered” / “Your Nexus is ash”). Does not cover the whole canvas as a black pause. No settings gear.
4. `renderCmds`: compute a signature string of cmds; only write `innerHTML` when it changes. Buttons must stay clickable across frames (Age Up, Train Worker).
5. **VERSION** `0.3.2-wave2`.

## Verify

Use vite on **port 5174** (never 5173).

```
npm run build
npx vite --host --port 5174 --strictPort
```

Playwright 1180×820:

1. Fresh: `winner === -1`. Click Age Up is **not** required if unaffordable; instead confirm Train Worker or Idle worker **DOM click** succeeds (element stays attached ≥ 1s).
2. Kill enemy Hall via `__STARHOLD_WORLD__` (`hp = 0` then `kill` or set hp 0 and step). `winner === 0`. Victory banner visible in screenshot `critic/out/p45-win.png`.
3. Fresh load, kill player Hall. `winner === 1`. Defeat banner. `critic/out/p45-lose.png`.
4. Opening mid-fight on a **fresh** load still Helion vs Kryos wrecks. `npm run critic -- --url http://localhost:5174` p99 < 22.

Deploy: `npx wrangler pages deploy dist --project-name=spacepixelrts`.

## Git

```
git add -A
git commit -m "P45: victory and defeat banners when a Nexus falls"
```

Do not commit `critic/out/*.png` or `notes.md`. Write `tasks/P45.md`. `--yolo` is on; just work.
