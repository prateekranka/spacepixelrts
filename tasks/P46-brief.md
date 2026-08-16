You are the Composer 2.5 **builder** for Spacepixel RTS piece **P46**: enemy marshal threatens the player Nexus during macro.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev
Read first: docs/DESIGN.md §6 (scripted AI), tasks/P42.md (gap: enemy only attack-moves after 6+ military / opening minute is safe), `src/sim.ts` `stepAi`, opening clash spawn (`tick < 240` hold).

Do **not** spawn agents. Do **not** restage the opening clash for the first **240 ticks** (P41 look is locked). Do not change win/lose, epochs, or pop.

## The gap

P42: player can ignore base macro during the opening minute because AI only AttackMoves the Nexus when **6+ military are Idle**. Opening Kryos fighters hold `Ord.Attack` mid-map, so they never peel. Wave 2 must sell **ruling under threat**.

## Do this

1. **Ticks 0–239:** unchanged. Opening ranks keep holding Attack across the gap.
2. **Tick ≥ 240:** surviving enemy **military** (not Workers) that are still on the mid clash (or Idle / leftover Attack on a dead tid) **AttackMove the player Nexus**. Set `tx,tz,tid` to the player Hall. Do not wait for 6+ count.
3. **Base AI** still trains Workers toward 8 and Fighters from the Yard when resources/pop allow (existing `stepAi`). Newly trained enemy military also AttackMove the player Hall (rally toward it).
4. Do not suicide the entire mid line on tick 240 in one stack — keep a little stagger (`cooldown` or 0.15s * index) so they march as a group, not a teleport.
5. **VERSION** `0.3.3-wave2`.

## Verify

Vite on **5174** only (never 5173).

```
npm run build
npx vite --host --port 5174 --strictPort
```

Playwright:

1. Fresh load tick ~80: opening Helion vs Kryos wrecks still reads (no early peel).
2. Fast-forward `world.tick` via stepping until tick ≥ 280 (or wait ~14s). At least **3** living team-1 military have `order === AttackMove` (or Attack with tid = player Hall) and are moving toward ~10.5,10.5 (distance decreasing).
3. `winner` still -1 unless the raid actually razed the Nexus.
4. `npm run critic -- --url http://localhost:5174` p99 < 22. Fresh-load opening screenshot still P41-like.

Deploy: `npx wrangler pages deploy dist --project-name=spacepixelrts`.

## Git

```
git add -A
git commit -m "P46: enemy marshal peels toward the player Nexus after the opening"
```

Do not commit `critic/out/*.png` or `notes.md`. Write `tasks/P46.md`. `--yolo` is on; just work.
