# M5 — Four-unit compact army (frozen contract)

Source: `docs/FIRST_PLAYABLE.md` §M5 + Sol max design memo (`tasks/SOL-m5-prep.log`,
2026-08-23), accepted by lead. Roster names are frozen; internal Kind reuse is total —
no new Kinds, no new mechanics beyond one modifier reassignment.

## Frozen mapping (roster name → internal Kind)

| Faction | Roster name | Kind | Role anchor |
|---|---|---|---|
| Sunweaver | Worker | `Worker` | economy |
| Sunweaver | Wind Strider | `Scout` | recon/harrier |
| Sunweaver | Lumen Guard | `Fighter` | line anchor |
| Sunweaver | Solar Strider | `Ravager` | shock/finisher |
| Gravemark | Worker | `Worker` | economy |
| Gravemark | Grav-Skimmer | `Scout` | recon/harrier |
| Gravemark | Rift Guard | `Fighter` | line anchor |
| Gravemark | Burden Walker | `Prism` | siege/artillery |

Host gaps: none. `Siege`(Breaker) and `Shade`(Spore Rider) lose their M5 slots:
IDs stay for save/compat, but they leave production, scripted spawns, and AI choices.

## Stat freeze (unlisted fields unchanged)

- `Scout`: HP 32→40 · atk 3→5 · energy 10→15. Keep spd 3.15, LOS 9.5, train 6, pop 1.
- `Fighter`: HP 78→96 · spd 2.05→1.85 · ore 60→70 · train 9→10 · pop 1→2.
- `Ravager`: atk 13→15 · cost 75/30/10→90 ore/35 gas/20 chg · train 12→16.
- `Prism`: HP 150→165 · spd 1.15→0.95 · atk 20→24 · range 5.6→6.2 · LOS 6.5→7 ·
  radius 0.40→0.48 · train 18→20 · pop 2→3. Cost unchanged 110/45/30.
- Building-damage modifier ×1.8 moves from `Siege` to `Prism`.

Balance note (Sol smoke): 10-pop mixed force ≈ equal contact power across factions
(~8 s mutual defeat window) — accept, revisit only with play evidence.

## Presentation changes

- `fighterName(civ)` → Lumen Guard / Rift Guard.
- `labelOf(Scout)` faction-aware → Wind Strider / Grav-Skimmer.
- Ravager label → Solar Strider; Prism label → Burden Walker.
- HUD: remove Breaker training button; Scout labels via `labelOf`.
- Tech copy: "Scouts"→"Wind Striders"; "Breakers train 30% faster"→
  "Burden Walkers train 30% faster". Scope `siegeTrainMul` to Prism only.
- Guidance/start-screen: no bare "Scout" copy — faction label or "recon unit".
- Enforce four-Kind roster in `tryTrain` and AI logic, not just HUD visibility.

## Definition of done

Rosters exact in UI and sim gates; labels match this table everywhere player-visible;
all suites green; `qa:m5` headless proof: trains one of each unit per faction,
labels correct, Breaker/Spore Rider untrainable, zero console errors.
