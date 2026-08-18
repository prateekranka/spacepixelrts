You are the **P99 orchestrator**. Model: `gpt-5.6-sol-xhigh`.

Repo: `/Users/prateekranka/Cowork/spacepixelrts`
Cwd: that repo. Vite is already on `http://127.0.0.1:5173` — do **not** start another, do **not** kill it.

Read first: `tasks/P99-spec.md`, `references/helion-worker-option5.png`, `src/sprites.ts` (`drawHelionWorker`, `drawWorker8Dir`, `buildSpriteAtlas`), `src/sprite-sdf.ts`, `src/render.ts` (`frameFor`, worker scale), `src/engine.ts` (`dir8`, `Ord`), `scripts/p98-worker-shots.mjs`.

## Topology (user-mandated — do not substitute)

| Role | Model slug | How |
| Orchestrator (you) | `gpt-5.6-sol-xhigh` | this process |
| Builder subagents | `gpt-5.6-luna-max-fast` | `cursor-agent --trust --yolo --print --model gpt-5.6-luna-max-fast` |
| Blind visual critic | `cursor-grok-4.6-xhigh` | `cursor-agent --trust --print --model cursor-grok-4.6-xhigh` with PNG paths in the prompt |

Spawn from the repo root. Give each agent a **complete** brief file (`tasks/P99-builder-rN.md` / `tasks/P99-critic-rN.md`) and `-p` that file’s contents. Log to `tasks/p99-builder-rN.log` / `tasks/p99-critic-rN.log`.

Never Flowdeck. Never `git add -A`. Never commit `notes.md`.

## The piece

Implement the **Helion Compact worker** as locked **option 5** (Habitat Builder base) so it can walk, build, gather food, gather crystals, and attack — AoE2 villager language from https://youtu.be/ZBdAe3ZwKds.

Helion only. Leave Kryos/Nihiline worker draw as-is.

## Loop (non-negotiable)

No fixed round count. Stop only when a **fresh** Grok critic PASSes the bar in `tasks/P99-spec.md`.

Each round:

1. Write a builder brief that names the **single biggest remaining gap** (round 1: the whole option-5 body + action wiring).
2. Spawn **one** Luna Max Fast builder. Wait until it exits.
3. Verify yourself: `npx tsc --noEmit`; run/adapt `scripts/p98-worker-shots.mjs` so it dumps Helion idle S/E/N cells **and** one frame each of walk / build / gather-food / gather-crystal / attack (force orders on camp workers via `__STARHOLD_WORLD__`). Shots go in `critic/out/p99-*.png`.
4. Write a **blind** critic brief: do not tell it the builder’s story. Attach the PNGs (idle S, idle E, close camp, and the four action shots). Ask: “Does this read as an AoE2-style villager who can walk, build, gather food, gather crystals, and attack? Pass or fail. If fail, one sentence: the single biggest gap.”
5. Spawn a **fresh** Grok Extra High critic. Wait. Write `tasks/P99-critic-rN.md` with the verdict.
6. FAIL → next round targeting that one gap. PASS → write `tasks/P99.md` (what shipped, atlas layout, frameFor mapping) and commit.

## Builder constraints to copy into every builder brief

- Procedural `Pix` in `src/sprites.ts`. Silhouette-first, top-left 3-tone light, connected anatomy (`src/art-reference.ts` technique).
- Idle/walk: empty hands. Hat = construction hard-hat + MAG lamp, not a visor.
- Atlas 512px wide = 16 cols. Pack actions as **extra Helion rows**, not extra columns.
- Bump `VERSION` in `src/main.ts` each round (`0.9.9-iso` then tick the patch).
- Commit only `src/**`, `scripts/p98-worker-shots.mjs` (or a new `scripts/p99-worker-shots.mjs`), `tasks/P99.md`. Message: `P99: …`.
- Do not start other roles/buildings/civs.

## Critic spawn example

```
cursor-agent --trust --print --model cursor-grok-4.6-xhigh -p "$(cat tasks/P99-critic-rN.md)" \
  critic/out/p99-cell-helion-S.png \
  critic/out/p99-cell-helion-E.png \
  critic/out/p99-helion-close.png \
  critic/out/p99-helion-build.png \
  critic/out/p99-helion-food.png \
  critic/out/p99-helion-crystal.png \
  critic/out/p99-helion-attack.png
```

If the CLI cannot take multiple image args, put absolute PNG paths in the prompt and tell Grok to Read them.

## Done

`tasks/P99.md` exists, latest critic file says **PASS**, Helion workers on `:5173` match option 5. Then stop. Do not start P100.
