You are the Composer 2.5 **integrator** for Spacepixel RTS **Wave 3 kickoff** (piece **P50**).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev (`0.3.5-wave2`)

Wave 2 match-arc **PASSED** (train, Orbit, win/lose, mixed-arms inbound). Do **not** restage the opening tableau. Do not spawn agents.

Read docs/DESIGN.md §5.4 §7 §9, then **play** the running game (live or `npx vite --host --port 5174`):

1. Opening shot still Helion vs Kryos wrecks?
2. Box-select, move, attack-move — does issuing orders feel like commanding?
3. Bolts/muzzle/death — battle clarity vs AoE2:DE (not HP-bar chrome).
4. HUD: portraits, command bar, minimap, idle-worker — empire presence.
5. When the mixed-arms wave arrives, can you read fighters vs siege?
6. `npm run critic` p99 still green.

Write `tasks/P50.md` with what works and **ONE biggest Wave 3 gap** (feel/polish vs AoE2:DE — not the already-passed match arc). Commit `P50: Wave 3 integrator notes`. No huge PNGs. Tiny one-liner VFX/HUD fixes allowed; if you ship, VERSION `0.4.0-wave3` and deploy `npx wrangler pages deploy dist --project-name=spacepixelrts`. `--yolo` is on; just work.
