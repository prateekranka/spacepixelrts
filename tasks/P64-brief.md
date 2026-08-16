You are the Composer 2.5 **builder** for Spacepixel RTS piece **P64**: iPad home-indicator / notch must not cover the command deck.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Live: https://spacepixelrts.pages.dev (`0.5.2-wave4`)
Read first: `docs/DESIGN.md` §7.2 §7.4, `src/hud.ts` (`HUD_CSS`, `#topbar`, `#bottom`), `index.html` viewport meta.

Do **not** spawn agents. Do **not** restage opening, marshal, VFX, culling, or Attack-lock. Do not raise `MAX_ENTS`. Do not "fix" Kryos Idle during the opening wreck belt (P63 leftover — not this piece).

## The gap (from P59 iPad QA)

**No `env(safe-area-inset-*)` on the HUD.** `viewport-fit=cover` is set, so the home indicator and notch can overlap `#bottom` command tiles and `#topbar` resource numerals on landscape iPad. Hit targets were already lifted to 44 px (`#idlew`); this piece is **insets only**.

## Do this

1. Pad `#topbar` with `env(safe-area-inset-top)` and `#bottom` with `env(safe-area-inset-bottom)` (and left/right if the landscape notch/home bar needs it). Keep the 44×44 verb tiles fully above the home indicator.
2. Height of `#bottom` / `#topbar` should grow with the inset (padding, not overlapping content). Fallback `env(..., 0px)` so desktop critic layout stays the same.
3. Do not cover the mid-map clash with a taller HUD on desktop (insets are 0 there).
4. **VERSION** `0.5.3-wave4`.

## Verify

Vite **5174** only. `npm run build`.

Playwright:

- Default 1180×820 critic viewport: opening tableau unchanged; p99 < 22; `#bottom` still ~168 px content (inset 0).
- Emulate iPad landscape **with** CSS `env(safe-area-inset-bottom)` if the harness allows (`page.addInitScript` injecting `padding` is OK; or `hasTouch` + a computed-style check that the CSS **contains** `safe-area-inset`). Prove `getComputedStyle(#bottom).paddingBottom` is non-zero when inset is mocked, and command buttons' `getBoundingClientRect().bottom` is above `innerHeight - inset`.

Deploy: `npx wrangler pages deploy dist --project-name=spacepixelrts`.

```
git add -A
git commit -m "P64: pad HUD for iPad safe-area so the home bar does not eat commands"
```

No huge PNGs, no `notes.md`. Write `tasks/P64.md`. `--yolo` is on; just work.
