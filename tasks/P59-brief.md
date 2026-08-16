You are the Composer 2.5 **integrator** for Spacepixel RTS **Wave 4 kickoff** (piece **P59**).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev (`0.4.5-wave3`)

Wave 1 opening **PASSED** (P41). Wave 2 match-arc **PASSED** (P49). Wave 3 feel **PASSED** (P58 critic). Do **not** restage the opening tableau, marshal timing, or Wave 3 VFX/HUD. Do not spawn agents. Do not reopen passed pieces.

Read first: `docs/ARCHITECTURE.md` §1 §8 (60 fps / frame budget / 400-unit stress), `docs/DESIGN.md` §7.2 (landscape iPad touch) §9 #5, `PROGRESS.md`.

Wave 4 scope is **performance / hardening**, not new civs or a restaged fight:
- 60 fps under load (pools, culling, instance caps)
- iPad landscape QA (touch targets ≥44px, safe area, two-finger pan/pinch)
- Bug sweep that would make a marshal quit

**Play** the running game (live, or `npx vite --host --port 5174 --strictPort` — never steal port 5173):

1. Opening still Helion vs Kryos wrecks, sparks, no HP wallpaper?
2. `npm run critic -- --url https://spacepixelrts.pages.dev` — p99 still green on the default ~66-ent opening?
3. **Load:** using Playwright + `window.__STARHOLD_WORLD__`, spawn extra military (keep `MAX_ENTS` 384; do not crash) until ~200–300 alive ents, or wait for mixed-arms + extra trains. Measure rAF p99 / frames worse than 45 fps / probe `fps` / `rendererInfo`. Architecture bar: 16.6 ms, stress later 400 units. Name whether the current skirmish is already over budget or only the stress case is.
4. **iPad:** check `index.html` viewport-fit, HUD `min-height`/`min-width` vs DESIGN §7.2 44×44, two-finger pan + pinch in `src/input.ts`, home-indicator / notch overlap. Playwright can emulate `iPad Air` landscape if useful; do not require a physical device.
5. **Bugs a marshal would hit:** P58 leftover — opening Attack-lock so right-click on clash fighters re-issues Attack instead of Move until tick 240. Also: third civ never on screen, `MAX_ENTS` 384 vs contract 2048, no frustum culling, HUD `#idlew` 40px vs 44px, anything else you find by playing.

Write `tasks/P59.md` with what still works and **ONE biggest Wave 4 gap** (one sentence + the smallest independently-judgeable fix). Commit `P59: Wave 4 integrator notes`. No huge PNGs. Tiny one-liner hardening OK; if you ship pixels/code, bump VERSION `0.5.0-wave4` and deploy `npx wrangler pages deploy dist --project-name=spacepixelrts`. `--yolo` is on; just work.
