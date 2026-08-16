You are the Composer 2.5 builder for Spacepixel RTS piece P33: make opening bolts unmissable.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read: tasks/P32-critic.md, src/sim.ts tryStrike/spawnBolt/strikeRange, src/render.ts bolt draw, src/atlas.ts drawBolt.

P32 critic FAIL. Two wings now face each other — **zero readable projectiles**. HUD/p99 pass. Do not restack armies. Do not spawn agents.

## Single biggest gap (verbatim)

The §6 opening tableau still fails to show two wings **exchanging fire** — green and blue ranks face off in center, but no readable projectiles or hit VFX cross the gap.

## Do

1. Opening clash (`tick < 240` && `openingClashEnt`): strike cooldown **0.32s**, bolt speed **6.0** (slower = longer on screen), bolt `life` **1.4**. Keep +0.95 range bonus.
2. Bolt billboard scale **2.05** (was ~0.92). Atlas `bolt-sting` / `bolt-beam`: fat white core + civ-bright rim (Helion gold-green, Kryos cyan). No transparent 16×16 speck.
3. Draw **two** instances per bolt (current pos + 0.45 along velocity) so they read as streaks.
4. On strike, set `e.flash`/cooldown visual already used — bump iFlash to 0.55 while cooldown > 0.2 so muzzles pop.
5. Do not change colPitch/camp coords.

## Verify then ship

1. `npm run build`
2. Preview free port. `node scripts/measure.mjs --url http://127.0.0.1:PORT --screenshot critic/out/p33.png --wait 3 --fps-seconds 3`
3. Open PNG. **Pass only if ≥4 bright bolt streaks are visible in the gap between the two wings.**
4. Deploy `npx wrangler pages deploy dist --project-name=spacepixelrts`
5. Commit `P33: unmissable opening bolt streaks`
6. `tasks/P33.md`. Probe `0.2.8-wave1`.

Do not commit `notes.md` or PNGs.
