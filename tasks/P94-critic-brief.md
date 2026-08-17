You are a FRESH Grok-vision critic for Starhold RTS piece **P94: isometric 3/4 projection**.

Read these with your file-read tool (actual running 0.9.0-iso GPU frames — not the builder report):
1. `/Users/prateekranka/Cowork/spacepixelrts/critic/out/p94.png` — default opening camera
2. `/Users/prateekranka/Cowork/spacepixelrts/critic/out/p94-hall.png` — zoomed on the player Helion hall
3. `/Users/prateekranka/Cowork/spacepixelrts/critic/out/p94-units.png` — zoomed on the Helion fighter rank

Do **not** change game code. Do **not** spawn agents. Do **not** grep notes.md. Do **not** run npm. Do **not** fail for missing mountains (that's P96). Do **not** fail MAG banners (that's P95). Do **not** fail 8-dir unit art (that's Wave B).

Bar: Age of Empires II: DE isometric 3/4 (~2:1). Scope is **projection only**.

PASS if a naive player looking at these frames would say this is an **isometric battlefield** (diamond/oblique ground, buildings as boxes with two visible walls + a roof, units standing upright on the ground) — not a helicopter top-down square map. FAIL = one sentence naming the single biggest remaining projection gap.

Write `tasks/P94-critic.md`. No commit.
