You are the Composer 2.5 **builder** for Spacepixel RTS piece **P81**: procedural terrain in the fragment shader.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev (`0.7.0-proc`)
Read first: `docs/PROCEDURAL.md`, `src/render.ts` (`buildMap`, `mapMesh`), `src/engine.ts` (`Tile`, `MAP`). Steal look language from `references/sand-shader.jpg` and `references/terrain-1.jpg` / `terrain-2.jpg` — **value weather, two-scale dune banding, discrete elevation steps, 1px sun rim**. Do not port that demo's UI. Do not load PNG terrain.

Do **not** spawn agents. Do **not** restage opening, civ picker, marshal, HUD, or P80 VFX. Do **not** start P82 (units stay atlas).

## The gap

The ground is a **baked canvas atlas** stamped onto a flat plane. Replace the dust/rock *look* with a **procedural GLSL terrain shader** so the world reads as weather + dunes + rims, not a checkerboard of baked tiles. Tiles must stay **pathable and readable at RTS zoom** (Rock still looks like a block, Dust like dust, resource tiles still mark Ore/Gas/Solar — no noisy soup that hides gems or the clash belt).

## Do this

1. `mapMesh` uses a ShaderMaterial. Fragment shader: value-noise weather, two-scale dune/ripple banding, quantized elevation bands with a 1px-ish sun rim. Sample `world.tiles` via a small DataTexture (or packed attribute) so Rock/Ore/Gas/Solar/Void still tint the shader — do not invent a second map.
2. Keep nearest-neighbor / pixel-crisp at RTS zoom. No mip blur. No per-frame tile texture rebuild.
3. Opening clash must still sit on readable dust with the mid gem visible. Helion vs Kryos tableau unchanged.
4. **p99 < 8 ms**.
5. **VERSION** `0.7.1-proc`.

## Verify

Vite **5174** only. `npm run build`.

`npm run critic`: version `0.7.1-proc`, p99 < 8, opening Helion rank vs Kryos wrecks + mid gem still readable (not buried in noise). Screenshot of the ground should show banding/rims, not a flat purple checker.

Deploy: `npx wrangler pages deploy dist --project-name=spacepixelrts`.

```
git add -A
git commit -m "P81: procedural terrain shader with dune banding and sun rims"
```

No huge PNGs, no `notes.md`. Write `tasks/P81.md`. `--yolo` is on; just work.
