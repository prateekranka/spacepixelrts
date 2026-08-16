You are the Composer 2.5 **builder** for Spacepixel RTS piece **P60**: viewport culling in the renderer so off-screen units don't eat the instance upload.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev (`0.5.0-wave4`)
Read first: `docs/ARCHITECTURE.md` §8, `tasks/P59.md`, `src/render.ts` (`draw`, `lookAt`, `setZoom`, `info`), `src/engine.ts` (`MAX_ENTS`).

Do **not** spawn agents. Do **not** restage opening ranks, marshal timing, VFX, HUD, Attack-lock, or raise `MAX_ENTS` this piece.

## The gap (from P59 integrator, verbatim)

**The renderer uploads every visible instance with no viewport or frustum culling while `MAX_ENTS` is capped at 384, so today's ~66-ent opening and ~256-ent Playwright stress still measure p99 ~3 ms but the ARCHITECTURE 400-unit landscape-iPad bar has no headroom path.**

## Do this

1. In `GameRenderer.draw()`, skip `setMatrixAt` for entities / bolts / sparks whose interpolated world `(x, z)` is outside the camera's **world-space AABB** (derive from `camera.left/right/top/bottom` + `lookAt` pan, **plus ≥1 tile margin** so sprites don't pop at the edge). Keep `InstancedMesh.frustumCulled = false` (the mesh origin is not the instances).
2. Overlay HP/foot ellipses may skip the same off-screen ents. Fog / terrain stay as they are.
3. Expose `drawn` (the `mesh.count` you set) on `info()` so `__STARHOLD__.rendererInfo.drawn` is probeable.
4. Opening mid-map clash **must still draw** every in-frustum fighter/wreck/spark — do not shrink the opening tableau.
5. **VERSION** `0.5.1-wave4`.

## Verify

Vite **5174** only (`npx vite --host --port 5174 --strictPort`). `npm run build`.

Playwright against live or 5174:

- Opening wait 3s: tableau still Helion rank vs Kryos wrecks; `p99FrameMs` < 22; `rendererInfo.drawn` ≈ alive in-view ents (not 0).
- Spawn **≥180** extra Fighters at a far corner (e.g. world `(4,4)` or `(68,68)`) with camera left on the opening look-at. **`drawn` must stay within ~30 of the opening count** (off-screen horde not uploaded). p99 must not jump vs opening.
- Contrast: spawn the same horde around the camera look-at — `drawn` rises with the horde.

Reuse/extend `scripts/p59-probe.mjs` or write `scripts/p60-probe.mjs`. Do not commit huge PNGs or `notes.md`.

Deploy: `npx wrangler pages deploy dist --project-name=spacepixelrts`.

```
git add -A
git commit -m "P60: viewport-cull instance uploads so off-screen units stay cheap"
```

Write `tasks/P60.md`. `--yolo` is on; just work.
