#!/usr/bin/env bash
# Production isolation scan: prove dist/ contains no Forge Art Lab content.
set -e
cd "$(dirname "$0")/.."
node --input-type=module -e '
import fs from "node:fs";
import path from "node:path";
const dist = path.resolve("dist");
if (!fs.existsSync(dist)) { console.error("dist/ missing"); process.exit(1); }
const offenders = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else {
      if (/forge|art-lab|baseline/i.test(entry.name)) offenders.push(full);
      else if (/\.(js|css|html|json)$/.test(entry.name)) {
        const content = fs.readFileSync(full, "utf8");
        if (/forge[ _-]?art[ _-]?lab|FORGE_ART_LAB|baselines\/|__FORGE_ART/i.test(content)) offenders.push(full);
      }
    }
  }
};
walk(dist);
console.log(offenders.length === 0 ? "PROD ISOLATION: CLEAN (no forge-art content in dist/)" : "PROD ISOLATION FAIL:");
for (const o of offenders) console.log("  " + o);
process.exit(offenders.length === 0 ? 0 : 1);
'
