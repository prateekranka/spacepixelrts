# Lumen Guard image-backed candidate contract

Status: **ACTIVE LEAD CONTRACT**

Target: `sunweaver-lumen-guard` — Sunweaver combat unit, combat row `0`.

The existing Forge Art Lab v1 implementation is inherited and remains the workbench
foundation. It currently has procedural baseline inspection, A/B views, pixel passes,
context scenes, proof, and dry-run acceptance. It has no image-backed candidate model.
This contract adds only the smallest vertical slice needed for one Lumen Guard replacement.

## Immutable boundaries

- Keep asset ID `sunweaver-lumen-guard`.
- Keep Sunweaver identity, combat row `0`, atlas mapping, world scale, stats, behavior,
  controls, simulation, and balance.
- Do not edit `src/sim.ts` or `src/engine.ts`.
- Keep accepted baseline state separate from draft candidate state.
- The browser must not write accepted baselines or production source.
- Candidate/reference files are Forge Art data. They must not enter `dist/`.
- Existing procedural painters and frozen rows remain the baseline until explicit lead
  acceptance. The candidate override is never the normal route.
- The existing exterior combat rim is applied by `authoredCombatSprite()` exactly once.
  Candidate source cells contain no artificial rim.

## Repository contract

```text
tools/forge-art/candidates/sunweaver-lumen-guard/
  reference.png       # committed user reference, source of truth for this candidate
  candidate.png       # deterministic 512x128, 8 directions x 2 poses sheet
  manifest.json       # authoritative candidate metadata and frame hashes

src/generated/sunweaver-lumen-guard-candidate.ts
                      # deterministic raw Pix source, generated from the reference
```

Reference provenance for this run:

- input: `/home/bobbyranka/.hermes/profiles/bottymcbotface/attachments/ChatGPT Image Aug 26, 2026, 10_04_56 PM.png`
- source size: `1389x1132`
- source SHA-256: `1832b400a6291f8887697203d1a8968fe9b4211844feec9b352fe75b5e89943c`

The import command copies the source into `reference.png`, writes the generated source,
PNG sheet, and manifest by temporary-file-plus-rename, then verifies every hash. The
manifest and generated source are the disk authority. Browser memory may hold a transient
file preview during an attach interaction, but localStorage, URL hashes, and base64 blobs
are never the authoritative candidate store.

## Manifest v1

```ts
interface ForgeArtCandidateManifest {
  schemaVersion: 1;
  assetId: string;
  label: string;
  civilization: 'sunweaver' | 'gravemark';
  category: 'unit' | 'building';
  adapter: 'combat' | 'building';
  sourceKind: 'reference-image' | 'sprite-sheet';
  sourcePath: string;             // repository-relative
  sourceSha256: string;
  sourceWidth: number;
  sourceHeight: number;
  candidatePath: string;          // repository-relative candidate.png
  candidateSourcePath: string;   // repository-relative generated TS source
  generatedAt: string;
  algorithm: 'combat-reference-v1';
  status: 'draft' | 'approved';
  target: {
    cellW: 64; cellH: 64; cols: 8; rows: 2;
    order: 'dir-major'; frameCount: 16;
  };
  directions: { authored: [0, 1, 2, 6, 7]; mirrored: [3, 4, 5] };
  poses: { count: 2; names: ['primary', 'alternate'] };
  frames: Array<{ key: string; sha256: string; width: 64; height: 64; alphaPixels: number }>;
  notes?: string;
}
```

Frame order is exactly:

```text
dir0-pose0 .. dir7-pose0, dir0-pose1 .. dir7-pose1
```

Directions `3`, `4`, and `5` are exact horizontal mirrors of `1`, `0`, and `7`.
Directions `0`, `1`, `2`, `6`, and `7` carry authored directional information. Both poses
must differ by more than the existing proven minimum and remain the same unit.

## Candidate source and runtime seams

`src/generated/sunweaver-lumen-guard-candidate.ts` exports deterministic raw source cells
and a pure frame lookup. It remains inactive in the normal game until the lead performs
formal replacement. The Forge adapters call the candidate source when the candidate view
is selected. The existing `src/sprites.ts` source remains the baseline until acceptance.

The game and renderer use one narrow optional combat override callback. The query
`?forge-art-candidate=sunweaver-lumen-guard` selects only row `0` and leaves all other
rows and all simulation code unchanged. The callback feeds the normal combat atlas and
normal sprite render path. Missing or unknown candidate IDs produce the ordinary baseline,
not a blank atlas or a crash. The normal route has no query and uses the accepted source.

