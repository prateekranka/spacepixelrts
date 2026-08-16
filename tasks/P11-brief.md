You are the Composer 2.5 builder for Spacepixel RTS piece P11b: silhouette + zoom so the fight reads like Age of Empires II: DE.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read first: docs/DESIGN.md (civ silhouettes §2 and battle clarity §5.4), docs/ARCHITECTURE.md §5, src/atlas.ts, src/render.ts, src/main.ts, src/content.ts, PROGRESS.md.

Do not redesign the sim, civ ids, or HUD layout. Do not touch src/sim.ts except if a sprite key is missing.

## The single gap
The live game's units and terrain read as dark blobs. AoE2:DE wins because every unit has a readable silhouette at default zoom. You will make Starhold pass that test.

Civ display names (already in content.ts): vespari = Helion Compact, aurion = Kryos Conclave, voidmarked = Nihiline.

## Do this
1. Rewrite procedural sprites in `src/atlas.ts`:
   - 2px ink outline on every unit/building.
   - Helion: tall hex hulls, sails, lances — NOT generic circles.
   - Kryos: faceted diamonds, vertical spires, bright ice core.
   - Nihiline: asymmetric tendrils, spore sacs, no right angles.
   - Worker / Scout / Fighter / Siege / unique (ravager=Solar Lance, prism=Glacier Titan, shade=Spore Rider) must be distinguishable in 32px without labels.
   - Buildings (hall/nexus, house/habitat, barracks/yard, unique) must be 2× larger in the atlas (64×64 halls already) and stepped, not blobs.
   - Terrain tiles: isometric diamond feel, dust lighter than void, rock reads as obstacle, ore/gas/solar POP as colored nodes. Raise midtones so the map is not a black mud.
   - Keep magenta #FF00FF as team-color key on a consistent armor plate.
   - Stay inside the ~32–40 color master palette (see ARCHITECTURE.md).
2. In `src/render.ts` + `src/main.ts`:
   - Default camera closer: `input.halfH` around 5.0 (not 8). A mid-map 8v8 fight should fill the screen.
   - Scale units up (~1.6–2.0 world units for infantry, halls ~2.8–3.2) so they match AoE2's "I can click this with a thumb".
   - Terrain map texture: sample tiles with more contrast; optional diamond overlay so the grid reads isometric.
3. Verify:
   - `npm run build` passes.
   - `npm run dev` or preview, then `node scripts/measure.mjs --url http://localhost:5173 --screenshot critic/out/p11.png --wait 3 --fps-seconds 3`
   - FPS >= 55, no console errors, screenshot shows distinct Helion vs Nihiline shapes.
4. Deploy: `npx wrangler pages deploy dist --project-name=spacepixelrts` after build.
5. git commit: `P11: readable civ silhouettes and closer default zoom`
6. Write `tasks/P11.md` with what changed and the screenshot path. That report is not critic evidence.

Do not spawn more agents. Stay in this repo. --yolo is on; just work.
