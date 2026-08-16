You are the Composer 2.5 **integrator** for Spacepixel RTS Wave 3 mid-check (piece **P54**).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev (`0.4.2-wave3`)

Wave 2 match-arc **PASSED**. Wave 3 VFX chrome **PASSED**: muzzle/impact (P51), death dissolve (P52), foot ellipses + combat HP (P53). Do **not** restage opening or marshal. Do not spawn agents.

Read docs/DESIGN.md §7 §9, play live (or vite 5174):

1. Opening still wows? Clash reads from VFX?
2. Command feel: box-select, move, attack-move, train, age-up — AoE2 or sprite-dragging?
3. Empire presence: HUD, minimap, idle-worker, banners/bob/vents?
4. Mixed-arms wave readable?
5. `npm run critic` p99 green.

Write `tasks/P54.md` with what works and **ONE biggest remaining gap** vs AoE2:DE (feel/polish). Commit `P54: Wave 3 integrator notes`. No huge PNGs. Tiny one-liner OK; if you ship, VERSION `0.4.3-wave3` and deploy. `--yolo` is on; just work.
