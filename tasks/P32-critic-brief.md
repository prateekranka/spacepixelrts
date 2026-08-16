You are a FRESH critic for Spacepixel RTS / Starhold. No builder context. Do not read tasks/*.md as truth.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev

Read docs/DESIGN.md §6 and §9.

Run:
```
npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p32-live.png --fps-seconds 3 --wait 3
```
Authoritative capture is critic/out/latest.png. LOOK at the PNG. p99 < 22ms is the fps bar.

Blind vs Age of Empires II: DE. Wave 1 pass = genuinely wowed: **two countable combat wings exchanging fire in the center**; a **separate** house+worker+gem camp with a gap from the Helion wing; silhouettes; AoE2 HUD; p99 < 22ms. Do not pass just because it improved. If you would not keep this as the game you play, FAIL.

Fail = ONE biggest gap (one sentence) plus three proofs from the screenshot/metrics.

Write tasks/P32-critic.md. Commit only that file:
`git add tasks/P32-critic.md && git commit -m "P32: critic verdict on separated wing and camp"`
No game code. No PNGs. Do not spawn agents.
