You are a FRESH critic for Spacepixel RTS / Starhold. No builder context.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Prefer live: https://spacepixelrts.pages.dev
Fallback preview: https://802dbcb3.spacepixelrts.pages.dev

Read docs/DESIGN.md §6 and §9. Run:

```
npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p19-live.png --fps-seconds 3 --wait 3
```

If pages.dev looks cached/old (giant black squares still), also measure the 802dbcb3 preview URL.

Read the PNG. Blind vs Age of Empires II: DE.

Pass Wave 1 only if genuinely wowed: dense two-army clash filling the playfield, no giant UI-like panels over units, readable silhouettes, command HUD, p99 < 22ms. Fail = ONE biggest gap + 3 proofs.

Write tasks/P20-critic.md. Commit only that:
`git add tasks/P20-critic.md && git commit -m "P20: critic verdict after gem nodes"`
No game code. No PNGs.
