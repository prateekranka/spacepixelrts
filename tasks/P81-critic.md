# P81 — Critic verdict (procedural terrain shader — live)

**Critic:** fresh blind run · **Bar:** `docs/PROCEDURAL.md` — ground is GLSL (value weather, dune banding, elevation rims), not a baked canvas atlas; RTS-readable; opening clash still wows; p99 < 8 ms · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p81-critic.png --fps-seconds 3 --wait 3`  
(`npm run critic` prepends `--screenshot critic/out/latest.png`; that file is the authoritative opening capture. Gitignored.)

**Probes (live):** Playwright tick sweep (250 ms steps, 0–3.5 s) sampling `__STARHOLD__.rendererInfo.vfx` + fighter counts (`kind === 2`) during opening exchange.

**Screenshots reviewed:** `critic/out/latest.png` (harness, tick ~127) · `critic/out/p81-critic.png` (mid-clash capture, tick ~84)

**Preview URL:** `https://spacepixelrts.pages.dev` (`0.7.1-proc`)

---

## P81 — **Pass (locked)**

| Criterion | Result |
|---|---|
| Probe version ≥ `0.7.1-proc` | **Pass** — `0.7.1-proc` on all probes |
| Opening — Helion rank vs Kryos wrecks + mid gem | **Pass** — **8** Helion Fighters alive throughout sweep; Kryos belt **8 → 7 → 6 → 5** over opening window; screenshot: green Helion rank upper-right, golden mid gem center-left, dark wreck scatter; gem not drowned by terrain noise |
| Ground — procedural banding/rims/weather, not flat checker | **Pass** — horizontal dune banding + value-weather grain on mauve dust; discrete darker rock blobs with rim-lit edges distinguishable from dust; no purple checker/tile repeat |
| Rock/dust still distinguishable | **Pass** — dark irregular rock decals read against banded dust field at RTS zoom |
| P80 VFX still present during clash | **Pass** — `hitSfx` **9 → 52** over sweep; `rendererInfo.vfx` peak **104** (tick ~29); sustained **28–104** mid-clash; yellow/white additive sparks visible on screenshots |
| Harness p99 < 8 ms | **Pass** — p99 **4 ms**, 0 frames worse than 45 fps |
| Screenshot — clash readable through terrain | **Pass** — rank, gem, and wreck belt legible; terrain adds depth without soup |

Procedural terrain ships on live: GLSL dust/rock/void replaces baked canvas ground, the P41 opening tableau holds with P80 GPU VFX, and the frame budget stays intact.

---

## Single biggest gap

**None blocking P81** — version gate, procedural ground look, rock/dust separation, opening clash readability, P80 VFX carry-over, and p99 budget all meet bar on `0.7.1-proc`.

**Marginal (not scored here):** end-of-harness `vfx: 0` at tick ~127 can misread as “no GPU VFX” unless probed during the clash window; dune bands are subtle at default zoom (readable, not cinematic); dust palette stays dark/mauve (avg luma 71) — units and gem still pop.

---

## Harness — default boot

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **4** |
| avgFrameMs | 1.47 |
| fps | 680 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.7.1-proc` |
| Probe ents | 66 |
| Probe tick | 127 |
| Probe `rendererInfo.drawn` | **32** |
| Probe `rendererInfo.vfx` | **0** (post-clash fade; see sweep) |
| Probe hitSfx | **52** |
| Teams pop (player / enemy) | **22/30** · **9/30** |
| Civ | vespari vs aurion |
| Palette distinct colors | 395 |
| Top ground tones | `#665566` (28.8%), `#554466` (18.1%) — banded dust, not flat fill |
| Console issues | none |

---

## Playwright sweep (live, opening window)

| Tick (approx) | `vfx` | `drawn` | hitSfx | Helion F | Kryos F |
|---:|---:|---:|---:|---:|---:|
| 9 | **60** | 40 | 9 | 8 | 8 |
| 19 | **40** | 40 | 16 | 8 | 8 |
| 29 (peak) | **104** | 40 | 26 | 8 | 8 |
| 44 | **36** | 39 | 36 | 8 | 7 |
| 59 | **28** | 38 | 43 | 8 | 6 |
| 69 | **16** | 37 | 50 | 8 | 5 |
| 127 (harness) | **0** | 32 | 52 | 8 | ~5 |

---

## What passed

- **Version gate:** deploy ships `0.7.1-proc`.
- **Procedural terrain:** GLSL value-noise dunes, discrete elevation steps, 1px sun rims — visible banding on live screenshots; not atlas-painted ground.
- **Pathability/readability:** rock decals and dust bands separate cleanly; opening gem and rank remain legible.
- **P80 lock:** GPU instanced VFX still fires during clash (`vfx` > 0, sparks on screenshot).
- **Budget:** p99 **4 ms** — under the **8 ms** procedural migration ceiling.
