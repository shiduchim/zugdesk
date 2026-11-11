// Scores one or more result files (bench/results/*.jsonl) against a test file.
// usage: node tools/score.mjs cases.json C-rules.jsonl [A-....jsonl ...] [--verbose]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarize } from '../web/js/score.js';
import { describe } from '../web/js/planner.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const [caseFile, ...resFiles] = args.filter(a => !a.startsWith('--'));
const world = JSON.parse(fs.readFileSync(path.join(here, '../web/world.json'), 'utf8'));
const { today, cases } = JSON.parse(fs.readFileSync(path.join(here, '../web', caseFile), 'utf8'));
const all = {};
for (const rf of resFiles) {
  const results = fs.readFileSync(path.join(here, '../bench/results', rf), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const S = summarize(cases, results, world, today);
  all[rf] = S;
  console.log(`\n=== ${rf} ===`);
  for (const k of ['english', 'given', 'variants', 'unseen', 'holdout', 'multilingual']) {
    const t = S[k]; if (!t.n) continue;
    console.log(`${k.padEnd(12)} n=${String(t.n).padStart(3)} understood=${t.understoodFully}% activity=${t.activity}% people=${t.peopleRoles}% negation=${t.negation}% reminders=${t.reminders}% noFalseRem=${t.noFalseReminder}% multi=${t.multiple}% source=${t.source}% invented/case=${t.inventedPerCase} filedRight=${t.filedRight}% oneTap=${t.oneTap}% taps=${t.avgTaps} blame(engine/filing/absorbed)=${t.blameEngine}/${t.blameFiling}/${t.absorbed} median=${t.medianMs}ms p90=${t.p90Ms}ms crashes=${t.crashes}`);
  }
  if (verbose) {
    for (const r of S.rows) {
      if (r.s && r.s.filing.ok && r.s.interp.allOK) continue;
      console.log(`\n✗ ${r.id} [${r.blame}] ${r.text}`);
      if (r.error) { console.log('  ERROR', r.error.slice(0, 300)); continue; }
      const res = results.find(x => x.id === r.id);
      for (const l of describe(res.ir)) console.log('   understood:', l);
      console.log('   people:', JSON.stringify(res.ir.people));
      for (const n of r.s.interp.notes) console.log('   ✗', n);
      for (const n of r.s.interp.invented) console.log('   ✗ invented:', n);
      for (const m of r.s.filing.missing) console.log('   ✗ filing missing:', JSON.stringify(m));
      for (const v of r.s.filing.violated) console.log('   ✗ filing wrong:', JSON.stringify(v));
    }
  }
}
fs.writeFileSync(path.join(here, '../bench/results/summary-' + caseFile.replace('.json', '') + '.json'), JSON.stringify(Object.fromEntries(Object.entries(all).map(([k, v]) => [k, { ...v, rows: v.rows.map(r => ({ id: r.id, cat: r.cat, set: r.set, ms: r.ms, blame: r.blame, understood: r.s?.interp.allOK ?? false, filed: r.s?.filing.ok ?? false, taps: r.s?.filing.taps ?? null, notes: r.s ? [...r.s.interp.notes, ...r.s.interp.invented.map(x => 'invented: ' + x), ...r.s.filing.missing.map(m => 'filing missing: ' + JSON.stringify(m)), ...r.s.filing.violated.map(m => 'filing wrong: ' + JSON.stringify(m))] : [r.error] })) }])), null, 1));
