You are the P90-v3 builder for Starhold RTS. We have solved the hard problem: units CAN be
drawn as connected, lit, weapon-carrying pixel-art characters procedurally. Your job is to
(a) finish the reference technique's last flaws, then (b) reproduce it across the full roster.

READ FIRST (in order):
1. src/art-reference.ts   — THE gold standard. It shows the exact technique:
   - draw a dark INK silhouette of the WHOLE connected form first (head+neck+torso+pelvis+legs,
     weapon) so nothing floats.
   - then fill lit/shadow with a top-left key light (3 tones: Hi on upper-left, Mid, Dk on lower-right).
   - a DOMINANT weapon/tool held by hands (skin-tone grip pixels touching the weapon).
   - buildings = roof (wide at eaves, narrow at peak) + wall plane + a door (short dark INSET
     rectangle at bottom-center, on the ground) + 1px lit window slots.
2. Playwright screenshot at http://localhost:5173/reference.html shows the current state (the
   reference.ts impl). Look at it yourself (run `npm run dev`, browser, screenshot).

STEP 1 — fix the last 3 flaws the critic named (in src/art-reference.ts):
  a. Fighter: add the FRONT forearm — a visible arm from the shoulder down to the trigger,
     ending in a skin hand ON the barrel (no gap). Also make the rifle silhouette change at
     the stock and muzzle (not a uniform 3-row pipe): stock flairs slightly, muzzle has a
     small brake bump.
  b. Worker: add WEIGHT — hunch the torso 1px (drop head/shoulders), let the crate overlap
     the thighs so it reads as load on the body, not a floating box.
  c. Hall: fix the DOOR — a short, wider-than-tall dark rectangle SET INTO the bottom-center
     wall (on the ground plane), not a full-height left slit.

STEP 2 — reproduce this EXACT technique for the full roster, into src/sprite-sdf.ts (or a new
  src/sprites.ts that render.ts can use). Every sprite = INK silhouette-first + 3-tone top-left
  light + one dominant weapon/tool + connected anatomy. Roster:
  Units (3 civs: vespari=hive organic, aurion=angular crystal, nihiline=tattered void; but
        SHAPE is the same connected-body technique, only palette/motif changes):
    - worker (crate/drill, 2 hands), scout (low hull + big sensor dish + exhaust), fighter
      (rifle, arms gripping), siege (tread base + raised cannon), ravager (scythe claws),
      prism (floating crystal + focus lens), shade (cloak + one glowing eye).
  Buildings (3 civs): hall (roof+door+windows+spire), house (roof+door), barracks (gate+banner),
    unique (civ signature: spore nursery / refraction spire / umbra relay) — all with roof+walls+door+windows lit top-left.

VERIFY by LOOKING, not by code: after each major sprite, screenshot and check against the
critic's bar (naive player names ROLES by silhouette, sees facing, sees light, sees connected
feet-to-ground). Fix what still looks like a flat block.

Constraints: procedural only (no textures/disk assets). Keep the 60fps budget (these are
startup-generated sprites → texture/instances, not per-frame). Keep team-color mechanism
(paintMag equivalent) and animation frame branches working.

Commit: "P90-v3: full roster of connected lit pixel-art characters (validated technique)".
Report to tasks/P90.md the final roster and any sprite you're still unsure reads correctly.
Do not skimp — draw EVERY unit and building to the reference standard, not just the examples.
