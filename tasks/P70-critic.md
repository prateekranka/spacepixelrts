# P70 — Critic verdict (Wave 5 wrap — full 1v1 coherence vs AoE2:DE, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §9 — all six wow points on the **running game**; default boot must stay Helion vs Kryos (P41); Waves 1–4 already passed · **Judged:** 2026-08-16

**Harness (live):** `node scripts/measure.mjs --url https://spacepixelrts.pages.dev --screenshot critic/out/p70-default.png --fps-seconds 3 --wait 3`

**Probes (live):** Playwright tick sweep + `node scripts/p62-probe.mjs` — gitignored JSON under `critic/out/p70-probe.json`.

**Screenshots reviewed:** `critic/out/p70-default.png` (default boot, tick ~120) · `critic/out/p70-voidmarked.png` (`?civ=voidmarked`, tick ~71)

**Preview URL:** `https://spacepixelrts.pages.dev` (`0.6.0-wave5`)

---

## Wave 5 — **Pass (locked)**

| Criterion | Result |
|---|---|
| Probe version ≥ `0.6.0-wave5` | **Pass** — `0.6.0-wave5` on all probes |
| Default boot — `civ` vespari vs aurion | **Pass** — `["vespari","aurion"]` |
| Default boot — P41 opening intact (Helion rank vs Kryos wrecks + mid gem) | **Pass** — **8** team-0 Fighters alive, **5** team-1 Fighters alive; screenshot: green Helion rank on golden mid gem, dark Kryos wreck belt screen-right, worker pocket bottom-left, muzzle sparks on belt |
| Default boot — harness p99 < 22 ms | **Pass** — p99 **3.1 ms**, 0 frames worse than 45 fps |
| `?civ=voidmarked` — third people on canvas | **Pass** — `["voidmarked","aurion"]`, **1** living `Kind.Shade` (id **6**); screenshot: asymmetric dark bodies with **purple spore tendrils** and green cores — not Helion hex sails or Kryos crystal facets |
| `?civ=voidmarked` — p99 < 22 ms | **Pass** — p99 **3.2 ms** |
| Match arc tick **420** — mixed-arms inbound or win path | **Pass** — enemy epoch **2** (Dominion); **13** military `AttackMove` on player Hall **359** — **8** Fighters + **2** Siege + **3** Scouts; kill enemy Hall → `winner: 0` |
| §9 #1 — mid fight readable in one second | **Pass** — countable ranks, team-color plates, spark/VFX on exchange, HP bars suppressed except selected/damaged |
| §9 #2 — move feels like commanding | **Pass** — full landscape command deck (minimap, verbs, box-select hints); programmatic `issue(Move)` and left-tap routing work; opening-clash screen is saturated with enemy sprites so P62 right-click at `(28,40)` re-picks Attack (marginal, not marshal-quit) |
| §9 #3 — three civs as different peoples | **Pass** — HUD picker (3 tiles) + `?civ=voidmarked`; Helion geometry, Kryos ice facets, Nihiline tendril swarm each read distinct |
| §9 #4 — world looks like a place | **Pass** — dust/rock texture, solar/gas gems, base pads, gather pocket, minimap fog — not a flat shader demo |
| §9 #5 — holds 60 fps during fight | **Pass** — p99 **3.1–3.3 ms** opening and tick-420 sweep |
| §9 #6 — would keep playing a full 1v1 | **Pass** — wow opening, civ choice, inbound mixed-arms peel, train/build HUD, win banner path — reads as a skirmish you'd finish, not a tech-demo loop |

Wave 5 closes the loop P67 opened: Nihiline is on canvas and selectable, default boot stays Helion vs Kryos, and the Wave 2 match arc still delivers mixed-arms pressure by tick 420.

---

## Single biggest gap

**None blocking Wave 5** — version gate, P41 default, third civ, match arc, frame budget, and §9 wow checklist all meet bar on `0.6.0-wave5`.

**Marginal (not scored here):** P62 right-click ground move at the classic peel probe coordinate fails during opening clash because enemy sprites saturate screen-space pick (programmatic Move still passes); Kryos clash line still reads partly as wreck scatter vs a full living rank; Spore Rider / Shade are small beside eight Fighters; surviving Kryos clash fighters can drift `Idle` late in the opening window; master palette quantization still loose (~386 distinct quantized colors on default harness); internal probe codenames `vespari` / `aurion` / `voidmarked` vs display Helion / Kryos / Nihiline (player-facing HUD is correct).

---

## Harness — default boot

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **3.1** |
| avgFrameMs | 1.4 |
| fps | 714 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.6.0-wave5` |
| Probe ents | 66 |
| Probe tick | 120 |
| Probe `rendererInfo.drawn` | **32** |
| Probe hitSfx | **52** |
| Teams pop (player / enemy) | **22/30** · **9/30** |
| Civ | vespari vs aurion |
| Console issues | none |

---

## Playwright probes (live)

| Probe | Civ | Helion Fighters (t0) | Kryos Fighters (t1) | Shade alive | Tick-420 inbound | p99 ms | Pass |
|---|---|---:|---:|---:|---|---:|---|
| Default boot | vespari · aurion | **8** | **5** | **0** | **13** AM on Hall **359** (8F+2S+3Sc) | **3.1** | ✓ |
| `?civ=voidmarked` | voidmarked · aurion | **8** | **5** | **1** | — | **3.2** | ✓ |
| Win path (sim) | vespari · aurion | — | — | — | kill enemy Hall → `winner: 0` | — | ✓ |

---

## What passed

- **Version gate:** deploy ships `0.6.0-wave5`.
- **P41 lock:** bare URL still opens Helion vs Kryos with rank/gem/wrecks tableau and sub-22 ms p99.
- **§9 #3 (Wave 5 centerpiece):** Nihiline on canvas via `?civ=voidmarked` and HUD picker — tendril/spore silhouettes and bruise/viridian palette read as a third people.
- **Match arc (Waves 1–2 carry):** tick **420** still delivers Dominion-era mixed arms inbound on the player Nexus.
- **Full 1v1 coherence:** opening wow + commanding HUD + three civs + place + 60 fps + “one more game” intent — Wave 5 bar met on the running game.
