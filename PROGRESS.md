# Starhold — live status

**Play:** https://spacepixelrts.pages.dev  
**Bar:** Age of Empires II: Definitive Edition, blind, on the running game.  
**Orchestrator:** Grok 4.6 Extra High. Builders/critics: Composer 2.5.

## Now

Wave 1 skirmish is **live at 60 fps** (52 entities, 5 draw calls, no console errors). HUD grammar is AoE2-like. **Fresh critic + P11 silhouette builder are spawning.**

## Biggest gap

**Units and terrain read as dark blobs.** Live screenshot: avg luminance 29, 243 quantized hues, top colors all near-black purple. Helion fighters are tiny green circles; Kryos are tiny blue diamonds. AoE2:DE wins on silhouette at default zoom. That is the only gap this round.

## Tracker

| Id | Piece | Status | Critic |
|---|---|---|---|
| P00 | docs + scaffold + deploy | done | live URL up |
| P02 | critic harness (`npm run critic`) | done | metrics on pages.dev |
| P10–P14 | sim / path / map / input | shipped | pending P15 critic |
| P11b | silhouettes + closer zoom | building | — |
| P15 | Wave 1 critic | critic | in flight |
| P20–P35 | civs / eco / combat / HUD | first pass in tree | blocked on readability |
| P40–P50 | perf / iPad / integrator | queued | |
