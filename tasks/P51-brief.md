You are the Composer 2.5 **builder** for Spacepixel RTS piece **P51**: muzzle + impact VFX so the fight reads without HP chrome.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev
Read first: docs/DESIGN.md §5.4, tasks/P50.md, `src/render.ts` (shootFlash, hitFlash, bolts), `src/sim.ts` (spawnBolt, tryStrike), `src/atlas.ts`.

Do **not** spawn agents. Do **not** restage opening ranks or marshal timing. Do not change pop/epochs/win/lose.

## The gap (from P50 integrator)

**Combat is still HP-flash-and-bolts, not AoE2's muzzle → travel → impact → corpse read chain.** Opening clash sets `shootFlash = 0.04`, so muzzle is invisible; bolts travel but have **no landing spark**. Death/HP-bar/ellipse are later pieces (P52). This piece is **muzzle + impact only**.

## Do this

1. **Muzzle:** when a unit fires, a 1–2 frame bright pixel burst at the sprite (Helion warm white/gold, Kryos ice cyan, Nihiline spore). Opening clash must still show readable muzzle — **do not** clamp `shootFlash` to 0.04. A modest clash scale (e.g. 0.35–0.55) is fine if it does not turn the mid belt into glitter wallpaper.
2. **Impact:** when a bolt hits (or melee connects), spawn a short spark/burst at the target (1–2 frames). Pool the sparks (no per-frame `new` on the hot path — DESIGN arch).
3. Keep team-colored bolt travel. Don't add HP bars. Don't change corpse rules yet.
4. **VERSION** `0.4.0-wave3`.

## Verify

Vite **5174**. `npm run build`. Playwright screenshot of **opening mid fight** at wait 3s: sparks visible in the exchange belt (not only floor dust). `npm run critic` p99 < 22. Tableau still Helion rank vs Kryos wrecks + mid gem.

Deploy wrangler pages `spacepixelrts`.

```
git add -A
git commit -m "P51: muzzle and impact sparks so the clash reads without HP bars"
```

No huge PNGs, no `notes.md`. Write `tasks/P51.md`. `--yolo` is on; just work.
