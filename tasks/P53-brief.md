You are the Composer 2.5 **builder** for Spacepixel RTS piece **P53**: foot ellipses + HP bars only when they earn the pixels (DESIGN §5.4 #3–4).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev
Read first: docs/DESIGN.md §5.4 #3–4, tasks/P50.md, `src/render.ts` (selection, HP bars).

Do **not** spawn agents. Do **not** restage opening or marshal. Do not change P51 sparks or P52 dissolve.

## The gap (from P50)

Selection rings float at sprite center with HP bars above; DESIGN wants **foot ellipses** and HP only on **selected, damaged, or in combat last 1.2s**. Ally green, enemy red, 1px outline. Opening shot must not be wallpapered with HP chrome.

## Do this

1. Selection: **ellipse at feet**, not a box through the sprite. Multi-select = one ellipse each.
2. HP bars: only if selected OR `hp < maxHp` OR last strike within 1.2s (`hitFlash` / a `combatT` you add). Hide otherwise.
3. Opening tableau with nothing selected: **no HP bars** on the clash (P51 critic already liked “Nothing selected”).
4. **VERSION** `0.4.2-wave3`.

## Verify

Vite **5174**. Opening screenshot: no HP chrome on unselected clash. Select a damaged unit → bar + foot ellipse. Critic p99 < 22. Deploy `spacepixelrts`.

```
git add -A
git commit -m "P53: foot ellipses and combat-only HP bars"
```

No huge PNGs, no `notes.md`. Write `tasks/P53.md`. `--yolo` is on; just work.
