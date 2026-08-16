You are the Composer 2.5 **integrator** for Spacepixel RTS Wave 2 kickoff (piece P42).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev

Wave 1 opening-shot critic **PASSED** (`tasks/P41-critic.md`). Do **not** restage the opening tableau unless a one-liner keeps Kryos wrecks looking alive (still firing, still thinning). Do not spawn agents.

Read docs/DESIGN.md, docs/ARCHITECTURE.md, then **play** the running game (`npm run dev` or live):

1. Box-select Helion fighters, issue Move and Attack-move, confirm they path.
2. Select a worker, confirm gather/return to hall.
3. Open barracks/hall if clickable; try train if the HUD exposes it.
4. Note fog, camera pan/zoom, portrait/command card.
5. `npm run critic` once for frame-time still green.

Write `tasks/P42.md` with: what works, **ONE biggest Wave 2 gap** (gameplay depth vs AoE2:DE, not the already-passed opening shot). Commit `P42: Wave 2 integrator notes` (no huge PNGs). If you make a tiny wreck-diorama fix, include it and deploy `npx wrangler pages deploy dist --project-name=spacepixelrts`. Probe may stay `0.2.16-wave1` unless you ship a fix (`0.3.0-wave2`).
