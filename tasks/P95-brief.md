You are the Composer 2.5 builder for Starhold RTS piece **P95: emissive team color** (Wave A, piece 2 of 3).

Repo: `/Users/prateekranka/Cowork/spacepixelrts`
Read first: `docs/ISO_REWRITE_PLAN.md` decision 5, `DIRECTIVE.md` item 3, `src/sprites.ts` (`MAG`, `drawBanner`, every `draw*Pix` that calls it).

Art target: `references/DCFA6AB0-721B-4801-8830-E0D1E0D6603E.png` (one saturated accent = team color) and `references/067B6054-6537-475D-A55A-EFCB0686B27F.png` (emissive cyan lens, not a painted flag). Steal TEAM-COLOR LANGUAGE, not the whole sheet.

Do **not** spawn agents. Do **not** start `npm run dev` (already on `:5173`). Do **not** touch `src/sim.ts`, `src/engine.ts`, `src/render.ts` camera, `src/terrain.ts`, or unit anatomy (Wave B). Do **not** commit `notes.md` or `critic/out/*`.

## The gap (P94 critic passed projection; this is the magenta complaint)

Buildings still stamp a loud 4×2 `#FF00FF` facade banner via `drawBanner`. Shader `sprite-sdf.ts` already replaces MAG with `iTeam`. Keep that mechanism. Change **where** MAG is painted.

## Do this (only `src/sprites.ts` + VERSION)

1. **Delete `drawBanner` and every call.** No magenta rectangle on the building face.
2. **ONE emissive MAG region per building**, tiny:
   - Hall: a 2–3 px lamp / spire orb on the roof peak (not a wall flag).
   - House: porch lantern or one window pane as MAG (not the whole wall).
   - Barracks: gate lamp.
   - Unique: staff-orb / focus lens on the roof.
3. **ONE emissive MAG region per living unit role** (2–4 px, held/mounted):
   - Worker: crate lamp or visor slit
   - Scout: engine glow
   - Fighter: visor slit
   - Siege: muzzle crystal / engine
   - Ravager: eye
   - Prism: already a lens — make the lens MAG
   - Shade: glowing eye
   Do **not** MAG-flood the silhouette. Civ palette stays the body; MAG is the team lamp.
4. Corpse may keep a small MAG stain (already `circ(..., MAG)`).
5. Bump `VERSION` in `src/main.ts` to `0.9.1-iso`.

A naive player should name **faction/team at a glance from the glow**, without a magenta sticker. Opening Helion rank: green team glow on visors, not a pink bar on the hall.

## Verify

- `npx tsc --noEmit`; `npm run build`.
- Screenshot: `node scripts/screenshot.mjs --url http://localhost:5173 --out critic/out/p95.png`  
  If that hangs, use `waitUntil: 'domcontentloaded'` (P94 `linePix` hang is already fixed).
- PNG must not show a bright magenta/pink facade banner. Team identity is a small glow (shader-tinted).

## Commit + report

```
git add src/sprites.ts src/main.ts tasks/P95.md
git commit -m "P95: emissive team glow — kill MAG facade banner"
```

Never `git add -A`. Never `notes.md`. Write `tasks/P95.md`. Stay in this gap.
