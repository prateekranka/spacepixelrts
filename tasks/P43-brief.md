You are the Composer 2.5 **builder** for Spacepixel RTS piece **P43**: unblock the empire loop (pop cap so you can train).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev
Read first: docs/DESIGN.md §3 §7 §9, docs/ARCHITECTURE.md, tasks/P42.md, then `src/sim.ts` (`spawnScenario`, `tryTrain`, `recountPop`), `src/hud.ts` (`renderCmds` train buttons), `src/content.ts` (`POP_HALL`, `POP_HOUSE`), `src/main.ts` (VERSION), `src/input.ts` (`closest` pick).

Do **not** spawn agents. Do **not** restage the opening clash (P41 Helion intact vs Kryos wreck rank is locked). Do not move mid-map houses, gem, or workers.

## The single gap (from P42 integrator, verbatim)

**No playable match arc — the skirmish is still a tableau with RTS verbs, not an empire you can grow.**

Immediate blocker this piece owns: **player starts 22/20 pop so `tryTrain` refuses**. Epochs / win-lose / AI pressure are later pieces (P44+). You only make **training possible from the opening skirmish**.

## Do this

1. **`recountPop`:** do not count `hp <= 0` or corpses toward `pop`. Opening Kryos wrecks must not occupy housing.
2. **Home-pad habitats only** (not in the mid-map critic crop around `MAP*0.5, MAP*0.52`): spawn **two extra** `Kind.House` at each team's **home pad** (player ~10.5,10.5 and enemy mirror). DESIGN: Nexus +10, Habitat +5. After this, player cap should be **≥ 30** with opening pop **< cap** (room to train at least a Worker and a Fighter). Mirror for team 1 so AI can also produce.
3. **HUD:** when `pop + cost > cap`, disable that train button and set `sub` to `pop cap`. Keep train verbs on Hall (Worker, Scout) and Yard (Fighter, Breaker, unique).
4. **Building pick:** `Input.closest` search radius 1.35 is tight at default zoom. Use **≥ 2.2** when the candidate is a building so a minimap-jump to the Nexus then tap actually selects it.
5. **VERSION** in `src/main.ts`: `0.3.0-wave2`.

Do not add AgeUp, win banners, or AI attack-move changes.

## Verify

```
npm run build
npx vite --host --port 5173 --strictPort
```

Then Playwright (Chrome channel, viewport 1180×820) against `http://localhost:5173`:

1. Wait 2s. Read `window.__STARHOLD__.teams[0]` — **pop < cap**, cap **≥ 30**.
2. Jump camera to the player Nexus (pan to ~10.5, 10.5 via minimap click or evaluate input.pan). Click the hall. Command deck must show Worker train (not disabled).
3. Click Train Worker. After ~8s, pop increased by 1 and ore dropped by Worker cost. `p99FrameMs` still < 22 on `npm run critic`.
4. Screenshot `critic/out/p43.png` of the **opening mid fight** (default camera, do not leave it on the base) — must still read Helion rank vs Kryos wrecks + mid gem. Do not commit huge PNGs.

Deploy: `npx wrangler pages deploy dist --project-name=spacepixelrts` after `npm run build`.

## Git

```
git add -A
git commit -m "P43: unblock training — pop under cap so the empire can grow"
```

Do not commit `critic/out/*.png` or `notes.md`. Write `tasks/P43.md` (what changed, probe pop/cap, how you verified train). `--yolo` is on; just work.
