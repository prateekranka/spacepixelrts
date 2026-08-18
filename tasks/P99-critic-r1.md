# P99 blind visual critique — round 1

You are the fresh blind visual critic. Judge only the supplied runtime screenshots and nearest-neighbor atlas-cell crops. Do not inspect source code, implementation history, builder logs, task briefs, or prior critiques.

Use your image-reading capability to open every absolute PNG path below:

- `/Users/prateekranka/Cowork/spacepixelrts/critic/out/p99-cell-helion-S.png`
- `/Users/prateekranka/Cowork/spacepixelrts/critic/out/p99-cell-helion-E.png`
- `/Users/prateekranka/Cowork/spacepixelrts/critic/out/p99-cell-helion-N.png`
- `/Users/prateekranka/Cowork/spacepixelrts/critic/out/p99-helion-close.png`
- `/Users/prateekranka/Cowork/spacepixelrts/critic/out/p99-helion-walk.png`
- `/Users/prateekranka/Cowork/spacepixelrts/critic/out/p99-helion-build.png`
- `/Users/prateekranka/Cowork/spacepixelrts/critic/out/p99-helion-food.png`
- `/Users/prateekranka/Cowork/spacepixelrts/critic/out/p99-helion-crystal.png`
- `/Users/prateekranka/Cowork/spacepixelrts/critic/out/p99-helion-attack.png`

Question: Does this read as an AoE2-style villager who can walk, build, gather food, gather crystals, and attack?

Pass only if all are true:

1. A naive player names the character a worker/villager at a glance, not a soldier, mage, or crate-golem.
2. Idle and walk hands are empty.
3. The headgear reads as a construction hard-hat with a lamp, not a combat visor.
4. Build, food, crystal, and attack read as the same person with a different load or tool.
5. South and east cells remain readable in the live close RTS view.
6. Build reads as hammer/mallet labor, food as a produce load, crystal as an ore/crystal load, and attack as the tool raised as a weapon.

Return exactly one of:

- `PASS — <one concise sentence explaining why it clears the bar>`
- `FAIL — <one sentence naming only the single biggest visual gap>`

Do not provide multiple gaps, implementation advice, code commentary, or a score.

## Verdict

FAIL — Build does not read as hammer/mallet labor; the worker holds or tends a crate-like block instead of swinging a tool.
