You are a FRESH critic for Spacepixel RTS / Starhold. No builder context.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev

Read docs/DESIGN.md §6 and §9. Run:
```
npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p25-live.png --fps-seconds 3 --wait 3
```
Read the PNG. Blind vs Age of Empires II: DE.

Pass Wave 1 only if genuinely wowed: both armies visible in the same shot, mixing/fighting, filling the playfield, readable silhouettes, command HUD, p99 < 22ms. Fail = ONE biggest gap + 3 proofs.

Write tasks/P26-critic.md. Commit only that:
`git add tasks/P26-critic.md && git commit -m "P26: critic verdict on depth-plane wings"`
No game code. No PNGs.
