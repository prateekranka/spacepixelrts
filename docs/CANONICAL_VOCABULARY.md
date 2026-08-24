# Starhaven Canonical Vocabulary

Status: **ACTIVE / FROZEN** — frozen by Sol's direction on 2026-08-21. Labels and stable IDs below
may not be redesigned. New player-facing text, code identifiers, URLs, probe keys, config keys,
and save fields use the stable IDs in this table. Legacy IDs stay private until a separate,
dedicated data migration lands.

## Concepts, labels, stable IDs, legacy adapters

| Concept | Player-facing label | Stable ID | Temporary legacy adapter (private) |
| --- | --- | --- | --- |
| Game | Starhaven | `starhaven` | repo/dir name `spacepixelrts` remains historical |
| Faction 1 | Sunweaver | `sunweaver` | adapts to legacy `vespari` (Helion Compact) until data migration |
| Faction 2 | Gravemark | `gravemark` | adapts to legacy `aurion` (Kryos Conclave) until data migration |
| Hidden faction | — (not shown) | `voidmarked` (legacy ID retained privately) | legacy `voidmarked` / Nihiline is hidden and deferred, **not deleted** |
| First Playable map | Helios Rift | `helios-rift` | none yet |
| Shared objective | Central Lumen Field | `central-lumen-field` | no legacy public label; implementation may reuse existing Lumen/energy resource primitives |
| Objective structure | Core | `core` | may adapt internally to legacy Hall / Nexus kinds |
| Progression | technology paths | `tech-path` | replaces internal `epoch` / `ageT` presentation; sim field rename deferred |

## Technology paths (one irreversible choice between TWO paths per faction)

| Faction | Path label | Stable ID |
| --- | --- | --- |
| Sunweaver | Solar Ascendancy | `solar-ascendancy` |
| Sunweaver | Sky Dominion | `sky-dominion` |
| Gravemark | Iron Colossus | `iron-colossus` |
| Gravemark | Rift Engineering | `rift-engineering` |

Each faction offers exactly one irreversible choice between these two paths. There is no single
linear ladder and there are no ages or epochs in player-facing text.

## Banned / deprecated public terms

These terms must not appear in any player-facing surface (menu, HUD, tutorial copy, results,
URLs, marketing). Historical filenames and git history keep them and are **not** bulk-renamed.

- Starhold
- Sunfold
- Sunwoven
- Helion Compact
- Kryos Conclave
- Nihiline (faction is hidden/deferred entirely)
- "ages", "epochs", "age up", "epoch" (progression language)

## Migration rule

1. Everything new — UI strings, DOM ids, URL params, probe/QA keys, config fields, save fields —
   uses canonical stable IDs from this table.
2. Legacy IDs (`vespari`, `aurion`, `voidmarked`, Hall/Nexus internals, `epoch`/`ageT`) remain in
   place privately behind adapters until a dedicated data migration commit series removes them.
3. Adapters translate at the boundary only (e.g. `sunweaver -> 'vespari'` when calling into sim
   code); they never leak legacy labels into rendered text.
