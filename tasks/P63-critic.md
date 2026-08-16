# P63 — Critic verdict (Attack-lock peel, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §7.3 — right-click empty ground = Move; right-click enemy sprite = Attack; opening tableau must still hold Attack on its own · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p63-critic.png --fps-seconds 3 --wait 3`  
(`npm run critic` prepends `--screenshot critic/out/latest.png`; that file is the authoritative opening capture. Gitignored.)

**P62 probes:** `node scripts/p62-probe.mjs --url https://spacepixelrts.pages.dev` (gitignored JSON `critic/out/p62-probe.json`).

**Screenshot reviewed:** `critic/out/latest.png` (harness opening, tick ~123)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## P63 — **Pass**

| Criterion | Result |
|---|---|
| Probe version ≥ `0.5.2-wave4` | **Pass** — `0.5.2-wave4` |
| Opening tableau — Helion rank vs Kryos wrecks + mid gem | **Pass** — green Helion rank clustered center-right; dark Kryos wreck belt; golden mid gem in clash; worker pocket bottom-left; sparks active |
| Harness p99 < 22 ms | **Pass** — p99 **5.2 ms**, 0 frames worse than 45 fps |
| Clash fighters hold Attack without player input (tick < 240) | **Pass** — at tick 60 all **8/8** Helion Fighters on `Ord.Attack`; opening tableau still exchanges bolts (probe sparks **1**, harness `hitSfx` **52**) |
| Right-click empty ground → Move (tick < 240) | **Pass** — team-0 Fighter at tick **64**: `order` **1** (Move), `tx`/`tz` set behind rank (`pass: true`) |
| Right-click living Kryos hull sprite → Attack (tick < 240) | **Pass** — team-0 Fighter at tick **70**: `order` **2** (Attack), `tid` **322** matches clicked hull (`pass: true`) |
| Screenshot — peel + clash readable | **Pass** — rank, gem, wrecks, and HUD all legible; no command regression visible in frame |

Marshal can peel a Fighter off the opening Attack-lock with a ground right-click and can still hard-target a living Kryos hull for Attack.

---

## Single biggest gap

**Surviving Kryos clash fighters drift to Idle as the wreck belt forms (0/5 on Attack by tick 69) while Helion holds Attack — tableau still reads, but enemy rank no longer mirrors the §6 “both ranks hold Attack” contract late in the opening window.**

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **5.2** |
| avgFrameMs | 1.68 |
| fps | 596 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.5.2-wave4` |
| Probe ents | 66 |
| Probe tick (opening harness) | 123 |
| Probe `rendererInfo.drawn` | **32** |
| Probe `rendererInfo.calls` | 6 |
| Probe `rendererInfo.tris` | 452 |
| Probe hitSfx (opening harness) | **52** |
| Probe selected (opening) | **0** |
| Teams pop (player / enemy) | **22/30** · **9/30** |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 69 |
| nonBlackPixelShare | 93.32% |
| distinctQuantizedColors | 350 |

---

## P62 pointer probes (tick < 240)

| Probe | tick | Result |
|---|---:|---|
| Opening sample | 63 | Helion Fighters **8** living · Kryos Fighters **5** living · sparks **1** |
| Ground right-click (empty, behind rank) | 64 | `order` **Move** (`pass: true`) · target ~(34.6, 37.8) |
| Hull right-click (Kryos sprite @ projected coords) | 70 | `order` **Attack** · `tid` **322** (`pass: true`) |

---

## What passed

- **Version gate:** deploy ships `0.5.2-wave4`.
- **§7.3 peel:** ground right-click issues Move, not Attack-lock stickiness.
- **§7.3 engage:** hull right-click on a living Kryos Fighter issues Attack with correct `tid`.
- **Opening preserved:** Helion rank vs Kryos wreck belt + mid gem; Helion side keeps Attack-lock through tick 60+ without player input.
- **Performance:** p99 **5.2 ms** with HUD, sparks, and opening clash live.
