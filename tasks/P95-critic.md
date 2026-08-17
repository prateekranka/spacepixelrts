# P95 — Critic verdict (emissive team color)

**Critic:** fresh Grok-vision · **Bar:** AoE2:DE team color — one small emissive accent (lamp / visor / engine), not a painted flag · **Judged:** 2026-08-17

**Screenshots reviewed (running 0.9.1-iso GPU frames, not the builder report):**
- `critic/out/p95.png` — default opening camera, 1180×820
- `critic/out/p95-hall.png` — zoomed on the player Helion hall, 1180×820
- `critic/out/p95-units.png` — zoomed on the Helion fighter rank, 1180×820

**Scope:** MAG team-color language only. Lime/forest gables are Helion civ plate (P94). Ice windows stay civ. Mountains (P96), 8-dir unit art (Wave B), and isometric projection (P94 **PASS**) are not scored.

---

## P95 — **PASS**

No loud magenta/pink facade banner on any building. Hall walls are ink and dust with ice window slots; the team mark is a mint `#3dc76b` spire orb sitting on the lime roof peak. Houses and barracks repeat that as a porch / gate lamp. Helion fighters wear a mint visor slit under the lime helmet. Opening camera still names sides: mint visors on the Helion rank, small `#eb5247` lamps on the opposite (cyan) cluster.

| Criterion | Result |
|---|---|
| 1. No loud magenta / pink facade banner on buildings | **Pass** — full-frame hot-MAG (`R+B` high, `G` low, including `#ff00ff`) and HSV pink band (hue 280–340, s≥0.40, v≥0.35) are **0** on all three PNGs, UI included. Player-hall walls (520–700, 250–400): **0** saturated pixels that are not lime, forest, ice, or mint. Right wall is `#16111b` + `#55495f` + `#a4c6ff` windows. No 4×2 sticker on the face. |
| 2. Team identity is a small glow (visor / lamp / orb) | **Pass** — hall zoom, player hall: mint `#3dc76b` **40** px as a **4×8** peak orb (y=220–227, x=585–594) nested into the `#64ca1e` diamond — not a wall flag. House porch: **10×5** mint (561,452). Barracks gate: **10×6** mint (906,390). Units zoom: ten mint visor islands, **7–11×4–6** (e.g. (648,145) **8×5** under the lime helm). Opening rank visors are **6×3**. |
| 3. Naive player can name sides from the glow | **Pass** — opening Helion rank: three **6×3** mint visors at (750,221), (780,235), (810,248). Opposite cluster: four `#eb5247` lamps (**6×3** to **9×10**) on cyan hulls. Hall zoom is one team (mint lamps on every Helion box). Units zoom is the same mint visor on every Helion fighter. |

---

## Single biggest gap

**None blocking P95.** Magenta stickers are gone; team color is a lamp.

**Marginal (not scored here):** at default opening zoom the hall’s 3 px spire is lost inside the **34×16** lime diamond — **0** mint in (820–880, 185–230). Building lamps still read on the nearer houses (**4–6** px mint at y=308–353). Lime gables remain the loud Helion civ read; MAG is the mint slit, not those roofs. Ice `#a4c6ff` windows are civ, not team. Mountains, 8-dir art, and projection are later / already passed.

---

## Pixel notes

Playfield sample: x 180–1160, y 70–640 (980×570).

### Magenta hunt (full 1180×820)

| Frame | hot MAG | HSV pink (280–340, s≥0.40, v≥0.35) |
|---|---|---|
| `p95.png` | **0** | **0** |
| `p95-hall.png` | **0** | **0** |
| `p95-units.png` | **0** | **0** |

### Hall zoom — mint `#3dc76b` lamps (323 px total)

| Site | n | Bbox | Read |
|---|---|---|---|
| Player hall spire | 40 | 10×8 at (585,220) | orb on roof peak |
| Left building lamp | 102 | two steps: 11×6 + 6×6 at (209,381) | gate / porch, not a wall banner |
| Barracks gate | 60 | 10×6 at (906,390) | lamp above grade |
| House porch | 50 | 10×5 at (561,452) | lantern beside the box |
| Small-roof nest | 50 | 10×5 at (189,557) | mint sitting in lime, same language as the hall peak |
| Bottom clip | 21 | 6×7 at (763,624) | lamp, playfield edge |

Hall-peak scan (x 575–605, y 215–235): mint is a 4-px-wide column **above** the lime, then two mint inserts in the first lime rows — a jewel on the gable, not a painted face.

Player-hall crop (400–750, 180–420): **14** unique colors. Mint = **40** px. Ice windows `#a4c6ff` = **840**. No leftover MAG rectangle.

### Units zoom — Helion visor slits

| Cluster | n | Bbox |
|---|---|---|
| (482,179) | 66 | 11×6 |
| (618,240) | 66 | 11×6 |
| (425,265) | 66 | 11×6 |
| (648,145) | 40 | 8×5 |
| (580,276) | 40 | 8×5 |
| (738,105) / (554,142) / (558,186) | 32 | 8×4 to 8×8 |
| (468,226) / (671,236) | 28 | 7×4 |

Fighter at (648,145): lime helm on y=140–144, mint visor **8×5** on y=145–149, dark under. Civ plate stays lime/forest; MAG is the slit.

### Opening camera — sides

Helion mint: **168** px in 13 islands, all **4–6** px wide. Rank visors **6×3**. House-scale lamps **4×3** to **5×3** (e.g. (541,351), (569,308)).

Opposite side `#eb5247`: **87** px in four lamps at (319,414) **6×3**, (349,428) **6×2**, (380,441) **5×3**, (421,421) **9×10**. Cyan `#7dcaff` / `#a4e7ff` is Kryos civ hull, not a MAG banner.

Hall lime diamond still **34×16** (w/h **2.12**) at (833,197) — same iso box as P94; only the MAG placement changed.
