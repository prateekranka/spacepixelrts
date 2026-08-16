You are the Composer 2.5 **builder** for Spacepixel RTS piece **P56**: formation spread on multi-unit orders.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev
Read first: docs/DESIGN.md §7, tasks/P54.md, `src/sim.ts` `issue()`.

Do **not** spawn agents. Do **not** restage opening clash (ticks 0–239 Attack holds). Do not add audio.

## The gap (from P54)

**§9 #2** — multi-unit moves walk as **one pile**. AoE2 spreads a group on a move click.

## Do this

1. In `issue()` (and AttackMove), if `ids.length > 1`, assign each unit a destination offset in a compact grid/hex around `(x,z)` (spacing ~0.7–1.1 tiles, based on radius). Pathfind to the offset, not the same point.
2. Single-unit orders unchanged. Buildings still set rally to the click.
3. Opening clash orders must stay as they are (don't spread the Attack hold ranks).
4. **VERSION** `0.4.4-wave3`.

## Verify

Vite **5174**. Post-opening (`tick ≥ 300`), box-select 4+ Helion fighters, `issue(Move)` to a point — after 3s they are **not** stacked (pairwise distance mostly > 0.5). Opening tableau unchanged. Critic p99 < 22. Deploy `spacepixelrts`.

```
git add -A
git commit -m "P56: spread multi-unit move destinations so the blob is a formation"
```

No huge PNGs, no `notes.md`. Write `tasks/P56.md`. `--yolo` is on; just work.
