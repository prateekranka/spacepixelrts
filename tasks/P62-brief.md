You are the Composer 2.5 **builder** for Spacepixel RTS piece **P62**: opening right-click must Move, not re-Attack the clash belt.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev (`0.5.1-wave4`)
Read first: `docs/DESIGN.md` §7.3, `src/input.ts` (`orderAt`, `closest`), `tasks/P58-critic.md` leftover / `tasks/P59.md` marshal bug (those two reports only — do not restage from them).

Do **not** spawn agents. Do **not** restage opening ranks, marshal timing, VFX, HUD, or culling. Do not raise `MAX_ENTS`.

## The gap

**Opening Attack-lock:** `orderAt` picks enemies with world radius **1.4 + unit radius**, so a right-click on empty ground near the clash belt re-issues `Ord.Attack` instead of `Ord.Move` until tick 240. A marshal cannot peel the opening rank. AoE2: right-click **on** a unit = attack; right-click **ground** = move.

P61 leftover (sim cost of off-screen armies) is **not** this piece.

## Do this

1. In `orderAt`, only issue `Ord.Attack` when the pointer is actually **on** an enemy sprite — **screen-space** hit (project unit, pointer within ~28 CSS px, same generosity as ARCHITECTURE pick), not a 1.4-tile world disk.
2. Resource gather may keep a modest world radius, but must not steal Move clicks that are clearly empty ground.
3. Programmatic `world.issue(ids, Ord.Move, …)` already works — do not change `World.issue` formation. This is **input pick** only.
4. Opening clash must still hold `Ord.Attack` on its own (scripted tableau). You are not changing spawn/ceasefire.
5. **VERSION** `0.5.2-wave4`.

## Verify

Vite **5174** only. `npm run build`.

Playwright on live or 5174, **tick < 240**:

- Select a team-0 Fighter. Right-click empty ground **away from hulls** (e.g. behind the player rank, or a dust patch with no enemy within ~28 px screen). After the click, that fighter's `order` is **Move** (not Attack) and `tx,tz` match the click.
- Right-click **on** a living Kryos hull: still Attack.
- Opening tableau screenshot unchanged (Helion rank vs Kryos wrecks). `npm run critic` p99 < 22.

Deploy: `npx wrangler pages deploy dist --project-name=spacepixelrts`.

```
git add -A
git commit -m "P62: right-click ground moves instead of re-attacking the clash belt"
```

No huge PNGs, no `notes.md`. Write `tasks/P62.md`. `--yolo` is on; just work.
