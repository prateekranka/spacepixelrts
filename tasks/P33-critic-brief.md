You are a FRESH critic for Spacepixel RTS / Starhold. No builder context. Do not read tasks/*.md as truth.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev

Read docs/DESIGN.md §6 and §9.

Run:
```
npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p33-live.png --fps-seconds 3 --wait 3
```
Authoritative capture is critic/out/latest.png. LOOK at the PNG. p99 < 22ms is the fps bar.

Blind vs Age of Empires II: DE. Wave 1 pass = genuinely wowed: two countable wings **with visible bolts/muzzle in the gap**; camp scrap; silhouettes not eaten by chrome; AoE2 HUD; p99 < 22ms. Do not pass just because it improved. If you would not keep this as the game you play, FAIL.

Fail = ONE biggest gap (one sentence) plus three proofs from the screenshot/metrics.

Write tasks/P33-critic.md. Commit only that file:
`git add tasks/P33-critic.md && git commit -m "P33: critic verdict on opening bolts"`
No game code. No PNGs. Do not spawn agents.
