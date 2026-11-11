// Runs Engine C (no AI) over a test file and writes results in the same format as the model runs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rulesInterpret } from '../web/js/engine_c.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const world = JSON.parse(fs.readFileSync(path.join(here, '../web/world.json'), 'utf8'));
const file = process.argv[2] || 'cases.json';
const outName = process.argv[3] || 'C-rules.jsonl';
const { cases } = JSON.parse(fs.readFileSync(path.join(here, '../web', file), 'utf8'));
const lines = [];
for (const c of cases) {
  const t0 = performance.now();
  let ir = null, error = null;
  try { ir = rulesInterpret(c.text, world).ir; } catch (e) { error = String(e.stack || e); }
  lines.push(JSON.stringify({ id: c.id, engine: 'C', model: 'rules (no AI)', ms: +(performance.now() - t0).toFixed(2), ir, raw: null, error }));
}
fs.mkdirSync(path.join(here, '../bench/results'), { recursive: true });
fs.writeFileSync(path.join(here, '../bench/results', outName), lines.join('\n') + '\n');
console.log(`wrote bench/results/${outName} (${lines.length} cases)`);
