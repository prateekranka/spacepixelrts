# Spacepixel RTS — Design

Working title: **Starhold**. Blind quality bar: *Age of Empires II: Definitive Edition* — battle clarity, command feel, empire presence. Pixel-art, space, original civilizations. Landscape iPad, touch-first, 60 fps.

This file is the content contract. Builders do not invent civs, resources, epochs, or roster. They implement this.

---

## 1. Fantasy

A dying binary star, **Helion-Kryos**, sheared a spiral arm into a belt of frozen worlds and living wrecks. Three peoples claim the belt. None are humans in costume. None reuse Earth history.

The player is a **marshal** of one people. The map is a diamond of dust, rock, vents, and gardens. You harvest, age up, and command armies that must read in silhouette at a glance — the AoE2 test.

---

## 2. Three civilizations

Each civ has: a macro identity, a visual silhouette language, a shared baseline roster, **one unique unit**, **one unique building**, and two passive bonuses. Team color is a magenta key (`#FF00FF`) on sprites; civ identity is shape + secondary palette, never only hue.

### 2.1 Helion Compact — *solar empire, geometry, oath*

- **Macro:** Mid-game spike. Boom economy, then disciplined fighters with reach. Closest AoE2 analog: Spanish + Byzantines (not a copy).
- **Silhouette:** Hard hexes, sails, lances, ring-habitats. Units stand tall. Buildings are stepped ziggurats of brass and glass.
- **Palette (civ):** corona gold `#FFD36A`, flare red `#FF5A3C`, bone `#FFF1D2`, bronze ink `#1A0E08`.
- **Lore:** Ring-dwellers of the dying primary. They farm coronal plasma and treat geometry as law.
- **Bonuses:**
  1. Workers gather **Charge** 20% faster (vents).
  2. Fighters +0.4 attack range from **Dominion** on.
- **Unique unit — Solar Lance** (Dominion). Cavalry analog: fast, ranged beam, fragile vs mass. Role: snipe siege and workers, kite fighters.
- **Unique building — Sunwell** (Dominion). Trickles Charge. Does not attack. High HP. One per Nexus-radius (soft: expensive, not hard-capped in v1).

### 2.2 Kryos Conclave — *ice cathedral, computation, siege*

- **Macro:** Turtle into late splash. Slow, expensive, buildings that refuse to die. Closest analog: Koreans + Teutons.
- **Silhouette:** Faceted crystals, vertical spires, wide bases. Units are squat diamonds with a single bright core.
- **Palette (civ):** ice `#7EE7FF`, indigo `#3A5BFF`, silver `#C9D4E8`, abyss `#061018`.
- **Lore:** Exiles who froze a rogue world's core into a computronium nave. Time is a resource they spend carefully.
- **Bonuses:**
  1. All buildings +20% HP.
  2. Siege projectiles deal 35% splash in a 1.1-tile radius.
- **Unique unit — Glacier Titan** (Dominion). Super-siege: slow, huge, building-melter, tiny vs fighters.
- **Unique building — Cryo Bastion** (Dominion). Static defense. Slows enemies in 3.5 tiles (0.65× speed). Attacks like a tower.

### 2.3 Nihiline — *void mycelium, swarm, map*

- **Macro:** Early map control and cheap mass. Raid, reconstitute, see everything. Closest analog: Goths + Mongols.
- **Silhouette:** Asymmetric, tendrils, spore sacs, no right angles. Units lean. Buildings look grown, not placed.
- **Palette (civ):** spore `#B84CFF`, viridian `#1CFF9A`, bruise `#2A0A28`, pale `#F0E6FF`.
- **Lore:** One mind fruiting through derelict hulls. Drones are organs. The moss is the people.
- **Bonuses:**
  1. Infantry (Fighter + unique) cost −15% Ore and train 15% faster.
  2. Scouts +2 LOS. **Void moss:** explored tiles around Nihiline buildings stay visible (explored, not full vision) in a 2-tile radius.
- **Unique unit — Spore Rider** (Orbit). Fast raider, weak, bonus vs workers. The harass piece.
- **Unique building — Bloom Nest** (Orbit). Every 28s, if pop allows, free Worker at rally. Spreads moss vision.

---

## 3. Economy

Three resources + population. Four-resource AoE2 is the feel; the fourth is **population housing**, not a gatherable. Touch HUD cannot afford four gather counters.

| Resource | AoE2 analog | Source tile | Drop-off | Spends on |
|---|---|---|---|---|
| **Ore** | Wood | Asteroid / dust nodes | Nexus | Buildings, most units |
| **Volatiles** | Gold | Gas vents (cyan) | Nexus | Military, uniques, siege |
| **Charge** | Stone + relics hybrid | Solar vents (gold) | Nexus | Tech, unique buildings, Lances/Titans |

**Worker** gathers 1 unit per 0.55s at a node, carries max 8, returns to nearest completed Nexus. Nodes are entities with HP-as-stock; at 0 they die and the tile reverts to dust.

