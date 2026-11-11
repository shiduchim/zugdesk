// Scoring. Two separate questions for every engine and every test sentence:
//   1. Did the ENGINE understand the sentence?  (its raw interpretation vs. the correct one —
//      no filing rules involved)
//   2. Did the note end up in the right PLACE?   (the filing plan vs. the expected actions)
// Running the filing step on the *correct* interpretation tells us which filing mistakes are the
// filing rules' own fault, not the engine's.

import { normalizeIR, plan } from './planner.js';
import { nameEq, nameInText, isGroup, isMe, nameTokens } from './names.js';
import { resolveWhen, findWhen } from './dates.js';

const first = x => (Array.isArray(x) ? x[0] : x);
const anyEq = (list, v) => (list || []).some(g => (g === null ? v == null : nameEq(g, v)));

/** The correct interpretation, built from the gold annotation (first accepted choice of each). */
export function goldToIR(c, today) {
  const g = c.gold;
  // the time words as written in the note that give an accepted date
  const phrase = due => {
    if (!due) return null;
    const hit = findWhen(c.text).find(h => due.includes(resolveWhen(h.phrase, today).date));
    return hit ? hit.phrase : null;
  };
  return {
    people: g.people.map(p => ({ name: p.name, role: first(p.role) || 'other', of: p.of || null })),
    events: g.events.map(e => ({ type: first(e.type), actor: first(e.actor) ?? null, with: first(e.with) ?? null,
      about: first(e.about) ?? null, source: null, result: e.result ? 'as written' : null, count: e.count ?? null,
      when: null, negated: !!e.negated })),
    answers: g.answers.map(a => ({ of: a.of, about: a.about || null, value: a.value, source: first(a.source) ?? null })),
    tasks: g.tasks.map(t => ({ who: first(t.who) ?? null, what: 'follow up', when: phrase(t.due) })),
    waiting: g.waiting.map(w => ({ who: first(w.who), what: w.what || null, when: phrase(w.due) })),
    uncertain: []
  };
}

