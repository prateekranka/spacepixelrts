You are the Composer 2.5 **builder** for Spacepixel RTS piece **P49**: mixed-arms inbound wave (fighters + siege, not a scout blob).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev
Read first: tasks/P48-critic.md, docs/DESIGN.md §5–§6, `src/sim.ts` marshal/peel/train.

Do **not** spawn agents. Do **not** restage ticks 0–239. Do not change player HUD/epochs/win banners.

## The gap (from P48 critic)

**Inbound blob is still scout-heavy.** Five of nine committed units are Scouts; only four Fighters; no siege. Not the mixed-arms stack that makes AoE2:DE defense interesting.

## Do this

1. After tick 240, **stop training Scouts** for team 1. Existing scouts may still peel.
2. Tick 240: enemy marshal **Dominion** (`epoch = 2`) off-screen so Siege is legal. Resource floor enough for 2 Siege + several Fighters.
3. Queue **Fighters** and **Siege** (Kind.Siege / Breaker) from Yard. Target composition on the player Nexus by tick **420**: **≥ 4 Fighters** and **≥ 1 Siege** committed (`AttackMove` tid = player Hall). Total military committed **≥ 6**.
4. Siege is slow — spawn them with a head start (rally closer, or spawn at ~tick 250 near the enemy forward pad, still not in the opening crop). Do not teleport onto the player Hall.
5. **VERSION** `0.3.5-wave2`.

## Verify

Vite **5174**. Early tick: P41, 0 peel. Tick ≥ 420: ≥4 Fighters + ≥1 Siege committed on player Hall. Critic p99 < 22. Deploy `spacepixelrts`.

```
git add -A
git commit -m "P49: mixed-arms wave — fighters and siege, not a scout blob"
```

No png dumps, no `notes.md`. Write `tasks/P49.md`. `--yolo` is on; just work.
