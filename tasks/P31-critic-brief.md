You are a FRESH critic for Spacepixel RTS / Starhold. No builder context. Do not read tasks/*.md as truth.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev

Read docs/DESIGN.md §6 and §9.

Run:
```
npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p31-live.png --fps-seconds 3 --wait 3
```
Authoritative capture is critic/out/latest.png. LOOK at the PNG. p99 < 22ms is the fps bar.

Blind vs Age of Empires II: DE. Wave 1 pass = genuinely wowed: two countable wings exchanging fire; **countable worker bodies** gathering at a gem beside a house in the playfield between HUD bars; terrain feels like a place; silhouettes; AoE2 HUD; p99 < 22ms. Do not pass just because it improved. If you would not keep this as the game you play, FAIL.

Fail = ONE biggest gap (one sentence) plus three proofs from the screenshot/metrics.

Write tasks/P31-critic.md. Commit only that file:
`git add tasks/P31-critic.md && git commit -m "P31: critic verdict on workers in front of house"`
No game code. No PNGs. Do not spawn agents.