/** Compare an engine's interpretation with the gold annotation. */
export function scoreInterpretation(c, irIn, today) {
  const ir = normalizeIR(irIn);
  const g = c.gold;
  const text = c.text;
  const r = { invented: [], notes: [] };

  // people & roles
  const predPeople = ir.people.filter(p => !isMe(p.name));
  const usedP = new Set();
  let peopleTP = 0, roleOK = 0;
  for (const gp of g.people) {
    const i = predPeople.findIndex((p, k) => !usedP.has(k) && (nameEq(p.name, gp.name) || (gp.alt || []).some(a => nameEq(p.name, a))));
    if (i < 0) { r.notes.push(`missed person "${gp.name}"`); continue; }
    usedP.add(i); peopleTP++;
    const p = predPeople[i];
    let ok = !gp.role || gp.role.includes(p.role);
    if (ok && gp.of) ok = (p.of && nameEq(p.of, gp.of)) || nameTokens(p.name).some(t => nameTokens(gp.of).includes(t));
    if (ok) roleOK++; else r.notes.push(`role of "${gp.name}": said ${p.role}${p.of ? ` of ${p.of}` : ''}, expected ${gp.role.join('/')}${gp.of ? ` of ${gp.of}` : ''}`);
  }
  const extraPeople = predPeople.filter((p, k) => !usedP.has(k));
  for (const p of extraPeople) {
    if (isGroup(p.name) || (g.no_people || []).some(n => nameEq(n, p.name))) r.invented.push(`group made into a person: "${p.name}"`);
    else if (!nameInText(p.name, text)) r.invented.push(`person not in the note: "${p.name}"`);
  }
  r.people = { gold: g.people.length, found: peopleTP, extra: extraPeople.length, rolesRight: roleOK };
  r.peopleOK = peopleTP === g.people.length && roleOK === peopleTP && !r.invented.some(x => x.startsWith('group') || x.startsWith('person'));

  // events (activities)
  const usedE = new Set(); let evTypeOK = 0, evFullOK = 0;
  const usedT = new Set();
  for (const ge of g.events) {
    const ti = ir.events.findIndex((e, k) => !usedT.has(k) && ge.type.includes(e.type));
    if (ti >= 0) { usedT.add(ti); evTypeOK++; }
    const i = ir.events.findIndex((e, k) => !usedE.has(k) && ge.type.includes(e.type)
      && (!ge.actor || anyEq(ge.actor, e.actor)) && (!ge.with || anyEq(ge.with, e.with))
      && (!ge.about || anyEq(ge.about, e.about)) && (ge.count == null || e.count === ge.count)
      && (!ge.result || e.result) && (ge.negated == null || e.negated === ge.negated));
    if (i >= 0) { usedE.add(i); evFullOK++; }
    else r.notes.push(`activity ${ge.type.join('/')}${ge.actor ? ` by ${ge.actor[0]}` : ''}: ${ti >= 0 ? 'right type, wrong details' : 'not found'}`);
  }
  r.events = { gold: g.events.length, typeOK: evTypeOK, fullOK: evFullOK, predicted: ir.events.length };
  for (const e of ir.events) {
    if (e.count != null && !new RegExp(`\\b(${e.count}|${['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][e.count] || '#'})\\b`, 'i').test(text) && !/both|couple|several/.test(text))
      r.invented.push(`count not in the note: ${e.count}`);
  }

  // answers
  const usedA = new Set(); let ansOK = 0, srcOK = 0, srcNeeded = 0;
  for (const ga of g.answers) {
    const i = ir.answers.findIndex((a, k) => !usedA.has(k) && a.value === ga.value && (isMe(ga.of) ? isMe(a.of) : nameEq(a.of, ga.of))
      && (!ga.about || nameEq(a.about, ga.about)));
    if (i < 0) { r.notes.push(`missed answer: ${ga.of} = ${ga.value}`); continue; }
    usedA.add(i); ansOK++;
    if (ga.source) { srcNeeded++; if (anyEq(ga.source, ir.answers[i].source)) srcOK++; else r.notes.push(`answer source: said "${ir.answers[i].source}", expected ${ga.source.join(' or ')}`); }
  }
  // answers the annotation accepts but does not require (e.g. "Sarah's mother wants more information")
  const maybe = g.maybe_answers || [];
  const extraAnswers = ir.answers.filter((a, k) => !usedA.has(k) && !maybe.some(m => m.value === a.value && nameEq(m.of, a.of)));
  for (const a of extraAnswers) r.invented.push(`answer not supported by the note: ${a.of} = ${a.value}`);
  r.answers = { gold: g.answers.length, found: ansOK, extra: extraAnswers.length, sourceOK: srcOK, sourceNeeded: srcNeeded };

  // tasks (reminders) and waiting
  const matchFU = (goldList, predList, kind) => {
    const used = new Set(); let found = 0, dateOK = 0;
    for (const gt of goldList) {
      const i = predList.findIndex((t, k) => !used.has(k) && (anyEq(gt.who, t.who) || (gt.who.includes(null))));
      if (i < 0) { r.notes.push(`missed ${kind} for ${gt.who.filter(Boolean).join('/') || 'someone'}`); continue; }
      used.add(i); found++;
      const d = resolveWhen(predList[i].when, today);
      const ok = gt.due == null ? !d.date || d.vague : gt.due.includes(d.date);
      if (ok) dateOK++; else r.notes.push(`${kind} date: "${predList[i].when ?? '—'}" → ${d.date ?? 'none'}, expected ${gt.due ? gt.due.join(' or ') : 'no date'}`);
    }
    const extra = predList.filter((t, k) => !used.has(k));
    return { gold: goldList.length, found, dateOK, extra };
  };
  const t = matchFU(g.tasks, ir.tasks, 'reminder');
  const w = matchFU(g.waiting, ir.waiting, 'waiting');
  for (const x of t.extra) {
    const isWaitingConfusion = g.waiting.some(gw => anyEq(gw.who, x.who));
    r.invented.push(isWaitingConfusion ? `made "waiting for ${x.who}" into my own reminder` : `reminder nobody asked for: ${x.what || ''} ${x.who || ''}`.trim());
  }
  for (const x of w.extra) r.invented.push(g.tasks.some(gt => anyEq(gt.who, x.who)) ? `made my reminder into "waiting for ${x.who}"` : `waiting not in the note: ${x.who}`);
  r.tasks = { gold: t.gold, found: t.found, dateOK: t.dateOK, extra: t.extra.length };
  r.waiting = { gold: w.gold, found: w.found, dateOK: w.dateOK, extra: w.extra.length };
  for (const fu of [...ir.tasks, ...ir.waiting]) {
    if (fu.when && !nameInText(fu.when.replace(/\d{4}-\d\d-\d\d/, ''), text) && !/\d{4}-\d\d-\d\d/.test(text)) {
      if (/\d{4}-\d\d-\d\d/.test(fu.when)) r.invented.push(`date calculated by the model, not written in the note: ${fu.when}`);
    }
  }

  r.activityOK = r.events.typeOK === r.events.gold;
  r.answersOK = r.answers.found === r.answers.gold && r.answers.extra === 0;
  r.remindersOK = t.found === t.gold && t.dateOK === t.gold && t.extra.length === 0;
  r.waitingOK = w.found === w.gold && w.dateOK === w.gold && w.extra.length === 0;
  r.sourceOK = srcOK === srcNeeded;
  r.multiItem = g.events.length + g.answers.length + g.tasks.length + g.waiting.length >= 2;
  r.multiOK = r.events.fullOK === r.events.gold && r.answersOK && t.found === t.gold && w.found === w.gold;
  r.allOK = r.peopleOK && r.events.fullOK === r.events.gold && r.answersOK && r.remindersOK && r.waitingOK && r.sourceOK && r.invented.length === 0;
  return r;
}

