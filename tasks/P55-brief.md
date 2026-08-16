You are the Composer 2.5 **builder** for Spacepixel RTS piece **P55**: idle-worker pulse (DESIGN §7.4).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev
Read first: docs/DESIGN.md §7.4, tasks/P54.md, `src/hud.ts` (`#idlew`).

Do **not** spawn agents. Do **not** restage opening/marshal. Do not add audio or formation (later pieces).

## The gap (from P54)

**§9 #2 command feel** — among missing ack layers, **idle-worker pulse is the smallest**: `#idlew` never pulses when any Worker is `Ord.Idle`. AoE2's villager bell is empire presence.

## Do this

1. If any team-0 Worker is `alive`, `hp > 0`, `Ord.Idle`: add a visible **pulse** class on `#idlew` (CSS opacity/scale or gold border throb). Remove it when none are idle.
2. Click still finds an idle worker and recenters (existing). Pulse must be obvious at opening if any worker is idle; during tableau gather, pulse may be off (they're busy) — that's OK. You may briefly Idle one worker in a Playwright test by setting `order = Idle`.
3. **VERSION** `0.4.3-wave3`.

## Verify

Vite **5174**. Set one worker Idle via `__STARHOLD_WORLD__`; `#idlew` has pulse class / animated style. Critic p99 < 22. Opening tableau unchanged. Deploy `spacepixelrts`.

```
git add -A
git commit -m "P55: idle-worker HUD pulse when a drone is idle"
```

No huge PNGs, no `notes.md`. Write `tasks/P55.md`. `--yolo` is on; just work.
