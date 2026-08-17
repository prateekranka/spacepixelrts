# P93 — Critic verdict (full character roster)

**Critic:** fresh Grok-vision · **Bar:** AoE2:DE — a naive player names ROLE from silhouette (person/vehicle + weapon + facing) · **Judged:** 2026-08-17

**Screenshots reviewed (running 0.8.2-art GPU, not the builder report):**
- `critic/out/p93-rank-crop3x.png` — opening Helion rank, 3× nearest (primary unit check), 1080×900
- `critic/out/p93-orch.png` — default opening camera, 1180×820
- `critic/out/p93-atlas-live.png` — live sprite atlas, 512×576 (16×32 cells; 7 roles × 3 civs × 7 frames)

**Scope:** living units only (atlas frames 0–3 per role). Frames 4–6 are corpse/dissolve orbs — out of scope. The gold mid-map gem is an `atlas.ts` resource node, not a unit — not scored.

---

## P93 — **PASS**

Helion fighters in the 3× rank crop are rifle infantry: helmet, torso, two legs on the dirt, a long gray barrel off the shoulder, muzzle flash at the tip. They are not marbles. The live atlas shows worker / scout / fighter / siege / ravager / prism / shade as seven connected forms, each with a dominant tool or weapon and a readable facing. No living cell is a tiny orb or an unarmed floating diamond.

| Criterion | Result |
|---|---|
| 1. Helion fighters read as rifle infantry (not marbles) | **Pass** — 3× rank crop: biped + horizontal rifle + yellow-white muzzle cluster, facing upper-right. Atlas Helion fighter cell (slot 42, 32×32): opaque **383** px, bbox **24×29**; barrel scanline y=7 is **16** consecutive gun-gray pixels (`#5a606e` / `#969caa`) from receiver through muzzle to x=31, white tip `#f4eee2`. Two legs reach y=30. Opening camera still shows the same green rank firing; the gold diamond among them is the mid gem, not a unit. |
| 2. Worker — connected person + tool | **Pass** — hunched biped, head/torso/two feet, crate (Helion/Kryos) or drill (Nihiline f1) glued to the right. Helion f0: **520** opaque px, bbox **27×30**; ore-crate band **100** gold px (`#c69a48`) in three stacked bars, not a floating disc. |
| 3. Scout — connected vehicle + tool + facing | **Pass** — low hull on the ground (y=18–29), sensor dish/mast on the left (140 opaque px in y≤16), exhaust stack on the right (`#f0c448`). Bbox **30×26**, **480** px. Reads as a light vehicle facing left (dish = front). Not an orb. |
| 4. Siege — connected vehicle + cannon | **Pass** — tread base + turret + raised barrel to a white muzzle. Bbox **31×24**, **511** px, **224** gun-gray px. Longest weapon in the sheet. |
| 5. Ravager — connected person + melee weapon | **Pass** — biped with a head visor and two bone/steel scythes from the shoulders to both cell edges. Bbox **32×28**, **518** px. Brute silhouette, not a marble. |
| 6. Prism — connected form + dominant weapon (not an unarmed diamond) | **Pass** — faceted cyan body with a focus lens and a beam to x=31 (white tip `#f4eee2`), plus two stabilizer pods on stems. Bbox **26×22**, **396** px, **171** ice-white/cyan px. Armed gunship/crystal, not an unarmed floater. |
| 7. Shade — connected person + blade | **Pass** — hooded biped, feet on y=30, dagger as a 10×3 gun-gray bar with a bone tip at x=28–30. Bbox **23×29**, **409** px, **30** gun-gray px. Short weapon vs the fighter’s rifle — still a tool on a body. |
| 8. Not tiny orbs / not unarmed floating diamonds (living cells) | **Pass** — living fill is **37–51%** of a 32×32 cell (383–520 px). Corpse frame 4 is the orb: **197** px, **17×17**, mean radius **5.3** — those slots are death frames, not the roster. |

---

## Single biggest gap

**None blocking P93.** Living roles are countable silhouettes with a tool or gun.

**Marginal (not scored here):** the atlas still parks three corpse/dissolve frames after every living cycle; those 17×17 orbs will show if a critic samples the whole sheet without splitting frames 0–3. Prism is the most crystal-like body, but the beam and pods keep it off the “unarmed diamond” fail. Scout faces opposite the combat line (dish-left vs rifle-right). At default opening zoom, fighters shrink; the 3× rank crop is the check, and it holds.

---

## Pixel notes

### Live atlas packing (512×576)

`kind * 3 * 7 + civ * 7 + frame` into 16 columns of 32 px. Living = frames 0–3. Buildings start at y=320 and are out of scope.

| Role (Helion f0) | Opaque | Bbox | Dominant kit |
|---|---|---|---|
| worker | 520 (50.8%) | 27×30 | ore crate 100 px |
| scout | 480 (46.9%) | 30×26 | dish/mast + exhaust |
| fighter | 383 (37.4%) | 24×29 | rifle 58 gun-gray px, 16-px barrel run |
| siege | 511 (49.9%) | 31×24 | cannon 224 gun-gray px |
| ravager | 518 (50.6%) | 32×28 | paired scythes to both edges |
| prism | 396 (38.7%) | 26×22 | lens + beam, 171 ice px |
| shade | 409 (39.9%) | 23×29 | dagger 30 gun-gray px |
| corpse f4 (out of scope) | 197 (19.2%) | 17×17 | orb |

### Rank crop (3×, 1080×900)

| Metric | Value |
|---|---|
| Dust | `#635569` / `#63566a` (luma ~89), majority of frame |
| Helion plate / shade | `#64ca1e` **12 960** px · `#07320b` **23 193** px (GPU-shifted hive; same lime also sits on hall gables — unit read is the biped+rifle silhouette, not the lime count alone) |
| Mid gem (not a unit) | `#deab30` **16 722** px, diamond with white glint |
| Pads / crates | `#905211` **30 906** px |
| Unique colors | **111** |

Opening camera (1180×820) still shows the green rank as bipeds with muzzle sparks around the gold gem. That gem stays a resource node.
