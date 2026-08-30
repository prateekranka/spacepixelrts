# Forge Art Lab — operator guide

Forge Art Lab is a developer-only asset review and acceptance workbench. It does not paint pixels in the browser. You edit the real runtime sprite source, then use Art Lab to compare, diagnose, prove, and accept that candidate.

Current isolated worktree:

```text
/home/bobbyranka/workspace/spacepixelrts-forge-art-lab
```

## 1. Start the workbench

```bash
cd /home/bobbyranka/workspace/spacepixelrts-forge-art-lab
npm run forge:art
```

Open:

```text
http://127.0.0.1:5179/tools/forge-art/index.html
```

Stop the server with `Ctrl-C` in the terminal that started it.

Use a normal browser window at 1366 × 1024 or larger for final judgment. The Hermes preview pane is suitable for learning and quick checks, but its narrow width is not the visual acceptance authority.

## 2. Learn safely with the sandbox candidate

The sandbox changes the preview only. It never changes `src/sprites.ts` or an accepted baseline.

1. Press **sandbox: off**. The page reloads with `sandbox=1`.
2. Select **Lumen Guard**.
3. Use **split**, then drag the wipe across the sprite.
4. Use **side by side**.
5. Use **diff**. Red pixels are changed pixels.
6. Inspect all eight facings and both pose frames.
7. Toggle **silhouette**, **value**, **alpha**, **team**, and **emissive**.
8. Change zoom between 1×, 4×, and 8×.
9. Read the status and objective gate table in the inspector.
10. Open **context** and inspect normal camera first. Then inspect selected unit, fog edge, battle clump, close, and strategic views.
11. Open **roster** and compare unit scale and faction identity.
12. Press **sandbox: on** to return to the real candidate.

The sandbox deliberately makes Lumen Guard wrong. A visible A/B difference and at least one failed gate prove that the diagnostic path is active.

## 3. Understand the three pixel states

- **ACCEPTED BASELINE**: immutable reference bytes under `tools/forge-art/baselines/<asset-id>/`.
- **CURRENT CANDIDATE**: pixels generated now from the runtime source.
- **PREVIEW OVERRIDE**: a browser-only diagnostic transform. Never accept it.

The candidate must match the baseline before editing. A cyan **CURRENT CANDIDATE** dot means
current source and accepted baseline agree. A green **READY FOR REVIEW** dot means the candidate
differs and its hard gates pass; it still needs normal-scale and independent visual review.

## 4. Use the main controls

### Catalog

Filter by faction or asset class. Search by canonical label or stable asset ID. Use `[` and `]` to move through the catalog.

### Facing and frame

- Facing buttons select directions 0 through 7.
- Left and Right step frames.
- Shift+Left and Shift+Right change facing.
- Space starts or pauses animation.

### A/B comparison

- **split**: accepted and candidate share one synchronized stage.
- **side by side**: inspect both complete frames.
- **diff**: changed pixels are isolated.
- `A` and `D` move the split wipe.
- Tab cycles comparison modes.

### Diagnostic passes

1. silhouette
2. value
3. alpha
4. team color
5. emissive
6. difference mode

Keys `1` through `5` toggle the matching pass. Key `6` toggles difference mode. `Z` cycles zoom. `?` opens help. Escape closes help, roster, or context.

### Inspector

Read four types of evidence:

- asset metadata and runtime mapping;
- candidate and accepted hashes;
- objective gate rows;
- exact failure JSON.

A **proven** failed row blocks acceptance. An **advisory** row is a review prompt. Advisory rows do not become hard failures automatically.

## 5. Judge the right views in the right order

Use this order for each asset:

1. **Normal game camera** — final authority for legibility.
2. **Selected unit or building** — ring, health bar, and local contrast.
3. **Fog edge** — visibility under real fog.
4. **Battle clump or confrontation** — overlap and faction separation.
5. **Roster** — relative scale and silhouette family.
6. **Close view** — anatomy and pixel defects.
7. **Strategic view** — long-range recognition.
8. **Enlarged sheet** — technical pixel inspection only.

Never accept an asset because its enlarged sheet looks good. The fixed normal gameplay camera is the authority.

## 6. Edit a real asset

Create or switch to a dedicated asset branch before editing. Do not work directly on an accepted branch.

```bash
cd /home/bobbyranka/workspace/spacepixelrts-forge-art-lab
git switch -c art/<asset-id>-candidate
```

The current procedural source is:

```text
src/sprites.ts
```

Runtime mappings include:

- combat units: `drawLumenGuardCombat`, `drawSolarStriderCombat`, `drawRiftGuardCombat`, `drawBurdenWalkerCombat`;
- workers: `drawWorker8Dir`;
- scouts: `drawScoutHd`;
- Core: `drawHallPix` through `drawBuildingSprite`;
- Habitat: `drawHousePix` through `drawBuildingSprite`;
- Yard: `drawBarracksPix` through `drawBuildingSprite`.