function actionMatches(a, spec) {
  if (a.act !== spec.act) return false;
  if (spec.on) { const on = Array.isArray(a.on) ? a.on : [a.on]; if (!on.includes(spec.on)) return false; }
  for (const k of ['idea', 'side', 'value', 'tier', 'to']) if (spec[k] != null && a[k] !== spec[k]) return false;
  if ('due' in spec) { if (spec.due === null ? a.due != null : !spec.due.includes(a.due)) return false; }
  if (spec.name && !nameEq(a.name, spec.name) && String(a.name).toLowerCase() !== spec.name.toLowerCase()) return false;
  if (spec.options && !spec.options.every(o => (a.options || []).includes(o))) return false;
  return true;
}

/** Check a filing plan against what should (and must not) happen. */
export function scoreFiling(c, p) {
  const missing = c.filing.expect.filter(s => !p.actions.some(a => actionMatches(a, s)));
  const violated = c.filing.forbid.filter(s => p.actions.some(a => actionMatches(a, s)));
  // Taps to get it right: Save + one per choice + one per confirm + 2 per fix.
  const violatedAuto = violated.filter(s => p.actions.some(a => actionMatches(a, s) && a.tier === 'auto'));
  const taps = 1 + p.counts.choice + p.counts.confirm + 2 * (missing.length + violatedAuto.length);
  return { ok: !missing.length && !violated.length, missing, violated, taps,
    autoOnly: p.counts.choice === 0 && p.counts.confirm === 0 };
}

/** Score one engine result for one case. */
export function scoreCase(c, ir, world, today) {
  const interp = scoreInterpretation(c, ir, today);
  const p = plan(ir, world, { text: c.text, context: c.context || null, today });
  const filing = scoreFiling(c, p);
  return { interp, filing, plan: p };
}

const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);

