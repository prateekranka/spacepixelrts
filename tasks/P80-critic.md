# P80 — Critic verdict (GPU particle VFX — procedural sparks/bolts, live)

**Critic:** fresh blind run · **Bar:** `docs/PROCEDURAL.md` — sparks/bolts are GPU additive instanced particles (broken plume), not atlas quads; opening clash still readable; p99 < 8 ms · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p80-critic.png --fps-seconds 3 --wait 3`  
(`npm run critic` prepends `--screenshot critic/out/latest.png`; that file is the authoritative opening capture. Gitignored.)

**Probes (live):** Playwright tick sweep (250 ms steps, 0–3.5 s) sampling `__STARHOLD__.rendererInfo.vfx` + `__STARHOLD_WORLD__.sparks` / `.bolts` during opening exchange.

**Screenshots reviewed:** `critic/out/latest.png` (harness, tick ~126) · `critic/out/p80-critic.png` (mid-clash capture, tick ~88)

**Preview URL:** `https://spacepixelrts.pages.dev` (`0.7.0-proc`)

---

## P80 — **Pass (locked)**

| Criterion | Result |
|---|---|
| Probe version ≥ `0.7.0-proc` | **Pass** — `0.7.0-proc` on all probes |
| Opening — Helion rank vs Kryos wrecks + mid gem | **Pass** — **8** team-0 Fighters alive; Kryos belt **8 → 5 → 1** Fighters over opening window; screenshot: green Helion rank on golden mid gem, dark wreck scatter screen-right, worker pocket bottom-left |
| Belt alive — muzzle/impact/bolts during clash | **Pass** — `hitSfx` **15 → 52** over sweep; **2–10** active bolts and **0–9** active sparks sampled; yellow/white additive bursts and bolt bead trails visible on screenshot |
| `rendererInfo.vfx` > 0 during opening exchange | **Pass** — peak **112** (tick **22**); sustained **52–76** mid-clash (ticks 17–67); harness end-of-window snapshot at tick **126** reads **0** after sparks fade (expected, not a regression) |
| `rendererInfo.drawn` = entities only | **Pass** — `drawn` **32–40** while `vfx` **8–112**; particle instances counted separately, not folded into entity draw count |
| Harness p99 < 8 ms | **Pass** — p99 **3.1 ms**, 0 frames worse than 45 fps |
| Screenshot — porous/broken plume, clash readable | **Pass** — dispersed additive pixel sparks and elongated bolt beads; not one fat round puff per shot; Helion rank and wreck belt still legible through VFX |

GPU particle VFX ships on live: additive instanced sparks/bolts replace atlas quads, the P41 opening tableau holds, and the procedural frame budget is intact.

---

## Single biggest gap

**None blocking P80** — version gate, opening clash, GPU VFX probe, entity/drawn separation, porous plume look, and p99 budget all meet bar on `0.7.0-proc`.

**Marginal (not scored here):** end-of-harness `vfx: 0` at tick ~126 can misread as “no GPU VFX” unless probed during the clash window; bolt trails are short/beaded rather than long cinematic streaks; spark plumes are small beside the rank scale (still readable, not soup).

---

## Harness — default boot

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **3.1** |
| avgFrameMs | 1.39 |
| fps | 717 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.7.0-proc` |
| Probe ents | 66 |
| Probe tick | 126 |
| Probe `rendererInfo.drawn` | **32** |
| Probe `rendererInfo.vfx` | **0** (post-clash fade; see sweep) |
| Probe hitSfx | **52** |
| Teams pop (player / enemy) | **22/30** · **9/30** |
| Civ | vespari vs aurion |
| Console issues | none |

---

## Playwright VFX sweep (live, opening window)

| Tick (approx) | `vfx` | `drawn` | Active sparks | Active bolts | hitSfx | Helion F | Kryos F |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 17 | **52** | 40 | 2 | 9 | 15 | 8 | 8 |
| 22 (peak) | **112** | 40 | 9 | 10 | 20 | 8 | 8 |
| 57 | **76** | 38 | 6 | 7 | 43 | 8 | 6 |
| 67 | **32** | 37 | 2 | 4 | 50 | 8 | 5 |
| 88 | **8** | 33 | 0 | 2 | 52 | 8 | 1 |
| 126 (harness) | **0** | 32 | 0 | 0 | 52 | 8 | 5 |

---

## What passed

- **Version gate:** deploy ships `0.7.0-proc`.
- **GPU VFX path:** `rendererInfo.vfx` reports instanced particle count (> 0 during clash); `drawn` stays entity-only.
- **Procedural bar:** additive GLSL particles with porous discard — screenshot shows broken plume, not atlas puff quads.
- **P41 lock:** Helion vs Kryos opening still reads rank + gem + wreck belt with live combat VFX.
- **Budget:** p99 **3.1 ms** — well under the **8 ms** procedural migration ceiling.
