You are the Composer 2.5 builder for Starhold RTS piece **P96: procedural terrain elevation** (Wave A, piece 3 of 3).

Repo: `/Users/prateekranka/Cowork/spacepixelrts`
Read first: `docs/ISO_REWRITE_PLAN.md` decision 6, `DIRECTIVE.md` item 2, `src/terrain.ts`, `src/render.ts` (`buildMap`, `pick`, sprite `lift`), `src/sim.ts` (`genMap`, `stampOpeningGround`, `block` / `blockedWorld`).

Art target: `references/terrain-1.jpg` (terraced fbm height, iso-readable cliffs) and `references/44D4BCEE-AA10-4FA2-8400-FDEFB3C94426.png` (canyons + chokepoints). Steal ELEVATION LANGUAGE. Keep Starhold mauve dust (P91 quiet ground) — do **not** retheme to Mars ochre.

Do **not** spawn agents. Do **not** start `npm run dev` (already on `:5173`). Do **not** change combat formulas, economy, civs, opening clash script, MAG lamps (P95), or iso camera (P94). Do **not** commit `notes.md` or `critic/out/*`.

## The gap

The map is a pancake. User wants mountains + valleys on **every** map as battle-changers (chokepoints, high ground, ramps), readable in 2:1 iso.

## Do this

### Heightmap (CPU, one array)

Add `World.height: Uint8Array` (MAP×MAP, levels **0–3**). Fill in `genMap` from low-frequency value-noise / fbm, then terrace:

```
band = h * 4
level = floor(band)
ramp = min(2 * fract(band), 1)   // from references/terrain-1.jpg
h = (level + ramp) / 4
store = round(h * 3)             // 0,1,2,3
```

**Force height 0** on:
- the existing `stampOpeningGround` pad (keep the P41 clash flat)
- `clearBase` pads at both nexuses

**Cliffs = battle-changers using existing pathing:** if two 4-connected neighbors differ by **≥ 2** levels, mark both as `Tile.Rock` and `block=1` (except opening pad / bases). Adjacent **±1** is a **ramp** (walkable Dust). Do **not** add a high-ground damage bonus (mechanics freeze).

Place at least one **ridge** and one **valley corridor** on the route between bases so the rest of the map is not a flat bowl. Opening camera may stay a valley — that's fine if a pan of ~12 tiles hits a cliff.

### Visual (`src/terrain.ts`)

Terrain mesh is currently a 1-segment plane. Rebuild as `PlaneGeometry(MAP, MAP, MAP, MAP)` (or MAP/2) and **displace Y** in the vertex shader from a nearest height texture (`uHeight`). Height scale ~**0.7–1.1** world units per level so cliffs read in iso without covering the HUD.

- Quiet dust stays (P91): no zigzag, no high-frequency checker.
- Cliff faces (steep height gradient) shade darker rock; ramps are a soft slope.
- Keep Rock / Void / Ore / Gas / Solar identity.
- Displace the fog overlay the same way (+ tiny y bias) so mountains don't poke through a flat fog card.

### Sprites sit on the ground (`src/render.ts`)

Lift units/buildings/shadows/props by `height(x,z) * SCALE`. `pick()` must hit the heightfield (short ray march along the unprojected dir is enough — do not leave y=0 picks, they miss ramps). Overlay `project()` uses the lifted y.

### Perf

p99 < 8 ms. One height texture, one displaced terrain mesh. No per-pixel 8-octave fbm in the fragment shader.

Bump `VERSION` to `0.9.2-iso`.

## Verify

- `npx tsc --noEmit`; `npm run build`.
- Screenshot opening: `node scripts/screenshot.mjs --url http://localhost:5173 --out critic/out/p96.png` (use `domcontentloaded` if networkidle hangs).
- Screenshot a ridge: Playwright evaluate `__STARHOLD_INPUT__.pan` toward a high tile, `__STARHOLD_INPUT__.halfH = 8`, write `critic/out/p96-ridge.png`. The PNG must show a **cliff wall / terrace**, not another pancake.
- Opening clash pad still flat; fighters still visible.

## Commit + report

```
git add src/terrain.ts src/render.ts src/sim.ts src/main.ts tasks/P96.md
```

If you add `src/height.ts`, include it. **Never** `git add -A`. Never `notes.md`.

```
git commit -m "P96: heightmap mountains and valleys — cliffs block, ramps walk"
```

Write `tasks/P96.md` (how height is stored, opening pad stays 0, how you verified). Stay in this gap.