**Starting resources (1v1 skirmish):** Ore 220, Volatiles 40, Charge 90.

**Population:** Workers and military consume pop. Nexus provides 10. Habitat provides 5. Soft cap 200.

**Costs (baseline):**

| Item | Ore | Vol | Chg | Pop | Train (s) |
|---|---:|---:|---:|---:|---:|
| Worker | 50 | 0 | 0 | 1 | 8 |
| Scout | 40 | 0 | 20 | 1 | 8 |
| Fighter | 60 | 0 | 20 | 1 | 10 |
| Siege | 175 | 80 | 40 | 3 | 22 |
| Solar Lance | 80 | 40 | 60 | 2 | 14 |
| Glacier Titan | 200 | 100 | 80 | 4 | 28 |
| Spore Rider | 45 | 25 | 0 | 1 | 8 |
| Nexus | 275 | 0 | 0 | 0 | build |
| Habitat | 60 | 0 | 0 | 0 | build |
| Yard | 150 | 0 | 0 | 0 | build |
| Foundry | 175 | 0 | 50 | 0 | build |
| Outpost | 125 | 0 | 40 | 0 | build |
| Sunwell | 150 | 0 | 120 | 0 | build |
| Cryo Bastion | 200 | 50 | 100 | 0 | build |
| Bloom Nest | 140 | 40 | 0 | 0 | build |

Build construction: Worker stands adjacent; `progress` 0.15→1.0 at ~0.12/s (≈7s). Building HP scales with progress. Cancel is out of v1.

---

## 4. Epochs (ages)

Four epochs. Aging up is a Nexus research. Only one age-up at a time. Age-up does not pause the Nexus production queue in v1 (simple: Nexus cannot train while aging).

| Epoch | AoE2 analog | Unlock | Cost | Time |
|---|---|---|---|---|
| **Spark** | Dark | Nexus, Habitat, Worker, Scout, Outpost | start | — |
| **Orbit** | Feudal | Yard, Fighter, Spore Rider, Bloom Nest | 400 Ore, 80 Charge | 40s |
| **Dominion** | Castle | Foundry, Siege, civ unique unit+building | 650 Ore, 200 Vol, 150 Charge | 55s |
| **Apex** | Imperial | +1/+1 infantry, Sunwell trickle ×1.5, Titan splash +10% | 900 Ore, 400 Vol, 300 Charge | 70s |

v1 tech tree is **epochs + civ passives + uniques**. No 40-tech grid. Depth comes from civ identity and army composition, not a spreadsheet.

---

## 5. Shared roster and combat

### 5.1 Kinds

```
Worker Scout Fighter Siege
SolarLance GlacierTitan SporeRider
Nexus Habitat Yard Foundry Outpost
Sunwell CryoBastion BloomNest
Resource
```

### 5.2 Combat stats (Spark/Orbit baseline; Apex +1 atk / +10% HP infantry)

| Kind | HP | Atk | Reload | Range | Melee | Speed | LOS | Radius |
|---|---:|---:|---:|---:|---|---:|---:|---:|
| Worker | 40 | 5 | 1.1 | 0.6 | yes | 1.15 | 5 | 0.28 |
| Scout | 45 | 4 | 1.0 | 2.6 | no | 1.85 | 8 | 0.28 |
| Fighter | 80 | 10 | 0.85 | 0.7 | yes | 1.22 | 6 | 0.32 |
| Siege | 120 | 42 | 2.4 | 6.0 | no | 0.52 | 7 | 0.48 |
| Solar Lance | 70 | 14 | 1.05 | 4.2 | no | 1.55 | 7 | 0.34 |
| Glacier Titan | 220 | 55 | 2.8 | 5.2 | no | 0.42 | 6 | 0.62 |
| Spore Rider | 50 | 8 | 0.75 | 0.65 | yes | 1.70 | 6 | 0.30 |
| Nexus | 2400 | 5 | 1.2 | 6 | no | 0 | 8 | 1.35 |
| Habitat | 550 | 0 | — | — | — | 0 | 4 | 0.70 |
| Yard | 1200 | 0 | — | — | — | 0 | 5 | 0.90 |
| Foundry | 1400 | 0 | — | — | — | 0 | 5 | 0.95 |
| Outpost | 850 | 12 | 1.1 | 7 | no | 0 | 9 | 0.70 |
| Sunwell | 900 | 0 | — | — | — | 0 | 5 | 0.85 |
| Cryo Bastion | 1600 | 16 | 1.1 | 7.5 | no | 0 | 9 | 0.95 |
| Bloom Nest | 800 | 0 | — | — | — | 0 | 6 | 0.85 |
| Resource | stock | 0 | — | — | — | 0 | 0 | 0.55 |

