# Sunweaver Town Center — Structural Rebuild Contract v01

Status: **geometry-only rebuild**. Materials and effects are blocked.
Canonical civilization name: **Sunweaver**.
Current procedural asset status: `SunweaverTownCenter_Blockout_v00`.

## Authority order

1. `references/Sunweaver_TownCenter_Reference_v01/00_spec.json`
2. isolated approved reference images in that directory
3. this structural contract
4. issue ledger from Sol

Candidate renders, prior critic sheets, and `SunweaverTownCenter_Blockout_v00` are not references.

## Structural grammar

- one south-facing entrance axis;
- circular seven-tile footprint;
- four primary cardinal wing modules;
- four secondary diagonal buttress modules;
- one central crown;
- exactly four primary side towers;
- one central crystal volume and four cage arches;
- three main architectural levels;
- four additive construction stages.

## Normalized dimensions

These values are frozen for v01. All dimensions are fractions of footprint diameter.

| Parameter | Value |
|---|---:|
| footprint diameter | 1.00 |
| lower drum height | 0.20 |
| upper drum height | 0.18 |
| crown height | 0.34 |
| entrance projection | 0.13 |
| side tower radius | 0.09 |
| primary wing outer reach | 0.48 |
| secondary buttress outer reach | 0.45 |
| entrance width | 0.22 |
| central crown radius | 0.16 |

## Required module hierarchy

```text
SunweaverTownCenter_Structural_v01
├── foundation_disc
├── lower_drum
├── upper_drum
├── entrance_bay
├── primary_wing_source
│   └── repeated ×4
├── secondary_buttress_source
│   └── repeated ×4
├── side_crystal_tower_source
│   └── repeated ×4
├── central_crystal
├── crystal_cage_arch_source
│   └── repeated ×4
├── banner_mount_source
│   └── repeated ×4
├── stage_2_crown
├── stage_3_crown
└── stage_4_crown
```

Every repeated element uses one source module. Do not independently invent repeated copies.

## Clay pass rules

- one neutral clay material;
- no faction colors;
- no emissive effects;
- no cloth banners;
- no foliage;
- no decorative crystals except the central crown volume used for silhouette;
- no flattering glow or material contrast;
- all fixed QA cameras use identical exposure, focal length, background, and ground plane.

## Construction stages

- Stage 1: foundation disc, entrance-axis marker, central socket.
- Stage 2: lower drum, entrance bay, four primary wing bases.
- Stage 3: upper drum, four side towers, four secondary buttresses, cage base.
- Stage 4: full crown height and central crystal silhouette.

The origin, footprint, entrance axis, and persistent modules do not move between stages.

## Geometry acceptance gates

- top-view radial symmetry error: `< 3%`;
- entrance-axis deviation: `< 1°`;
- footprint diameter deviation: `< 5%`;
- aligned main silhouette overlap against admitted references: `> 88%` where the reference mask is reliable;
- exactly one entrance projection;
- exactly four primary side towers;
- no rear stair;
- no disconnected visible geometry;
- no unexpected entrance/crown intersections;
- clean front/right/back/left/top turntable coverage;
- browser console errors: `0`;
- p99 frame time: `< 8 ms` in the existing probe.

## Review separation

Luna A receives the reference pack, this spec, issue IDs, and source files.
Luna B receives only reference contact sheets, fixed candidate QA sheets, and the rubric. It does not receive code, implementation prompts, timing, polygon counts, or builder prose.

## Material lock

The material pass is blocked until Sol records a blind geometry PASS. The future palette is:

- ivory stone `#F0E0B6`;
- gold/brass `#D9B26E`;
- sage landscaping `#7AB591`;
- navy cloth `#1E3A6D`;
- cyan energy `#36C9FF`.

These colors are documented only. They are not used in the clay rebuild.
