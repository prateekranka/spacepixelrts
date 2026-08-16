You are the Composer 2.5 **builder** for Spacepixel RTS piece **P48**: enemy army (not a scout timer).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev
Read first: docs/DESIGN.md §6, tasks/P47-critic.md, `src/sim.ts` `stepAi` / `stepMarshalPeel`, epoch gates in `tryTrain`.

Do **not** spawn agents. Do **not** restage ticks 0–239 (P41 opening is locked). Do not change win/lose banners or player pop/housing.

## The gap (verbatim from P47)

**Enemy military never becomes a real army.** DESIGN §6: attack-move the player Nexus when **6+ military** exist. At tick 280 only **three Scouts** are committed — no fighter blob, no composition. Would not queue a second skirmish vs AoE2:DE until inbound pressure feels like an army.

Why scouts: enemy is Spark, so Yard Fighters are epoch-gated. Fix the marshal, not the opening wrecks.

## Do this

1. **Tick 240:** scripted enemy marshal **ages to Orbit** (`teams[1].epoch = 1`, `ageT = 0`) — off-screen, no banner. Player still ages via HUD.
2. **Then** `stepAi` trains **Fighters** from the existing Yard (resources: grant team 1 ore/energy if needed so they can actually queue — e.g. keep ≥ 80 ore / 20 charge on the AI after opening). Do not dump 400 ore on the player.
3. AttackMove **Fighters** (and remaining Scouts) at the player Nexus. By tick **400** (~20s), at least **6** living team-1 military should be committed (`AttackMove`/`Attack` tid = player Hall), including **≥ 4 Fighters**. Stagger 0.15s so they march as a group.
4. Opening 0–239 unchanged. Scout early ping from P46 may remain; the army is the new bar.
5. **VERSION** `0.3.4-wave2`.

## Verify

Vite **5174** only.

```
npm run build
npx vite --host --port 5174 --strictPort
```

Playwright: early tick still P41 tableau, **0** enemy peel. Tick ≥ 400: ≥ 6 enemy military committed on player Hall, ≥ 4 of them Fighters. `npm run critic` p99 < 22. Deploy wrangler pages `spacepixelrts`.

## Git

```
git add -A
git commit -m "P48: enemy marshal sends a fighter wave after the opening"
```

No `critic/out/*.png`, no `notes.md`. Write `tasks/P48.md`. `--yolo` is on; just work.
