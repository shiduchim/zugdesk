// Runs the filing step on the CORRECT interpretation of every test sentence.
// Any failure here is the filing rules' fault, not an engine's.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan } from '../web/js/planner.js';
import { goldToIR, scoreFiling, scoreInterpretation } from '../web/js/score.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const world = JSON.parse(fs.readFileSync(path.join(here, '../web/world.json'), 'utf8'));
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['cases.json'];
let bad = 0, n = 0;
for (const f of files) {
  const { today, cases } = JSON.parse(fs.readFileSync(path.join(here, '../web', f), 'utf8'));
  for (const c of cases) {
    n++;
    const ir = goldToIR(c, today);
    const self = scoreInterpretation(c, ir, today);
    const p = plan(ir, world, { text: c.text, context: c.context || null, today });
    const s = scoreFiling(c, p);
    if (!s.ok || !self.allOK) {
      bad++;
      console.log(`\n✗ ${c.id}  ${c.text}`);
      if (!self.allOK) console.log('  gold IR does not score itself as correct:', self.notes, self.invented);
      for (const m of s.missing) console.log('  missing:', JSON.stringify(m));
      for (const v of s.violated) console.log('  violated:', JSON.stringify(v));
      for (const a of p.actions) console.log('   ·', a.tier.padEnd(7), a.act.padEnd(14), JSON.stringify(a.on ?? a.options ?? ''), a.text);
    }
  }
}
console.log(`\n${n - bad}/${n} cases filed correctly from the correct interpretation`);
