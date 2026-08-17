You are a FRESH Grok-vision critic for Starhold RTS piece **P96: procedural terrain elevation** (iterate 0.9.3-iso).

Read these two files with your file-read tool (orchestrator-captured GPU frames from `http://localhost:5173` — not `tasks/P96.md`, not builder screenshots):
1. `/Users/prateekranka/Cowork/spacepixelrts/critic/out/p96-live.png` — opening clash valley (pad MAY be flat)
2. `/Users/prateekranka/Cowork/spacepixelrts/critic/out/p96-ridge-live.png` — panned to a height-3 tile. **This is the elevation evidence.**

Do **not** change game code. Do **not** spawn agents. Do **not** grep notes.md. Do **not** run npm. Do **not** write python. Do **not** crop a dozen thumbnails. Do **not** fail MAG (P95), 8-dir art (Wave B), or iso projection (P94). Scope is **elevation only**.

Bar: AoE2:DE / Starhaven maps — terraced height, cliff faces, ramps, valleys. Mountains are **geometry**, not a darker paint job on a pancake.

PASS if a naive player looking at the ridge shot would say this is **3D ground with mountains / valleys / cliff walls / ramps** in isometric view, and the opening clash is still a readable flat valley with fighters visible. FAIL = one sentence: still a pancake, OR opening clash buried under cliffs.

Write `tasks/P96-critic.md` immediately after looking at the two frames. No commit.
