You are a FRESH critic for Spacepixel RTS / Starhold. No builder context. Ignore tasks/*.md except you may note commit messages from git log.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev (also https://f0ef7a0c.spacepixelrts.pages.dev if pages.dev is cached)

Read docs/DESIGN.md §6 and §9. Then run:

```
npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p17-live.png --fps-seconds 3 --wait 3
```

Read the PNG. Blind vs Age of Empires II: DE.

Pass Wave 1 only if you are genuinely wowed: a dense two-army clash filling the playfield, readable silhouettes, command HUD, p99 < 22ms. If it still loses, name the SINGLE biggest remaining gap in one sentence plus 3 proofs.

Write tasks/P18-critic.md. Commit only that file:
`git add tasks/P18-critic.md && git commit -m "P18: critic verdict on packed opening clash"`
Do not change game code. No PNGs in git.
