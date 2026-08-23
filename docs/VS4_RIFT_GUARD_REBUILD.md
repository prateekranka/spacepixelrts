# VS-4A — Rift Guard Sprite Architecture Rebuild

Status: **ACTIVE / FROZEN**. Parent: `docs/VS1_COMBAT_ASSETS.md`.

## Why this is a rebuild, not R4 tuning

Three normal-scale rounds failed the same object after scale, material, rim, and contrast contracts
all passed. R3 already gives the Rift Guard 1.67×1.92 world scale, 100% two-layer ice/sky rim, and
>=3:1 source luma contrast. Fresh Sol still reads it as a cabinet.

Root cause: `drawRiftGuardCombat` composes a 40px tower shield, narrow torso, and nearly vertical
spear into one continuous vertical column. The source abstraction has no independent anatomical
read. More scale/tint cannot create anatomy.

Replace only Rift Guard row 2's authored core layout. Keep combat atlas, shader, world scale, rim,
palette, facing, animation, draw calls, and all other units unchanged.

## Exact row-2 anatomy contract

All coordinates describe the pre-rim 64×64 authored core. Mirrored directions remain derived after
rim.

### Humanoid body

- Head/hood outer bound: exactly 12×12px, top at y=16, visually separate from shield and weapon.
  Use ink outer, slate/steel planes, and a 6px ice visor inside.
- Torso outer bound: at least 18px wide and 16px high, x≈27..44, y≈27..43. Broad steel/slate chest
  planes must remain visible beside the shield.
- Legs: two independent 6px-wide bounds, y≈42..51, with a transparent 3–4px gap from y45 down.
  Each leg has a separate foot and pose-1 alternation. No solid skirt/bar joining both legs.
- Head, torso, and both legs are connected by neck/hips but remain separate silhouette masses.

### Shield

- Rectangular stepped tower shield stays on the camera-near side, about 16×29px, x≈9..25,
  y≈20..48. It must not overlap the head or cover the torso center.
- Three slate/steel planes, bone-gold clamps, one small ice/MAG focus.
- A 2–3px arm/brace connects shield to torso. No round shield.

### Weapon

- Opposite-side diagonal crystal polearm, not vertical.
- Connected line from grip near (44,32) to tip near (61,4): >=32px Euclidean length.
- Tip projects >=16px horizontally beyond the torso edge and reaches x>=60.
- Shaft is 2–3px thick steel/ice. Spearhead is 8–10px, visibly outside head/shield.
- Every authored facing retains a diagonal (absolute screen slope between 0.8 and 2.0); front/back
  may compress but cannot become vertical.

### Existing locked contracts

- `applyCombatExteriorRim` unchanged: two exterior layers, ice outer/sky inner.
- World scale unchanged: 1.67×1.92.
- Cell 64, row 2, two poses, 8 facings, exact mirror derivation unchanged.
- Source average luma >=90, alpha/connectivity/MAG/direction/pose/IoU/source-height gates unchanged.
- Rows 0, 1, 3 byte-identical to R3.
- One instanced combat draw; runtime MAG zero; sim share <8ms software policy.

## RED tests before source change

Add tests on row 2 authored core geometry (ignore exterior rim pixels):

1. 12×12 head occupancy in the locked head region;
2. torso alpha width >=18 and height >=16 in x26..45/y27..43;
3. each 6px leg region has alpha, center gap x33..36/y45..51 is transparent core;
4. diagonal weapon core contains a connected path from grip region x41..46/y29..35 to tip
   x>=60/y<=6, length>=32, horizontal projection>=16, slope 0.8–2.0;
5. shield core is in x8..26/y19..49 and does not occupy head center x29..40/y16..27;
6. rows 0/1/3 sprite hashes remain R3 baselines.

The unchanged R3 row must fail the anatomy assertions before source edits. Save RED.

## Evidence and acceptance

Export the same 1366×1024 no-UI lineup and battle frame with no camera/position change. Fresh Sol gets
the identical blind prompt. PASS requires both infantry to read as armed guards and both walkers to
remain distinct. No crop/contact-sheet result can override a normal-scale FAIL.
