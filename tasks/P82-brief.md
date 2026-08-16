You are the Composer 2.5 **builder** for Spacepixel RTS piece **P82**: SDF-driven unit/building quads (drop the baked atlas for sprites).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev (`0.7.1-proc`)
Read first: `docs/PROCEDURAL.md` §2c, `src/atlas.ts` (`p.diam`/`hex`/`circ`/`line`), `src/render.ts` (unit InstancedMesh shader), `src/content.ts` (`roleOfKind`, team magenta key). Terrain stays P81. VFX stays P80.

Do **not** spawn agents. Do **not** restage opening, civ picker, marshal, or HUD.

## The gap

Units and buildings still sample a **CPU-baked atlas texture**. Port shape+color into the **fragment shader** driven by a per-instance **shape id** (the `Pix` primitives in `atlas.ts` map 1:1 to GLSL SDF). Keep crisp pixel look. Keep `#FF00FF` team-color key (or equivalent shader team tint).

## Do this

1. Per-instance attributes: shape id, civ id, anim/frame, team RGB, flash. Fragment shader draws SDF silhouettes — Helion hex/sail, Kryos crystal, Nihiline tendril — not one blob for all civs.
2. You may keep a tiny atlas for gems/props **only if** units+buildings are shader-SDF. Prefer all sprites SDF. Do not load PNG.
3. Opening must still read **8 Helion vs Kryos wreck belt + mid gem**. `?civ=voidmarked` still shows tendril people. Workers/Halls still identifiable.
4. **p99 < 8 ms**. No per-frame atlas canvas rebuild.
5. **VERSION** `0.7.2-proc`.

## Verify

Vite **5174** only. `npm run build`.

`npm run critic`: version `0.7.2-proc`, p99 < 8, Helion rank vs Kryos wrecks + gem. Screenshot: units look like peoples, not SDF soup. Second shot `?civ=voidmarked` still a third people.

Deploy: `npx wrangler pages deploy dist --project-name=spacepixelrts`.

```
git add -A
git commit -m "P82: SDF unit and building quads, drop baked sprite atlas"
```

No huge PNGs, no `notes.md`. Write `tasks/P82.md`. `--yolo` is on; just work.
