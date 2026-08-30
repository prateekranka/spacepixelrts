// Forge Review Deck — manifest schema (`forge-review-deck/1`) validator + writer.
//
// Pure validator: no I/O, no side effects. Checks every field required by the
// spec's manifest schema section. Hard rule: any cell with ok=true whose
// requestedSeed !== actualSeed is a validation error (seed mismatch is a hard
// failure everywhere).
import fs from 'node:fs';
import path from 'node:path';

export const SCHEMA_VERSION = 'forge-review-deck/1';

const ORIENTATIONS = ['landscape-left', 'landscape-right'];
const KINDS = ['route', 'extra', 'perspective'];
const PERSPECTIVES = ['player', 'rival', 'omniscient'];
const CAMERA_MODES = ['normal', 'tactical-close', 'strategic-far'];
const CONFIG_STRING_FIELDS = ['playerFaction', 'aiFaction', 'map', 'difficulty', 'seedMode', 'tacticalPause'];
const IMAGE_NUMERIC_FIELDS = ['width', 'height', 'minLuma', 'maxLuma', 'meanLuma', 'litRatio', 'distinctColors', 'paletteAdherence'];
const PERF_NUMERIC_FIELDS = ['fps', 'gameWorkP99Ms', 'rafP99Ms'];

const isObj = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStr = (value) => typeof value === 'string';
const isFin = (value) => typeof value === 'number' && Number.isFinite(value);
const isBool = (value) => typeof value === 'boolean';
const isIso = (value) => isStr(value) && !Number.isNaN(Date.parse(value));

