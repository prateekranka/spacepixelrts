You are the Composer 2.5 **builder** for Spacepixel RTS piece **P68**: Nihiline must be playable so three civs exist on the canvas.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev (`0.5.3-wave4`)
Read first: `docs/DESIGN.md` §2 §9 #3, `tasks/P67.md`, `src/main.ts` (hard-coded `vespari`/`aurion`), `src/sim.ts` `spawnScenario`, `src/hud.ts`, `src/content.ts` (`CIV_NAME`, `uniqueUnit`).

Do **not** spawn agents. Do **not** restage the **default** opening (Helion vs Kryos wrecks must still be the first frame on a bare `https://spacepixelrts.pages.dev` load — Wave 1 lock). Do not change marshal timing, culling, Attack-lock, or HUD safe-area.

## The gap (from P67 integrator, verbatim)

**The live 1v1 is hard-coded Helion vs Kryos, so Nihiline (`voidmarked`) — the third people in DESIGN §2 — never appears and §9 #3 (“three civs are different peoples, not recolors”) cannot pass.**

## Do this

1. **Default boot unchanged:** `world.civ[0]='vespari'`, `civ[1]='aurion'`, then `reset` — critic on the live URL still sees P41 Helion vs Kryos.
2. **Civ picker** (three large tiles: Helion Compact / Kryos Conclave / Nihiline) in the HUD, not a blocking splash. Choosing a civ sets `world.civ[0]`, sets `world.civ[1]` to a **different** civ (if player is Nihiline, enemy Kryos is fine), `world.reset(seed)`, keep camera on the opening look-at.
3. **URL probe:** `?civ=voidmarked` (or `?p=voidmarked`) applies Nihiline as player **before** first reset so Playwright can skip the click. Document it in `tasks/P68.md`.
4. Nihiline already has atlas/stats/`Kind.Shade`. Opening unique is `uniqueUnit(a)` — Nihiline player should show a **Shade** in the clash. Silhouettes must read tendril/spore, not a Helion recolor.
5. **VERSION** `0.6.0-wave5`.

## Verify

Vite **5174** only. `npm run build`.

Playwright:

- Bare URL: version `0.6.0-wave5`, `civ` vespari vs aurion, Helion rank vs Kryos wrecks, p99 < 22.
- `?civ=voidmarked` (or picker click): `civ` includes `voidmarked`; at least one `Kind.Shade` (kind id from `engine.ts`) alive in the opening; screenshot shows purple/green tendril silhouettes distinct from Helion hexes / Kryos crystals.

Deploy: `npx wrangler pages deploy dist --project-name=spacepixelrts`.

```
git add -A
git commit -m "P68: civ picker so Nihiline can appear in the 1v1"
```

No huge PNGs, no `notes.md`. Write `tasks/P68.md`. `--yolo` is on; just work.
