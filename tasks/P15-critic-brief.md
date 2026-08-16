You are a FRESH critic for Spacepixel RTS (working title Starhold). You have no builder context. Do not trust tasks/*.md or PROGRESS.md as evidence.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev
Local preview may be on http://localhost:4173 or `npm run dev` (5173).

## What to do
1. Read docs/DESIGN.md and docs/ARCHITECTURE.md (the quality bar only).
2. Inspect the RUNNING game, not the code first. Run:
   - `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/live.png --fps-seconds 4 --wait 3`
   - If live is stale, also `npm run critic -- --url http://localhost:4173 --screenshot critic/out/local.png` (start `npm run dev` if needed).
3. Open the screenshot file yourself (Read the PNG). Optionally `modlens analyze -i critic/out/live.png -p openai --prompt "RTS pixel art vs Age of Empires 2 DE: silhouette, battle clarity, terrain, HUD"`. If modlens fails, say so — do not fake a visual verdict.
4. Blind comparison vs Age of Empires II: Definitive Edition on: battle clarity, command feel, empire presence, pixel craft, 60fps.
5. Write tasks/P15-critic.md with:
   - Pass or Fail for Wave 1 scope (playable isometric skirmish, select/move, fight readable, 60fps, palette).
   - If Fail: the SINGLE biggest gap in one sentence, then 3 concrete pixels/metrics that prove it.
   - FPS, console errors, palette counts from the harness JSON.
   - What you actually saw in the screenshot (units, terrain, HUD).
6. Do not change game code. git commit only if you add tasks/P15-critic.md:
   `git add tasks/P15-critic.md critic/out/latest.json 2>/dev/null; git commit -m "P15: critic verdict on live Wave 1"`
   Do not commit large PNGs.

Wave 1 wow bar: a critic watching the live canvas sees a pixel-crisp isometric battlefield, can tell armies apart, it feels like commanding, 60 fps. Not full AoE2 campaign depth yet — but it must look like a game you would keep playing, not a grid demo.