**Bonuses:** Siege ×1.8 vs buildings. Spore Rider ×1.6 vs Workers. Glacier Titan ×2.2 vs buildings. Solar Lance ×1.4 vs Siege/Titan.

**Helion fighters** get +0.4 range from Dominion (already in civ bonus). **Kryos buildings** ×1.2 HP. **Kryos siege splash** 1.1 tiles. **Nihiline infantry** cost/train as above.

### 5.3 Orders

`Idle | Move | Attack | AttackMove | Gather | Return | Build | Train | AgeUp`

Auto-acquire: Idle and AttackMove acquire enemies in LOS. Attack sticks to `tid` until dead. Buildings with weapons (Nexus, Outpost, Bastion) auto-fire.

### 5.4 Battle clarity (non-negotiable)

Must match AoE2's "I can read the fight":

1. **Silhouette:** each kind + civ readable at zoom 2 without chrome.
2. **Team color** on a consistent armor plate (magenta key).
3. **HP bars** only on selected, damaged, or units in combat (last 1.2s). Ally green, enemy red, 1px outline.
4. **Selection:** ellipse at feet, not a box through the sprite. Multi-select = one ellipse each + count badge on HUD.
5. **Projectiles** are bright, 1–2 frames of travel readable, impact flash.
6. **Death:** 2-frame dissolve, then corpse stain 1.5s, then gone. No pop-out.
7. **Audio later (P32/P33)** but VFX must sell hits now: muzzle pixel, spark, Kryos ice burst, Helion beam, Nihiline spore puff.

---

## 6. Map and scenario (1v1 skirmish)

- **Map:** 64×64 tiles. Tiles: `Void | Dust | Rock | Ore | Gas | Solar`. Rock blocks pathing.
- **Bases:** Player Spark base at ~(10,10), enemy at ~(53,53). Cleared dust pads 13×13.
- **Nodes:** ~9 ore patches, 6 gas, 5 solar, not inside starting pads.
- **Opening tableau (first frame the critic sees):** not an empty field and **not one overlap pile**. Mid-map, two **facing ranks** (8 vs 8 Fighters plus one unique each) on the **same camera depth (world X)**, split on **world Z** (screen left/right). They **hold `Ord.Attack` in place** and exchange bolts across a gap — they must **not** AttackMove into a single stack. Each sprite is countable (pitch > billboard scale). The same frustum must read as a **place**: varied dust/rock, readable gems, and a scrap of camp (house + workers gathering). This is the "wow or not" shot.

Enemy is a **scripted AI** (P-wave 2): keep 8 workers, train fighters, attack-move the player's Nexus when 6+ military exist. Not a ladder bot. It must look alive.

---

## 7. Camera, input, HUD (feel of ruling)

### 7.1 Camera

Isometric 2:1. Tile diamond **64×32 px** at zoom 1. Integer zoom **2, 3, 4** (iPad landscape defaults to 3). Camera pan is world x/z; renderer projects. **Pixel-snap** the camera to the current zoom so sprites never swim.

### 7.2 Touch (landscape iPad)

| Gesture | Meaning |
|---|---|
| Tap unit | Select (replace). Tap empty: deselect |
| Tap with selection on empty ground | Move |
| Tap with selection on enemy | Attack |
| One-finger drag from empty | Box select |
| Two-finger drag | Pan |
| Pinch | Zoom to nearest integer step |
| Long-press empty (≥350ms) | Attack-move flag |
| Double-tap unit | Follow until pan |
| Tap minimap | Jump camera |
| Command bar buttons | Train / build / epoch / stance |

Hit targets ≥ 44×44 CSS px. No 8px icons.

### 7.3 Pointer (desktop critic / Playwright)

Left: select / box. Right: move or attack. Shift: add to selection. Wheel: zoom. WASD / arrows: pan. Space: jump to selection.

### 7.4 HUD (AoE2 grammar, space skin)

- **Top-left:** Ore / Volatiles / Charge / Pop (current/cap). Big numerals.
- **Bottom:** command bar. Portrait of primary selected + verbs as large tiles.
- **Bottom-right:** minimap 160×160 CSS px, fog, resource blips, viewport rectangle.
- **Idle villager** pulse on Worker icon when any Worker is Idle (empire feel).
- No hamburger menus. No settings gear on the combat canvas.

---

## 8. Win / lose

Destroy enemy Nexus (all of them). Defeat banner, not a blank pause. v1 is 1v1 skirmish only.

---

## 9. What "wowed vs AoE2:DE" means

A fresh critic, looking at the **running game** (not the code), should say:

1. I can tell who is winning the mid fight in one second.
2. Issuing a move feels like commanding, not dragging sprites.
3. The three civs are different peoples, not recolors.
4. The world looks like a place (dust, vents, bases, fog), not a shadertoy.
5. It holds 60 fps on the test canvas while the fight is on.
6. I would keep playing — not "impressive tech demo."

If any of those fail, the piece is not done. Name the **single biggest gap** and send the builder back.
