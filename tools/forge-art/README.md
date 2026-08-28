# Forge Art Lab — developer-only tool. Not part of the production game.
#
# Layout (see docs/FORGE_ART_LAB.md — FROZEN contract):
#   index.html        workbench entry
#   rig.html          real-renderer context rig (one live WebGL context)
#   src/              tool modules (registry, adapters, metrics, store, views)
#   baselines/        immutable accepted baselines + registry.json (CLI-writable only)
#   fixtures/         dev-only sandbox fixtures if needed later
#
# Rules:
# - Nothing in this directory may be imported by src/* production modules.
# - The browser never writes baselines/; only scripts/forge-art-accept.mjs --apply does.
# - dist-forge-art/ is gitignored; it must never be deployed.
