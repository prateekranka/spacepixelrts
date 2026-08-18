# P99 — Helion worker, option 5 base (Habitat Builder)

Locked by the user 2026-08-18. Helion only. Kryos/Nihiline worker art stays as-is.

## Gameplay reference

YouTube: https://youtu.be/ZBdAe3ZwKds (Emergent Garden — *AI plays Age of Empires II*).
Tweet: https://x.com/max_romana/status/2088664924683735139

Steal **villager language**, not the medieval costumes:

- One human laborer body.
- Idle / walk with **empty hands**.
- **Build** = hammer / mallet at a structure.
- **Gather food** = carry a crate/basket of produce.
- **Gather crystals/ore** = carry crystals or a hex crate of star-ore.
- **Attack** (rare) = same body, tool raised as a weapon.
- A naive player names it “villager / worker” at a glance, never soldier or mage.

## Locked body (option 5)

Reference sheet (turnaround + action insets):

`references/helion-worker-option5.png`

- Stocky bearded human.
- Lime hard-hat + mint MAG lamp (team color). One emissive. Not a combat visor.
- Tan/khaki rolled-sleeve work shirt, charcoal trousers, brown pouch belt.
- Lime hex docking-collar **bracers**. Mag-boots.
- Idle turnaround: **empty open hands**.
- Helion lime/geometry. Palette on the sheet.

## Pipeline already in (keep)

- 8-dir strip, 32×48 cells. Authored dirs 0=E, 1=NE, 2=N, 6=S, 7=SE. Mirrors 3←1, 4←0, 5←7 via `Pix.flipX()`.
- `dir8` in `src/engine.ts` uses `atan2(-vz, vx)` (+Z is south under the iso camera).
- Living workers: `e.facing` 0–7, `scaleX=1.55`, `scaleY=2.32`, no facing flip.
- Shader `src/sprite-sdf.ts`: `kind < 0.5 && frame < 3.5` samples worker8 (`uWorker8Y`, `uWorker8H`).
- Atlas width 512 → **16 cols of 32px**. Idle+walk already fill that. Extra **actions must be extra rows**, not extra columns.
- MAG `#FF00FF` on the hat lamp only. Shader replaces with team RGB. Helion team 0 is mint.

## Required states (Helion row-group)

| State | When | Held |
| Idle | standing | nothing |
| Walk | moving | nothing (arm swing) |
| Build | `Ord.Build` | mallet at hex tiles |
| Gather food | `Ord.Gather`/`Return` of food/solar-style cargo | produce crate |
| Gather crystals | `Ord.Gather`/`Return` of ore/crystal | crystals or hex ore crate |
| Attack | `Ord.Attack` as worker | mallet raised |

`frameFor` in `src/render.ts` currently only idle/walk for workers. Wire order + cargoType to the action row. Corpses still use old 32px frames 4–6.

## Pass bar (blind critic)

A fresh `cursor-grok-4.6-xhigh` looking at live screenshots + 6× nearest cells:

1. Names it a **worker / villager**, not a soldier, mage, or crate-golem.
2. Idle/walk hands are empty; hat is a hard-hat with a lamp.
3. Build / gather-food / gather-crystal / attack are the **same person** with a different load or tool.
4. South + east cells read at RTS zoom (`p98-helion-close.png` equivalent).

## Out of scope

Kryos/Nihiline workers, other unit roles, buildings, combat formulas, iso camera, MAG-on-buildings, Flowdeck, deploy unless the orchestrator explicitly deploys.
