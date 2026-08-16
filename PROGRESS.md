# Starhold — live status

**Play:** https://spacepixelrts.pages.dev  
**Bar:** Age of Empires II: Definitive Edition, blind, on the running game.

## Now

**Wave 4 P60** — viewport culling. Live **`0.5.0-wave4`**. P59 named the gap.

Opening still P41. Later Wave 4: HUD safe-area, Attack-lock pick radius. Do not raise `MAX_ENTS` in P60.

**Next:** P60 builder, then fresh critic.

## Biggest gap

**Renderer uploads every instance with no viewport cull** (`MAX_ENTS` 384). Off-screen horde should not grow `mesh.count`.

## Tracker

| Wave | Status |
|---|---|
| 0 docs/harness/deploy | done |
| 1 opening wow vs AoE2:DE | **PASS** (P41 critic) |
| 2 gameplay depth | **PASS** (P49 mixed-arms) |
| 3 feel / VFX / command | **PASS** (P58 critic) |
| 4 performance / iPad / bugs | P59 done; P60 culling |
| 5 full 1v1 coherence | queued |