/** Totals over many cases. results: [{ case, ir, ms, error }] */
export function summarize(cases, results, world, today) {
  const rows = [];
  const goldPlanOK = {};
  for (const c of cases) {
    const gp = plan(goldToIR(c, today), world, { text: c.text, context: c.context || null, today });
    goldPlanOK[c.id] = scoreFiling(c, gp).ok;
  }
  for (const res of results) {
    const c = cases.find(x => x.id === res.id);
    if (!c) continue;
    const s = res.error ? null : scoreCase(c, res.ir, world, today);
    let blame = null;
    if (!s) blame = 'engine crashed';
    else if (!s.filing.ok) blame = !s.interp.allOK ? 'engine (misunderstood)' : goldPlanOK[c.id] ? 'engine (subtle)' : 'filing rules';
    else if (!s.interp.allOK) blame = 'engine error, filing still right';
    rows.push({ id: c.id, cat: c.cat, set: c.set, text: c.text, ms: res.ms, s, blame, error: res.error, goldPlanOK: goldPlanOK[c.id] });
  }
  const T = (filter) => {
    const rs = rows.filter(filter).filter(r => r.s);
    const n = rs.length;
    const k = f => rs.filter(f).length;
    const evRows = rs.filter(r => r.s.interp.events.gold > 0);
    const negRows = rs.filter(r => r.cat === 'L');
    const remRows = rs.filter(r => r.s.interp.tasks.gold > 0 || r.s.interp.waiting.gold > 0);
    const noFuRows = rs.filter(r => r.s.interp.tasks.gold === 0 && r.s.interp.waiting.gold === 0);
    const multi = rs.filter(r => r.s.interp.multiItem);
    const src = rs.filter(r => r.s.interp.answers.sourceNeeded > 0);
    const ms = rs.map(r => r.ms).filter(x => x != null).sort((a, b) => a - b);
    return {
      n,
      understoodFully: pct(k(r => r.s.interp.allOK), n),
      activity: pct(evRows.filter(r => r.s.interp.activityOK).length, evRows.length),
      peopleRoles: pct(k(r => r.s.interp.peopleOK), n),
      negation: pct(negRows.filter(r => r.s.interp.answersOK && r.s.interp.invented.length === 0).length, negRows.length),
      reminders: pct(remRows.filter(r => r.s.interp.remindersOK && r.s.interp.waitingOK).length, remRows.length),
      noFalseReminder: pct(noFuRows.filter(r => r.s.interp.tasks.extra === 0 && r.s.interp.waiting.extra === 0).length, noFuRows.length),
      multiple: pct(multi.filter(r => r.s.interp.multiOK).length, multi.length),
      source: pct(src.filter(r => r.s.interp.sourceOK).length, src.length),
      inventedPerCase: n ? +(rs.reduce((a, r) => a + r.s.interp.invented.length, 0) / n).toFixed(2) : null,
      casesWithInvented: pct(k(r => r.s.interp.invented.length > 0), n),
      filedRight: pct(k(r => r.s.filing.ok), n),
      oneTap: pct(k(r => r.s.filing.ok && r.s.filing.autoOnly), n),
      avgTaps: n ? +(rs.reduce((a, r) => a + r.s.filing.taps, 0) / n).toFixed(2) : null,
      blameEngine: k(r => r.blame && r.blame.startsWith('engine (')),
      blameFiling: k(r => r.blame === 'filing rules'),
      absorbed: k(r => r.blame === 'engine error, filing still right'),
      medianMs: ms.length ? ms[Math.floor(ms.length / 2)] : null,
      p90Ms: ms.length ? ms[Math.floor(ms.length * 0.9)] : null,
      crashes: rows.filter(filter).filter(r => !r.s).length
    };
  };
  return {
    rows,
    english: T(r => r.cat !== 'M'),
    given: T(r => r.set === 'given'),
    variants: T(r => r.set === 'variant'),
    unseen: T(r => r.set === 'unseen'),
    holdout: T(r => r.set === 'holdout'),
    multilingual: T(r => r.cat === 'M'),
    goldPlanOK
  };
}
