# Starhold — live status

**Play:** https://spacepixelrts.pages.dev  
**Bar:** Age of Empires II: Definitive Edition, blind, on the running game.

## Now

**Wave 4 integrator (P59)** — Wave 3 feel **PASS** (P58). Live **`0.5.0-wave4`**.

Opening still P41. Match arc still P49. Feel still P51–P58. P59: viewport/frustum culling + `MAX_ENTS` contract is the Wave 4 gap; `#idlew` touch target hardened to 44 px.

**Next:** Builder adds renderer viewport culling; safe-area on HUD; Attack-lock input fix.

## Biggest gap

**No viewport/frustum culling + `MAX_ENTS` 384** — opening and ~256-ent stress green on critic, but 400-unit iPad bar has no headroom path (`tasks/P59.md`).

## Tracker

| Wave | Status |
|---|---|
| 0 docs/harness/deploy | done |
| 1 opening wow vs AoE2:DE | **PASS** (P41 critic) |
| 2 gameplay depth | **PASS** (P49 mixed-arms) |
| 3 feel / VFX / command | **PASS** (P58 critic) |
| 4 performance / iPad / bugs | P59 integrator **done** |
| 5 full 1v1 coherence | queued |
