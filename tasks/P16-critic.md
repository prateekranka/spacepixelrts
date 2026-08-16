# P16 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/latest.png --fps-seconds 3 --wait 4`  
**Also measured:** `http://localhost:4173` (preview) and `http://localhost:5173` (dev) — same commit `a4993d5` (*P12: closer default zoom*), visually identical to live.

**Screenshot reviewed:** `critic/out/latest.png` (live), `critic/out/p12-preview.png` (local preview)

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Two armies apart in 1s (silhouette, not hue) | **Pass** — tall green block fighters vs squat blue/red diamond fighters read as different shapes |
| Opening clash fills the playfield | **Fail** — ~9 sprites in the center; >60% of canvas is void grid |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **6.4 ms** (avg 2.34 ms, 427 fps uncapped rAF) |
| HUD feels like a command deck | **Pass** — resource strip, minimap, command tiles, faction header |

---

## Single biggest gap

The opening tableau is still a tiny skirmish floating in a void, not a mid-map battle that fills the screen the way AoE2:DE sells the fight in frame one.

**Three proofs:**

1. **~9 combat sprites** visible in the screenshot (3 green block fighters + ~6 blue/red diamonds) clustered in the central ~15–20% of the playfield; DESIGN §6 calls for **8 vs 8 Fighter clumps plus one unique each** already crossing mid-map.
2. **64% of pixels** are near-black void (`#111122` 32.6% + `#000011` 31.7% per harness palette); terrain, bases, and economy activity do not frame the fight — it reads as sprites on a purple grid, not a place at war.
3. **Default camera still leaves most of the viewport empty** despite the closer-zoom commit (`probe.hall: 10`); compared to the AoE2 bar, you cannot read army mass or who is winning from density alone — you have to squint at a handful of blobs.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **6.4** |
| avgFrameMs | 2.34 |
| fps | 427 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.0-wave1` |
| Probe ents | 53 |
| Console issues | none |
| avgLuminance | 30 |
| distinctQuantizedColors | 259 |

Local preview/dev: p99 **6.4–6.5 ms**, same entity count and same visual composition as live.

---

## What passed

- **Silhouette:** green vertical hooded blocks vs blue diamond chevrons — distinguishable without relying on team color alone.
- **Performance:** frame budget is healthy; no spikes above 45 fps threshold in the 3 s probe.
- **HUD:** Ore/Vol/Chg/Pop strip, 160×160 minimap with viewport rect, bottom command deck with Move/Attack/Stop and group keys — reads as an RTS command deck, not a debug overlay.
