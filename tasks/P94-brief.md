You are the Composer 2.5 builder for Starhold RTS piece **P94: isometric 3/4 projection** (Wave A, piece 1 of 3).

Repo: `/Users/prateekranka/Cowork/spacepixelrts`
Read first: `docs/ISO_REWRITE_PLAN.md` (LOCKED), `DIRECTIVE.md`, then `src/render.ts`, `src/sprites.ts` (building drawers only), `src/input.ts` (`tick` / pan / `pick` usage), `src/main.ts` (VERSION + OPENING_PAN).

Art target: `references/44D4BCEE-AA10-4FA2-8400-FDEFB3C94426.png` (iso 3/4 battlefield — diamond ground, buildings as boxes with two walls + roof). Steal PROJECTION, not the Mars palette or HUD.

Do **not** spawn agents. Do **not** start `npm run dev` (already on `:5173`). Do **not** touch `src/sim.ts` or `src/engine.ts`. Do **not** rewrite unit `draw*Pix` (Wave B). Do **not** change team-color MAG banners (that's P95). Do **not** add heightmaps/cliffs (that's P96). Do **not** commit `notes.md` or `critic/out/*`.

## The gap

The live camera is a steep ~60° ortho (`position.set(x+8, y, z+10)` in `lookAt`). The ground reads as a flat top-down square, not an AoE2 2:1 isometric place. Buildings are front-facing facades on camera-billboarded quads.

## Do this

### 1. Lock a 2:1 dimetric camera in `src/render.ts`

Replace the `(+8, y, +10)` offset. Exact contract:

```
ISO_YAW   = Math.PI / 4
ISO_PITCH = Math.atan(0.5)   // ~26.565° → 2:1 tile diamonds
ISO_DIST  = 40               // ortho, distance does not scale; keep far clip happy
```

`lookAt(x, z)` must place the camera at:

```
cx = x + ISO_DIST * Math.sin(ISO_YAW) * Math.cos(ISO_PITCH)
cy =     ISO_DIST * Math.sin(ISO_PITCH)
cz = z + ISO_DIST * Math.cos(ISO_YAW) * Math.cos(ISO_PITCH)
camera.lookAt(x, 0, z)
```

Keep `OrthographicCamera`. Keep `setZoom(halfH)` frustum. Keep `pick()` intersecting the y=0 plane (it already does via `dir.y`). Constructor initial pose must use the same yaw/pitch, not the old (18,22,28).

Screen-aligned sprite billboards (`dummy.quaternion.copy(this.lastCamQ)`) stay — units remain upright sprites. Do **not** invent a second renderer.

### 2. Depth-sort instances

`depthWrite: false` + unsorted InstancedMesh will z-fight once the camera is shallower. Before uploading sdf/prop matrices, sort visible ents by `x + z` **ascending** (NW far, SE near / on top). Shadows may stay unsorted on the ground plane.

### 3. Iso-correct pointer pan in `src/input.ts`

World-axis pan (`pan.x -= dx, pan.z -= dy`) will feel skewed under 45° yaw. Derive the world delta from two `view.pick()` samples of the pointer (or camera right/forward projected onto XZ). WASD may stay world x/z. Hit-test / box-select must still land on the ground.

If the opening tableau is cropped after the camera change, tune **only** `OPENING_PAN.halfH` (and pan x/z if needed) in `src/main.ts` so hall + Helion rank + mid gem stay in frame. Do not restage the sim opening.

### 4. Buildings: iso 3/4 (two sides + roof) in `src/sprites.ts`

Rewrite **only** `drawHallPix` / `drawHousePix` / `drawBarracksPix` / `drawUniquePix` (and tiny helpers they need). Keep atlas packing (`HALL_CELL` 64, unit cells 32, blit Y math) — P92 already fixed that; do not break UVs.

Each building must read as an **isometric box**, not a front elevation:

- **Roof** — 2:1 diamond (or pitched gable in iso), 3-tone, sits on top.
- **Left wall** (south / lit) — parallelogram, lighter `WALL`/`WALL_H`.
- **Right wall** (east / shaded) — parallelogram, darker `WALL_D`.
- **Door** inset on the left (south) wall, **windows** as 2×2 lit pixels on the wall planes.
- Footprint reads as a diamond on the ground, not a flat rectangle.
- Keep civ motif as roof trim only. Keep `drawBanner` MAG pixels for now (P95 kills them).
- Hall stays 64×64; others 32×32. Fill the cell. INK silhouette of the **whole** box first.

Do not change unit drawers. Do not change `sprite-sdf.ts` unless a UV/row constant must follow a packing fix (prefer not to).

### 5. Version

Bump `VERSION` in `src/main.ts` to `0.9.0-iso`.

## Verify

- `npx tsc --noEmit`; `npm run build`.
- Screenshot the running game (dev is on `http://localhost:5173`):  
  `node scripts/screenshot.mjs --url http://localhost:5173 --out critic/out/p94.png`
- Look at the PNG yourself: ground tiles must read as **diamonds** (not a top-down square grid); halls must show **two walls + a roof**; units stay upright. If it still looks like a map viewed from a helicopter, you are not done.
- p99 stays under 8ms (this is camera + sort, not a heavier shader). Optionally `npm run critic` if cheap.

## Commit + report

```
git add src/render.ts src/sprites.ts src/input.ts src/main.ts tasks/P94.md
git commit -m "P94: 2:1 isometric camera, depth-sort, iso building boxes"
```

If you had to touch `src/sprite-sdf.ts` or `src/hud.ts` for pick/minimap, include those files. **Never** `git add -A`. Never `notes.md`.

Write `tasks/P94.md` with camera constants used, what you changed, and how you verified (screenshot path). That report is not critic evidence.

`--yolo` is on. Stay inside P94. When the opening shot reads as an isometric place, stop.
