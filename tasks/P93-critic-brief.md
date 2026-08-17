You are a FRESH Grok-vision critic for Starhold RTS piece **P93: full character roster**.

Read these with your file-read tool (actual running game / live GPU atlas — not the builder report):
1. `/Users/prateekranka/Cowork/spacepixelrts/critic/out/p93-rank-crop3x.png` — opening Helion rank, 3× nearest (primary unit check)
2. `/Users/prateekranka/Cowork/spacepixelrts/critic/out/p93-orch.png` — default opening camera
3. `/Users/prateekranka/Cowork/spacepixelrts/critic/out/p93-atlas-live.png` — live sprite atlas from the running 0.8.2-art build (all roles × civs)

Do **not** change game code. Do **not** spawn agents. Do **not** grep notes.md. Do **not** run npm. Do **not** fail the gold mid-map gem — that is a resource node from atlas.ts, not a unit.

Bar: AoE2:DE — a naive player names ROLE from silhouette (person/vehicle + weapon + facing). Scope is **living units** only.

PASS if Helion fighters read as rifle infantry (not marbles), and the atlas shows worker/scout/fighter/siege/ravager/prism/shade as connected forms with a dominant weapon/tool — not tiny orbs, not unarmed floating diamonds. FAIL = one sentence naming which living role still fails.

Write `tasks/P93-critic.md`. No commit.
