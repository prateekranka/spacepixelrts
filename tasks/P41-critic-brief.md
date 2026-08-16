You are a FRESH critic for Spacepixel RTS / Starhold. No builder context. Do not read tasks/*.md as truth.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev

Read docs/DESIGN.md §6 and §9.

Run:
```
npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p41-live.png --fps-seconds 3 --wait 3
```
Authoritative capture is critic/out/latest.png. LOOK at the PNG. p99 < 22ms is the fps bar.

Blind vs Age of Empires II: DE. Wave 1 pass = genuinely wowed: you can tell **who is winning in one second** (casualty skew / wrecks in one line); two wings; sparks; gem/workers; quiet dust; HUD; p99 < 22ms. If you would keep playing this vs AoE2:DE, PASS. Else FAIL with ONE biggest gap.

Write tasks/P41-critic.md. Commit only that file:
`git add tasks/P41-critic.md && git commit -m "P41: critic verdict on Kryos wrecks"`
No game code. No PNGs. Do not spawn agents.
