You are a FRESH critic for Spacepixel RTS / Starhold. No builder context. Do not read tasks/*.md as truth (including P27.md).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev

Read docs/DESIGN.md §6 (opening tableau is now hold-fire ranks, not AttackMove-through) and §9.

Run:
```
npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p27-live.png --fps-seconds 3 --wait 3
```
The harness also writes critic/out/latest.png — that file is the authoritative capture. Open and LOOK at the PNG. Pair with the JSON metrics (p99 < 22ms is the fps bar; uncapped rAF fps of hundreds is not a fail).

Blind vs Age of Empires II: Definitive Edition on: battle clarity, command feel, empire presence, pixel craft, 60fps.

Wave 1 pass = genuinely wowed on the opening shot: two countable wings exchanging fire, silhouettes readable, playfield feels like a place not a void postage stamp, AoE2-grammar HUD, p99 < 22ms. Do not pass just because it improved vs an earlier pile. If you would not keep this as the game you play, FAIL.

Fail = ONE biggest gap (one sentence) plus three proofs from the screenshot/metrics.

Write tasks/P27-critic.md. Commit only that file:
`git add tasks/P27-critic.md && git commit -m "P27: critic verdict on hold-fire ranks"`
No game code. No PNGs. Do not spawn agents.
