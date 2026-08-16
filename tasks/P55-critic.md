# P55 — Critic verdict (idle-worker pulse, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §7.4 — idle villager pulse on Worker icon when any Worker is Idle (empire feel) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p55-critic.png --fps-seconds 3 --wait 3`  
(`npm run critic` prepends `--screenshot critic/out/latest.png`; that file is the authoritative opening capture. Gitignored.)

**Idle probe:** Playwright on live — force one team-0 Worker to `Ord.Idle` via `__STARHOLD_WORLD__`, sample `#idlew` `.pulse` class + computed `idlew-pulse` animation over ~1.05s, screenshot `critic/out/p55-idle-pulse.png` (gitignored).

**Screenshot reviewed:** `critic/out/latest.png` (harness opening, tick ~120) · `critic/out/p55-idle-pulse.png` (forced idle, pulsing `#idlew`)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## P55 — **Pass**

| Criterion | Result |
|---|---|
| Probe version not stuck at `0.4.2-wave3` | **Pass** — `0.4.3-wave3` |
| Opening tableau: Helion vs Kryos wrecks + mid gem | **Pass** — green Helion rank on central yellow gem; dark Kryos wreck blocks on the right; bottom-left worker pocket apart from the belt |
| Force one team-0 Worker to `Ord.Idle` | **Pass** — Worker id **310** at (36.0, 38.3); prev order Gather → Idle |
| `#idlew` has `.pulse` when any idle Worker | **Pass** — `idlewPulse: true`; `idleCount: 1` |
| `#idlew` visually pulses (not static highlight) | **Pass** — `animation: idlew-pulse` @ 1.05s; scale **1.00 → 1.06**; gold border `#f0d460` + expanding glow over 8 samples |
| Harness p99 < 22 ms | **Pass** — p99 **3.1 ms**, 0 frames worse than 45 fps in 3 s probe |

The idle-worker alert is obvious: `#idlew` breathes with a gold border and soft glow the moment a drone sits Idle — exactly the AoE2-style empire nudge §7.4 asks for.

---

## Single biggest gap

**The opening harness screenshot never shows the pulse — opening workers start on gather/build orders, so `#idlew` stays calm until a job finishes or the harness forces `Ord.Idle`.**

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **3.1** |
| avgFrameMs | 1.45 |
| fps | 692 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.4.3-wave3` |
| Probe ents | 66 |
| Probe tick (opening harness) | 120 |
| Probe selected (opening) | **0** |
| Probe winner (opening) | **-1** |
| Teams pop (player / enemy) | **22/30** · **9/30** |
| Civ | vespari vs aurion |
| Console issues | none |

---

## Idle probe (force `Ord.Idle`)

| Field | Value |
|---|---|
| Worker forced | team-0 Worker id **310** |
| Prev order | Gather (3) |
| `#idlew` pulse before force | **false** |
| `#idlew` pulse after force | **true** |
| CSS animation | `idlew-pulse` · **1.05s** ease-in-out infinite |
| Scale range (samples) | **1.000 → 1.060** |
| Border | `rgb(240, 212, 96)` |
| Glow | box-shadow ramps **14px → 22px** |

---

## What passed

- **Version gate:** deploy ships `0.4.3-wave3`, past the `0.4.2-wave3` stall.
- **Conditional pulse (§7.4):** HUD toggles `.pulse` only when a living team-0 Worker has `order === Ord.Idle`; no pulse when all workers are busy.
- **Visual read:** golden border + scale/glow animation on `#idlew` is unmistakable in live screenshot — not a static tint.
- **Tableau preserved:** P41 grammar intact — Helion swarm on mid gem, Kryos wreck belt, separated worker pocket.
- **Performance (§9 #5):** p99 well under 22 ms with pulse CSS live.
