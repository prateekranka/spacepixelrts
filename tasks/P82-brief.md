You are the Composer 2.5 **builder** for Spacepixel RTS piece **P82**: SDF-driven unit/building quads (drop the baked atlas for sprites).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev (`0.7.1-proc`)
Read first: `docs/PROCEDURAL.md` §2c, `src/atlas.ts` (`p.diam`/`hex`/`circ`/`line`), `src/render.ts` (unit InstancedMesh shader), `src/content.ts` (`roleOfKind`, team magenta key). Terrain stays P81. VFX stays P80.

Do **not** spawn agents. Do **not** restage opening, civ picker, marshal, or HUD.

## Failed prior attempt (do not repeat)

A previous spawn **timed out** after adding `sprite-sdf.ts` that still **sampled a boot-time baked tile atlas** via `texture2D(uTiles)`. That is **not** P82. The WIP was discarded. Do **not** bake Pix into a texture and look up cells.

## The gap

Units and buildings still sample a **CPU-baked atlas texture**. Port shape+color into the **fragment shader** as **true SDFs** (hex, circle, diamond, line, capsule) driven by a per-instance **shape id**. No `texture2D` of sprite art for units/buildings. Team tint via magenta-key equivalent in the shader (`iTeam`).

## Do this

1. Per-instance attributes: shape id, civ id, anim/frame, team RGB, flash. Fragment shader: SDF silhouettes — Helion hex/sail, Kryos crystal, Nihiline tendril — **three different SDF recipes**, not one blob + hue.
2. Gems/props may stay tiny CPU atlas **or** also SDF. Units+Halls+Houses+Barracks+uniques **must** be shader-SDF. Do not load PNG.
3. Opening must still read **8 Helion vs Kryos wreck belt + mid gem**. `?civ=voidmarked` still tendril people. Workers/Halls identifiable.
4. **p99 < 8 ms**. No per-frame canvas rebuild.
5. **VERSION** `0.7.2-proc`.
6. Commit **before** long verify if needed; do not hang after `git commit`.

## Verify

Vite **5174** only. `npm run build`.

`npm run critic`: version `0.7.2-proc`, p99 < 8, Helion rank vs Kryos wrecks + gem. Screenshot: peoples, not SDF soup. `?civ=voidmarked` still a third people.

Deploy: `npx wrangler pages deploy dist --project-name=spacepixelrts`.

```
git add -A
git commit -m "P82: SDF unit and building quads, drop baked sprite atlas"
```

No huge PNGs, no `notes.md`. Write `tasks/P82.md`. `--yolo` is on; just work.
