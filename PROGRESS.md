# Starhold — live status

**Play:** https://spacepixelrts.pages.dev  
**Bar:** Age of Empires II: Definitive Edition, blind, on the running game.

## Now

**P80 GPU particle VFX** — Wave 5 **PASS (locked)** (P70, `6818f8e`). Live **`0.6.0-wave5`**.

User directive: procedural-first (`docs/PROCEDURAL.md`). P80 → P81 terrain → P82 SDF units. p99 **< 8 ms**.

**Next:** P80 builder, then critic.

## Biggest gap

**Sparks/bolts are still atlas quads.** Convert to GPU-instanced additive particles (broken plume).

## Tracker

| Wave | Status |
|---|---|
| 0 docs/harness/deploy | done |
| 1 opening wow vs AoE2:DE | **PASS** (P41 critic) |
| 2 gameplay depth | **PASS** (P49 mixed-arms) |
| 3 feel / VFX / command | **PASS** (P58 critic) |
| 4 performance / iPad / bugs | **PASS** (P66 critic) |
| 5 full 1v1 coherence | **PASS** (P70 critic) |
| 6 procedural-first | P80 GPU particles |
