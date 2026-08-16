You are the Composer 2.5 builder for Spacepixel RTS piece P29: put the camp on the camera's left/right, not under the HUD.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read: tasks/P28-critic.md, src/render.ts lookAt, src/sim.ts spawnScenario + stampOpeningGround, src/atlas.ts drawDustTile, src/hud.ts bottom bar height.

P28 critic FAIL. Hold-fire ranks, HUD, p99 still pass. Do **not** change rank pitches, freeze steer, or infantry scale.

Do not spawn agents. Do not AttackMove the clash. Do not zoom out. Do not restore 3.0-tall houses.

## Single biggest gap

The opening frustum still does not read as an inhabited skirmish place — workers/houses were spawned on **world ±X**, which is **screen up/down** and sits under the 56px top bar / 168px command deck. The critic only sees a repeating purple floor + two gems.

Camera: `position (pan.x+8, y, pan.z+10)` lookAt `(pan.x, 0, pan.z)`. **World Z = screen left/right (safe). World X = toward/away from camera (HUD eats it).** Keep every opening camp/worker/gem/prop at `|x - cx| <= 1.6`.

## Do

### 1. Move the camp onto Z flanks (`spawnScenario` / `stampOpeningGround`)

`cx = MAP*0.5`, `cz = MAP*0.52`. Clash ranks stay as they are (same X, split Z).

- Helion house + 3 workers + 1 Ore gem at **`(cx, cz - 7.0)`** band (z in 6.4–7.6, x in cx±1.2).
- Kryos house + 1 Gas gem at **`(cx, cz + 7.0)`** band.
- Two more gems at `(cx ± 1.0, cz ± 6.4)` if needed so **≥3 gems are in the playfield**, not under HUD.
- Wreck/vent props also `|x-cx| <= 1.6`, `|z-cz|` in 5.5–8.5, **not** in the fire lane `|z-cz| < 4.5`.
- Interior rocks: same rule. Delete the old `cx±4.2` house positions.

Workers `Ord.Gather` with `tx/tz` on the nearby gem. Houses stay scale ~1.42.

### 2. Break the repeating metal plate (`atlas` + `buildMap`)

Dust variants still quantize as one purple. Make variant 0 warmer (ochre pebbles `#C4A548`), variant 1 cooler (teal cracks `#5AA8D0`), variant 2 with a darker crater blob. In `buildMap`, after the tile loop, **stamp 10 large decals** (2×2 tile rock/crater using `tile-rock`) at hashed positions on the pad with `|x-cx|<=2` skipped for the fire corridor… actually skip only `|z-cz|<=4`. Decals may sit on Z flanks.

### 3. Verify then ship

1. `npm run build`
2. Preview on a free port. `node scripts/measure.mjs --url http://127.0.0.1:PORT --screenshot critic/out/p29.png --wait 3 --fps-seconds 3`
3. Open the PNG. **Pass only if you can point at house + workers + ≥3 gems in the LEFT or RIGHT of the playfield (between the HUD bars), plus two ranks still firing.** If camps are missing, they are still on X — fix, do not commit.
4. `npx wrangler pages deploy dist --project-name=spacepixelrts`
5. Commit `P29: put opening camp on camera flanks`
6. `tasks/P29.md`. Probe `0.2.4-wave1`.

Do not commit `notes.md` or PNGs.
