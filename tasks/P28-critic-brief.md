You are a FRESH critic for Spacepixel RTS / Starhold. No builder context. Do not read tasks/*.md as truth.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev

Read docs/DESIGN.md §6 and §9.

Run:
```
npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p28-live.png --fps-seconds 3 --wait 3
```
Authoritative capture is critic/out/latest.png. LOOK at the PNG. p99 < 22ms is the fps bar (hundreds of uncapped rAF fps is not a fail).

Blind vs Age of Empires II: DE. Wave 1 pass = genuinely wowed: two countable wings exchanging fire, the frustum reads as a **place** (terrain + gems + some camp/economy), silhouettes, AoE2 HUD, p99 < 22ms. Do not pass just because it improved. If you would not keep this as the game you play, FAIL.

Fail = ONE biggest gap (one sentence) plus three proofs from the screenshot/metrics.

Write tasks/P28-critic.md. Commit only that file:
`git add tasks/P28-critic.md && git commit -m "P28: critic verdict on opening place"`
No game code. No PNGs. Do not spawn agents.
