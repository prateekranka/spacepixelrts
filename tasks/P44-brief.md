You are the Composer 2.5 **builder** for Spacepixel RTS piece **P44**: epochs / AgeUp (Spark → Orbit).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev
Read first: docs/DESIGN.md §4 §5.3, tasks/P43-critic.md, `src/engine.ts` (TeamEco, Ord), `src/sim.ts` (tryTrain, thinkBuildings, spawnScenario), `src/hud.ts` (Hall command deck), `src/content.ts`, `src/main.ts` (VERSION, probe).

Do **not** spawn agents. Do **not** restage the opening clash (P41 look is locked). Do not change pop/housing from P43. Do not add Apex/Dominion UI beyond storing the epoch int (Orbit is the only age-up you must ship).

## The gap

P43 let you train a Worker. AoE2 command feel still missing **ages**. DESIGN §4: Spark start; Orbit costs **400 Ore, 80 Charge, 40s**; Nexus cannot train while aging. Orbit unlocks Yard production: Fighter, Spore Rider / unique-at-Orbit, Bloom Nest. Siege / civ unique unit+building stay Dominion (do not unlock them at Orbit).

Opening tableau already has a Yard and Fighters — that is cinematic. **New** Fighter/Siege/unique trains from the Yard must respect epoch gates.

## Do this

1. **`TeamEco.epoch`** `0 Spark | 1 Orbit | 2 Dominion | 3 Apex`. Both teams start **0**. Put `epoch` on `window.__STARHOLD__.teams[]` (already published via `world.teams`).
2. **`World.tryAgeUp(team)`:** if epoch is Spark, ore≥400, energy≥80, not already aging, not training a unit: spend, set `ageT = 40`. While `ageT > 0`, `tryTrain` on that team's Hall returns false. On complete: `epoch = 1` (Orbit).
3. **HUD Hall:** Age Up button (`Spark → Orbit`, sub `400 ore · 80 chg`). Disable if unaffordable or already aging/Orbit+. Show remaining seconds while aging. Worker/Scout train disabled while aging (same as DESIGN).
4. **Yard trains:** Fighter (and Spore Rider if Nihiline) require `epoch >= 1`. Siege, Solar Lance, Glacier Titan require `epoch >= 2`. Disabled buttons sub `Orbit` or `Dominion`.
5. **VERSION** `0.3.1-wave2`.

Keep opening tableau units already on the field. Do not strip the cinematic Yard.

## Verify

```
npm run build
```

Playwright against `npx vite --host --port 5174 --strictPort` (do **not** steal 5173 — another project uses it):

1. Fresh load: `teams[0].epoch === 0`, pop 22/30.
2. Select Hall, click Age Up. Ore 220 is **not enough** — button disabled until you cheat-or-grant ore in the test via `__STARHOLD_WORLD__.teams[0].ore = 500` (allowed in the harness only). Then Age Up spends 400 ore + 80 charge, `ageT` running, Worker train disabled.
3. Fast-forward: set `ageT = 0.05` and wait one tick, **or** wait 40s. `epoch === 1`. Yard Fighter train becomes enabled.
4. `npm run critic -- --url http://localhost:5174` p99 < 22. Opening mid-fight screenshot still Helion vs Kryos wrecks.

Deploy: `npx wrangler pages deploy dist --project-name=spacepixelrts`.

## Git

```
git add -A
git commit -m "P44: Spark to Orbit age-up so the empire can advance"
```

Do not commit `critic/out/*.png` or `notes.md`. Write `tasks/P44.md`. `--yolo` is on; just work.