/** validateManifest(m) -> { valid, errors } */
export function validateManifest(m) {
  const errors = [];
  if (!isObj(m)) return { valid: false, errors: ['manifest must be an object'] };

  // --- top level ---
  if (!isStr(m.tool) || m.tool.length === 0) errors.push('tool missing or invalid');
  if (m.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion must be "${SCHEMA_VERSION}" (got ${JSON.stringify(m.schemaVersion)})`);
  }
  if (!isIso(m.startedAt)) errors.push('startedAt missing or invalid');
  if (!isIso(m.finishedAt)) errors.push('finishedAt missing or invalid');

  if (!isObj(m.git)) errors.push('git missing or invalid');
  else {
    if (!isStr(m.git.commit) || m.git.commit.length === 0) errors.push('git.commit missing or invalid');
    if (!isStr(m.git.branch) || m.git.branch.length === 0) errors.push('git.branch missing or invalid');
    if (!isBool(m.git.dirty)) errors.push('git.dirty missing or invalid');
  }

  if (!isObj(m.args)) errors.push('args missing or invalid');

  if (m.requestedSeed !== null && !isFin(m.requestedSeed)) {
    errors.push('requestedSeed missing or invalid');
  }
  if (m.actualSeed !== null && !isFin(m.actualSeed)) {
    errors.push('actualSeed missing or invalid');
  }

  if (!isObj(m.viewport)) errors.push('viewport missing or invalid');
  else {
    if (!isFin(m.viewport.width) || m.viewport.width <= 0) errors.push('viewport.width missing or invalid');
    if (!isFin(m.viewport.height) || m.viewport.height <= 0) errors.push('viewport.height missing or invalid');
    if (!isFin(m.viewport.deviceScaleFactor) || m.viewport.deviceScaleFactor <= 0) {
      errors.push('viewport.deviceScaleFactor missing or invalid');
    }
  }

  if (!isObj(m.environment)) errors.push('environment missing or invalid');
  else {
    if (!isStr(m.environment.browser) || m.environment.browser.length === 0) {
      errors.push('environment.browser missing or invalid');
    }
    if (!isStr(m.environment.webglRenderer)) errors.push('environment.webglRenderer missing or invalid');
    if (!isBool(m.environment.softwareRenderer)) errors.push('environment.softwareRenderer missing or invalid');
  }

  if (!isObj(m.pack)) errors.push('pack missing or invalid');
  else {
    for (const key of ['routes', 'extras', 'perspectives']) {
      if (!Array.isArray(m.pack[key])) errors.push(`pack.${key} must be an array`);
    }
    for (const key of ['board', 'consoleTxt', 'criticBrief', 'clip']) {
      if (m.pack[key] !== null && !isStr(m.pack[key])) errors.push(`pack.${key} missing or invalid`);
    }
  }

  if (!Array.isArray(m.failures)) errors.push('failures must be an array');
  if (!isBool(m.ok)) errors.push('ok missing or invalid');

  // --- capture cells ---
  if (isObj(m.pack)) {
    for (const [group, kind] of [
      ['routes', 'route'],
      ['extras', 'extra'],
      ['perspectives', 'perspective'],
    ]) {
      if (!Array.isArray(m.pack[group])) continue;
      m.pack[group].forEach((cell, index) => validateCell(errors, cell, `${group}[${index}]`, kind));
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateCell(errors, cell, at, expectedKind) {
  if (!isObj(cell)) {
    errors.push(`${at} must be an object`);
    return;
  }
  if (!isStr(cell.id) || cell.id.length === 0) errors.push(`${at}.id missing or invalid`);
  if (!KINDS.includes(cell.kind)) errors.push(`${at}.kind must be one of ${KINDS.join(', ')}`);
  else if (cell.kind !== expectedKind) errors.push(`${at}.kind must be "${expectedKind}"`);
  if (!ORIENTATIONS.includes(cell.orientation)) {
    errors.push(`${at}.orientation must be one of ${ORIENTATIONS.join(', ')}`);
  }
  if (!isStr(cell.url) || cell.url.length === 0) errors.push(`${at}.url missing or invalid`);
  if (cell.requestedSeed !== null && !isFin(cell.requestedSeed)) {
    errors.push(`${at}.requestedSeed missing or invalid`);
  }
  if (!isFin(cell.actualSeed)) errors.push(`${at}.actualSeed missing or invalid`);
  if (!isStr(cell.expectedState) || cell.expectedState.length === 0) {
    errors.push(`${at}.expectedState missing or invalid`);
  }
  if (!isStr(cell.actualState) || cell.actualState.length === 0) {
    errors.push(`${at}.actualState missing or invalid`);
  }
  if (!isFin(cell.tick) || cell.tick < 0) errors.push(`${at}.tick missing or invalid`);
  if (!PERSPECTIVES.includes(cell.perspective)) {
    errors.push(`${at}.perspective must be one of ${PERSPECTIVES.join(', ')}`);
  }
  if (!CAMERA_MODES.includes(cell.cameraMode)) {
    errors.push(`${at}.cameraMode must be one of ${CAMERA_MODES.join(', ')}`);
  }
  if (!isObj(cell.camera)) errors.push(`${at}.camera missing or invalid`);
  else {
    if (!isFin(cell.camera.x)) errors.push(`${at}.camera.x missing or invalid`);
    if (!isFin(cell.camera.z)) errors.push(`${at}.camera.z missing or invalid`);
    if (!isFin(cell.camera.halfH)) errors.push(`${at}.camera.halfH missing or invalid`);
  }
  if (!Array.isArray(cell.selection)) errors.push(`${at}.selection must be an array`);
  else if (!cell.selection.every(isFin)) errors.push(`${at}.selection must contain only numbers`);

  if (!isObj(cell.config)) errors.push(`${at}.config missing or invalid`);
  else {
    for (const key of CONFIG_STRING_FIELDS) {
      if (!isStr(cell.config[key]) || cell.config[key].length === 0) {
        errors.push(`${at}.config.${key} missing or invalid`);
      }
    }
    if (!isBool(cell.config.fogOfWar)) errors.push(`${at}.config.fogOfWar missing or invalid`);
    if (!isFin(cell.config.speed)) errors.push(`${at}.config.speed missing or invalid`);
    if (!isFin(cell.config.seed)) errors.push(`${at}.config.seed missing or invalid`);
  }

  if (!isObj(cell.image)) errors.push(`${at}.image missing or invalid`);
  else {
    if (!isStr(cell.image.file) || cell.image.file.length === 0) {
      errors.push(`${at}.image.file missing or invalid`);
    }
    for (const key of IMAGE_NUMERIC_FIELDS) {
      if (!isFin(cell.image[key])) errors.push(`${at}.image.${key} missing or invalid`);
    }
  }

  if (!isObj(cell.perf)) errors.push(`${at}.perf missing or invalid`);
  else {
    for (const key of PERF_NUMERIC_FIELDS) {
      if (!isFin(cell.perf[key]) || cell.perf[key] < 0) {
        errors.push(`${at}.perf.${key} missing or invalid`);
      }
    }
  }
  if (cell.draws !== null && !isFin(cell.draws)) errors.push(`${at}.draws missing or invalid`);

  if (!isObj(cell.entities)) errors.push(`${at}.entities missing or invalid`);
  else {
    if (!isFin(cell.entities.live) || cell.entities.live < 0) {
      errors.push(`${at}.entities.live missing or invalid`);
    }
    if (!isFin(cell.entities.total) || cell.entities.total < 0) {
      errors.push(`${at}.entities.total missing or invalid`);
    }
  }
  if (!Array.isArray(cell.errors)) errors.push(`${at}.errors must be an array`);
  if (!Array.isArray(cell.gates)) errors.push(`${at}.gates must be an array`);
  if (!isBool(cell.ok)) errors.push(`${at}.ok missing or invalid`);
  if (cell.p99GateMs !== undefined && !isFin(cell.p99GateMs)) {
    errors.push(`${at}.p99GateMs invalid`);
  }

  // Hard rule: a cell claiming ok must have a resolved seed equal to the
  // requested seed. Seed mismatch is a hard failure everywhere.
  if (cell.ok === true && cell.requestedSeed !== cell.actualSeed) {
    errors.push(
      `${at}: ok cell has requestedSeed ${cell.requestedSeed} != actualSeed ${cell.actualSeed} (seed mismatch is a hard failure)`,
    );
  }
}

/** writeManifest(path, manifest) — atomic-ish JSON write with dir creation. */
export function writeManifest(filePath, manifest) {
  const abs = path.resolve(filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(manifest, null, 2)}\n`);
  return abs;
}