The real-renderer Forge rig accepts `candidate=sunweaver-lumen-guard` and uses the same
row-scoped callback. Its page still owns exactly one WebGL context. The workbench page
itself remains 2D-only.

## Forge Art UI contract

For the selected asset, the workbench shows:

- reference section: attach/import file (`image/png` required), thumbnail, source name/path,
  dimensions/hash, clear control;
- candidate section: `NO CANDIDATE`, `DRAFT`, `READY FOR REVIEW`, or `APPROVED`, output
  path, generated source path, dimensions, frame count, authored/mirrored direction lists,
  and validation warnings/errors;
- view section: baseline, candidate, split, side-by-side, and diff;
- all existing silhouette, value, alpha, team, emissive, checker, slate, 1x, 4x, 8x,
  facing, pose, roster, and real-renderer context controls;
- a visible note for a selected building: the manifest schema supports `unit | building`,
  but this vertical slice only converts combat reference images.

The file input may render an in-memory preview immediately. Disk persistence is proven by
running `forge:art:import`, reloading the page, and reading the committed manifest and
candidate sheet. Clearing the transient preview never changes the accepted baseline.

Required stable QA hooks include:

```text
data-fal-reference-input
data-fal-reference-preview
data-fal-reference-clear
data-fal-candidate-status
data-fal-candidate-metadata
data-fal-view
```

The existing `__FORGE_ART_QA__` probe adds `reference`, `candidate`, `ab`, and `errors`
without removing any current fields.

## Proof and acceptance

The public command is:

```bash
npm run forge:art:import -- \
  --asset=sunweaver-lumen-guard \
  --reference=/absolute/path/to/reference.png
```

Proof is generated outside the repository:

```bash
npm run forge:art:proof -- \
  --asset=sunweaver-lumen-guard \
  --out=/absolute/path/outside/repo
```

The proof must include the candidate manifest/source metadata, source and candidate
previews, 1x/4x/8x sheets, all directions and poses, inspection passes, context captures,
objective gates, errors, and a neutral critic brief. It must be consumable by the existing
acceptance command.

Acceptance remains two distinct lead-owned steps:

1. dry-run the generated proof and verify no accepted bytes change;
2. after technical and fresh blind visual approval, run `--apply` to update exactly the
   Lumen Guard accepted baseline directory, registry entry, and candidate manifest status.

The apply command does not silently modify production source. The lead then makes the
separate authoritative source replacement and updates only the intentional row-0 frozen
hashes/metrics. Other row hashes and all simulation contracts stay frozen.

## Objective gates

Measure raw candidate cells before the runtime rim and verify the existing meaningful
combat gates: 64x64 dimensions, 16 complete frames, alpha coverage, connected silhouette,
pose variance, N-vs-E variance, exact mirror pairs, stable ground contact, luma/material
floor, source MAG band, guard bounds, spear reach, shield presence, and two-layer runtime
rim after `authoredCombatSprite()`. Do not paint a large rim to satisfy a gate. Do not
weaken a threshold. If the approved Lumen source changes a proven metric, record the old
and new values and update the frozen expectation with the reason.

The required visual gate is a fresh blind review of the reference, old baseline, candidate
1x/4x, all-direction/two-pose sheets, and real gameplay at normal scale. The candidate
must read immediately as a gold/ivory armored humanoid with a long spear, large circular
shield, red crest/plume, dark undersuit, and Sunweaver solar identity. Gameplay-scale
readability outranks 8x microdetail.

## QA targets

QA must prove:

- import accepts the reference and rejects unknown/non-combat/malformed input;
- manifest and source files exist, hashes match, dimensions and frame order are correct;
- Forge Art reload shows reference, candidate, A/B, diff, passes, and contexts;
- candidate and baseline remain distinct before acceptance;
- rig candidate override renders through one WebGL context with zero page/console errors;
- movement, multiple facings, pose animation, and selection remain functional in the game;
- missing candidate query falls back to baseline;
- normal game route without the query remains baseline before acceptance and the approved
  Lumen Guard after the separate source replacement;
- simulation and unrelated combat rows remain unchanged;
- proof → dry-run acceptance writes no accepted bytes;
- apply updates only the intended Lumen baseline/registry/source activation;
- production build contains no Forge candidate/reference files.

Evidence stays outside the repository, with at least:

```text
reference, old baseline 1x, candidate 1x/4x/8x, all directions, both poses,
silhouette, value, alpha, team, emissive, baseline-candidate split, diff,
gameplay standing/selected/moving/multiple facings/scale lineup,
accepted normal-route gameplay, proof manifest, acceptance output, QA manifest.
```
