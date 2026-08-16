You are the Composer 2.5 builder for Spacepixel RTS piece P27: readable hold-fire ranks that fill the opening shot.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read first: docs/ARCHITECTURE.md, docs/DESIGN.md §6 and §9, docs/ORCHESTRATION.md, PROGRESS.md, tasks/P26-critic.md, then src/sim.ts spawnScenario + thinkUnits, src/render.ts infantry scale, src/atlas.ts PAL.void/dust, src/main.ts halfH, src/hud.ts #fps.

P26 critic FAIL. HUD and p99 already pass. Single biggest gap (obey this, ignore older AttackMove-through-each-other experiments):

The opening clash still does not read as **two armies fighting across a filled playfield with readable silhouettes**. P25 put both wings on the depth plane then they AttackMoved into **one overlap stack**. Orchestrator already started a hold-fire spawn in the working tree — keep brighter dust / Attack hold, then finish the numbers below.

Do **not** spawn agents. Do **not** redesign civs, renderer architecture, or the tick loop.

## Root cause

1. Billboard scale (~1.72) > column pitch (~0.95) → sprites stack into two blobs.
2. `Ord.Attack` still **steers toward the acquired target** when out of range (`thinkUnits`); melee unique (Ravager) charges and collapses the line.
3. AttackMove-through-center was tried (P23–P25) and always became one pile. DESIGN.md §6 is now **hold-fire ranks**. Follow the current DESIGN.md, not P25.
4. Opening pad was mostly void-looking; dust was darkened; gems sat outside the frustum.

## Do (exact numbers — do not improvise these)

### A. Formation (`spawnScenario`)

Camera look-at stays `(cx, cz) = (MAP*0.5, MAP*0.52)`. Both wings **same world X band**. Split on **Z**.

```
colPitch = 1.55   // along Z; MUST exceed infantry scaleX
rowPitch = 1.40   // along X; keep total X span ≤ 2.0 so both rows stay in frustum
gap      = 3.60   // Helion rank center to Kryos rank center (in strikeRange with opening bonus)
zHelion  = cz - gap/2
zKryos   = cz + gap/2
8 fighters per side: col = i%4, row = (i/4)|0
x = cx + (row - 0.5) * rowPitch
z = zHelion|zKryos + (col - 1.5) * colPitch
order = Ord.Attack  (NOT AttackMove)
tx/tz = a point on the ENEMY rank (so facing is correct) but they must not walk there
```

Uniques: Helion at `(cx - 1.35, zHelion)`, Kryos at `(cx - 1.35, zKryos)`, also `Ord.Attack`.

### B. Freeze steer on opening clash (`thinkUnits`)

For `tick < 240` and `openingClashEnt(e)` and `order === Ord.Attack`:
- acquire + `tryStrike` if in `strikeRange`
- **never** call `steer` / AttackMove
- `vx = vz = 0`, `path = null`
- skip `moveSeparate` pushes for these ents while frozen (or they will creep)

Keep the existing opening range bonus (`+0.95`) so 3.6-tile gap is in range.

### C. Readable sprites

In `src/render.ts` infantry (non-building, non-resource) scale: **1.08 × 1.14** (not 1.72/2.15). Buildings stay as they are. Gems stay 0.85wu.

HP bars only if the sprite was drawn (`drawnEntIds`) — already started; keep it.

### D. Fill the frustum (not 70% empty grid)

- Keep brighter `PAL.void` / `PAL.dust` already in atlas (do not revert).
- `stampOpeningGround`: dust pad at least 28×20 around look-at. Scatter **single-tile Rock** on the **rim** (not through the 8-tile-wide fire lane on Z). Place **four gems** inside the camera: `(cx±8, cz±5)`-ish — Ore/Gas/Solar mix, still 0.85wu gems, not black panels.
- `input.halfH = 5.8` in `src/main.ts` (clamp min stays 4). Look-at remains clash center.

### E. HUD lie

`#fps` sits next to Idle worker and critics read it as idle count. Set text to `"${fps} FPS"` (or a labeled `<small>FPS</small>`). Do not put the number inside the Idle worker button.

### F. Verify then ship

1. `npm run build`
2. Preview on a **free** port (4173/4180 may be taken). `node scripts/measure.mjs --url http://127.0.0.1:PORT --screenshot critic/out/p27.png --wait 3 --fps-seconds 3`
3. Open `critic/out/p27.png` yourself. **Pass only if you can count ≥14 distinct unit bodies, two separated wings, bolts in the gap, dust/rock/gems occupying most of the playfield, no orphan HP bars in empty space.** If still a blob or 70% void, fix and remeasure before committing.
4. `npx wrangler pages deploy dist --project-name=spacepixelrts` (ignore pages_build_output_dir warning).
5. Commit: `P27: hold-fire ranks with readable spacing`
6. Write `tasks/P27.md` (what changed, screenshot path, p99). That file is not critic evidence.

Do not commit `notes.md`, `critic/out/*.png`, or secrets. Bump probe version in `src/main.ts` to `0.2.2-wave1`.