Save the source. Vite refreshes the candidate. The accepted baseline does not move.

Repeat the normal-camera, A/B, pass, context, and roster checks after every meaningful change.

## 7. Generate candidate baseline artifacts

This command renders a candidate PNG and candidate manifest outside the repository. It does not change accepted art.

```bash
OUT="/tmp/fal-baseline-$(date -u +%Y%m%dT%H%M%SZ)"

npm run forge:art:baseline -- \
  --asset=sunweaver-lumen-guard \
  --out="$OUT"
```

Use `--asset=all` to generate candidate baseline artifacts for the full catalog. This is not acceptance.

## 8. Generate a proof pack

First build production once. The proof checks that Forge Art Lab did not enter the production bundle.

```bash
npm run build
```

Then generate evidence outside the repository:

```bash
OUT="/tmp/fal-proof-$(date -u +%Y%m%dT%H%M%SZ)"

npm run forge:art:proof -- \
  --asset=sunweaver-lumen-guard \
  --out="$OUT"

printf '%s\n' "$OUT"
```

Inspect at least:

```text
manifest.json
candidate-sheet.png
accepted-sheet.png
difference-sheet.png
silhouette-sheet.png
value-sheet.png
normal-context.png
close-context.png
far-context.png
metrics.json
changes.json
console.txt
critic-brief.txt
```

For a full roster evidence pack:

```bash
ROSTER="/tmp/fal-roster-$(date -u +%Y%m%dT%H%M%SZ)"

npm run forge:art:proof -- \
  --asset=roster \
  --out="$ROSTER"
```

A proof pack is objective evidence. It is not subjective approval. Send its normal-scale context images and `critic-brief.txt` to a fresh independent visual critic before acceptance.

## 9. Run safe acceptance first

Acceptance is a dry-run unless `--apply` is present.

```bash
npm run forge:art:accept -- \
  --asset=sunweaver-lumen-guard \
  --evidence="$OUT/manifest.json"
```

The dry-run must report:

- selected asset;
- changed-frame count;
- destination baseline PNG;
- destination accepted manifest;
- destination registry;
- `DRY-RUN complete — nothing written.`

It refuses stale evidence, missing or failed gates, partial frames, candidate hash changes, and unrelated asset drift.

## 10. Understand `--apply`

`--apply` is the mutation boundary:

```bash
npm run forge:art:accept -- \
  --asset=sunweaver-lumen-guard \
  --evidence="$OUT/manifest.json" \
  --apply
```

It changes only:

```text
tools/forge-art/baselines/<asset-id>/baseline.png
tools/forge-art/baselines/<asset-id>/manifest.json
tools/forge-art/baselines/registry.json
```

It does not commit. It does not deploy. It does not merge.

Use `--apply` only when all conditions are true:

1. the work is on a dedicated asset branch;
2. the normal gameplay camera is approved;
3. all required facings and states are complete;
4. proof `manifest.json` has `ok: true`;
5. `console.txt` is clean;
6. all hard gates pass;
7. a fresh independent critic approves the asset;
8. the dry-run output matches the intended one-asset change.

After `--apply`, inspect and commit the source and accepted artifacts together:

```bash
git status --short
git diff -- src/sprites.ts \
  tools/forge-art/baselines/<asset-id>/manifest.json \
  tools/forge-art/baselines/registry.json

git add src/sprites.ts \
  tools/forge-art/baselines/<asset-id>/baseline.png \
  tools/forge-art/baselines/<asset-id>/manifest.json \
  tools/forge-art/baselines/registry.json

git commit -m "FAL-ACCEPT: accept <asset-id> candidate"
```

## 11. Run the full tool gate

Stop any manually launched Art Lab server first. The QA gate treats any surviving Forge Vite process as a leak.

```bash
OUT="/tmp/fal-qa-$(date -u +%Y%m%dT%H%M%SZ)"

npm run test:forge-art
npm run forge:art:typecheck
npm run forge:art:build
npm run build
npm run qa:forge-art -- --out="$OUT"
```

A valid run ends with:

```text
ok=true steps=15/15
```

The outputs and browser evidence remain outside the repository.

## 12. Daily loop

```text
Create asset branch
→ edit src/sprites.ts
→ inspect A/B and every facing/state
→ judge normal gameplay context
→ inspect roster and clump coherence
→ build production
→ generate external proof pack
→ run fresh independent visual review
→ run dry-run acceptance
→ apply one accepted baseline intentionally
→ inspect and commit source + baseline evidence
→ run full Forge Art QA
```
