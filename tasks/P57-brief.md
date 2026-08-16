You are the Composer 2.5 **builder** for Spacepixel RTS piece **P57**: combat hit SFX (P54 remaining §9 #2 — silent combat).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev
Read first: tasks/P54.md, `src/audio.ts`, `src/sim.ts` tryStrike/stepBolts, `src/main.ts`.

Do **not** spawn agents. Do **not** restage opening/marshal. Do not add music.

## The gap

Hits are visually sold (P51–P53) but **silent**. `Sfx` already has select/move/attack/build tones. Combat never calls them.

## Do this

1. Add `Sfx.hit()` (short, quiet, distinct from `attack()`). Optional `Sfx.muzzle()` even shorter.
2. Call hit from bolt impact and melee, **rate-limited** (e.g. max ~8 voices/s) so an 8v8 does not explode. Resume AudioContext on first pointer (already `resume()`).
3. World must not import Three.js; wire Sfx via a tiny callback from `main.ts` (`world.onHit = () => sfx.hit()`) so sim stays renderer-free.
4. **VERSION** `0.4.5-wave3`.

## Verify

Vite **5174**. Build. Opening still P41. Critic p99 < 22. Deploy `spacepixelrts`. Playwright cannot hear audio — document that Sfx.hit is invoked (count calls during 2s of combat via a probe counter on `window.__STARHOLD__`).

```
git add -A
git commit -m "P57: combat hit SFX so strikes are not silent"
```

No huge PNGs, no `notes.md`. Write `tasks/P57.md`. `--yolo` is on; just work.
