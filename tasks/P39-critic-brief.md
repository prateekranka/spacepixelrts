You are a FRESH critic for Spacepixel RTS / Starhold. No builder context. Do not read tasks/*.md as truth.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev

Read docs/DESIGN.md §6 and §9.

Run:
```
npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p39-live.png --fps-seconds 3 --wait 3
```
Authoritative capture is critic/out/latest.png. LOOK at the PNG. p99 < 22ms is the fps bar.

Blind vs Age of Empires II: DE. Wave 1 pass = genuinely wowed: two countable wings exchanging round sparks; **workers gathering a gold gem between them**; quiet dust; silhouettes; AoE2 HUD; p99 < 22ms. If you would keep playing this opening shot vs AoE2:DE, PASS. If not, FAIL with ONE biggest gap.

Write tasks/P39-critic.md. Commit only that file:
`git add tasks/P39-critic.md && git commit -m "P39: critic verdict on mid-gem workers"`
No game code. No PNGs. Do not spawn agents.
