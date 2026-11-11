// The filing step. It takes what an engine understood (the "interpretation", see SCHEMA below),
// the saved contacts and shidduchim, and returns a filing PLAN. It never changes data itself.
//
// Every engine — the two AI models and the no-AI rules — feeds this same step, so the same
// safety rules apply to all of them:
//   auto     saved with the one Save tap (history entries, clear reminders, waiting, "profile sent")
//   choice   the app needs one pick (which Mrs. Cohen? which day? is this the Sarah you met?)
//   confirm  a separate OK (someone's answer, the shidduch's stage, a new contact)
//   info     shown only; nothing is saved (negations, uncertain things, already known)
// The original note is always kept as written.

import { resolveWhen, niceDate } from './dates.js';
import { nameTokens, nameEq, matchContacts, splitRelation, isGroup, isPronoun, isMe, honorificOf, titleCase } from './names.js';

export const SCHEMA = {
  roles: ['shadchan', 'single', 'reference', 'family', 'other'],
  eventTypes: ['call', 'message', 'meeting', 'date', 'suggestion', 'effort', 'profile_sent', 'profile_received',
    'reference_check', 'request', 'promise', 'note'],
  answerValues: ['yes', 'no', 'thinking', 'more_info']
};
const GO_BETWEEN = ['shadchan', 'friend', 'helper'];
const ACTIVE = s => s && s !== 'ended';

const arr = x => (Array.isArray(x) ? x : x == null ? [] : [x]);
const str = x => (x == null || x === '' ? null : String(x).trim() || null);

/** Make any engine's output safe to read: missing lists become [], unknown words are reported. */
export function normalizeIR(ir) {
  const problems = [];
  const src = ir && typeof ir === 'object' ? ir : {};
  if (!ir || typeof ir !== 'object') problems.push('no interpretation');
  const people = arr(src.people).filter(p => p && str(p.name)).map(p => {
    let role = str(p.role); if (role) role = role.toLowerCase();
    if (role && !SCHEMA.roles.includes(role)) { problems.push(`unknown role "${role}"`); role = 'other'; }
    return { name: str(p.name), role, of: str(p.of) };
  });
  const events = arr(src.events).filter(e => e && typeof e === 'object').map(e => {
    let type = str(e.type); if (type) type = type.toLowerCase();
    if (!SCHEMA.eventTypes.includes(type)) { if (type) problems.push(`unknown event type "${type}"`); type = 'note'; }
    const count = e.count == null || e.count === '' ? null : Number.isFinite(Number(e.count)) ? Number(e.count) : null;
    return { type, actor: str(e.actor), with: str(e.with), about: str(e.about), source: str(e.source),
      result: str(e.result), count, when: str(e.when), negated: e.negated === true || e.negated === 'true' };
  });
  const answers = arr(src.answers).filter(a => a && typeof a === 'object').map(a => {
    let value = str(a.value); if (value) value = value.toLowerCase().replace(/[\s-]+/g, '_');
    if (!SCHEMA.answerValues.includes(value)) { problems.push(`unknown answer "${value}"`); value = null; }
    return { of: str(a.of), about: str(a.about), value, source: str(a.source) };
  }).filter(a => a.value);
  const tasks = arr(src.tasks).filter(t => t && typeof t === 'object')
    .map(t => ({ who: str(t.who), what: str(t.what), when: str(t.when) }));
  const waiting = arr(src.waiting).filter(t => t && typeof t === 'object' && str(t.who))
    .map(t => ({ who: str(t.who), what: str(t.what), when: str(t.when) }));
  const uncertain = arr(src.uncertain).map(str).filter(Boolean);
  return { people, events, answers, tasks, waiting, uncertain, problems };
}

function indexWorld(world) {
  const byId = Object.fromEntries(world.people.map(p => [p.id, p]));
  const ideaBySingle = Object.fromEntries(world.ideas.map(i => [i.single, i]));
  const ideaById = Object.fromEntries(world.ideas.map(i => [i.id, i]));
  return { world, byId, ideaBySingle, ideaById };
}

const label = (W, id) => W.byId[id]?.name || (W.ideaById[id] ? `${W.ideaById[id].label} (shidduch)` : id);
const personDetail = (W, id) => {
  const p = W.byId[id]; if (!p) return '';
  const role = p.roles.includes('single') ? 'single' : p.roles[0];
  return [role, p.city, p.lastContact ? `last spoke ${niceDate(p.lastContact)}` : null].filter(Boolean).join(' · ');
};

export function plan(irIn, world, opts = {}) {
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const text = opts.text || '';
  const ir = normalizeIR(irIn);
  const W = indexWorld(world);
  const ctx = opts.context ? W.byId[opts.context] : null;
  const ctxIdea = ctx ? W.ideaBySingle[ctx.id] : null;

  // ---- 1. every name the interpretation uses, once ----
  const mentions = [];
  const find = name => mentions.find(m => nameEq(m.name, name) || m.name.toLowerCase() === String(name).toLowerCase());
  const add = (name, extra = {}) => {
    if (!name) return null;
    let m = find(name);
    if (!m) { m = { name, role: null, of: null, hints: new Set(), items: new Set() }; mentions.push(m); }
    if (extra.role && !m.role) m.role = extra.role;
    if (extra.of && !m.of) m.of = extra.of;
    if (extra.hint) m.hints.add(extra.hint);
    if (extra.item != null) m.items.add(extra.item);
    return m;
  };
  ir.people.forEach(p => add(p.name, { role: p.role, of: p.of }));
  ir.events.forEach((e, i) => {
    const item = `e${i}`;
    const goBetweenAct = ['effort', 'suggestion', 'profile_received'].includes(e.type);
    add(e.actor, { item, hint: goBetweenAct ? 'go-between' : null });
    add(e.with, { item });
    add(e.about, { item, hint: ['suggestion', 'profile_received', 'date'].includes(e.type) ? 'single' : null });
    add(e.source, { item, hint: 'go-between' });
  });
  ir.answers.forEach((a, i) => {
    const item = `a${i}`;
    if (!isMe(a.of)) add(a.of, { item, hint: 'single' });
    add(a.about, { item, hint: 'single' });
    add(a.source, { item, hint: a.source && !nameEq(a.source, a.of) ? 'go-between-or-family' : null });
  });
  // someone who will send me a profile, an idea or names is a go-between
  const sendsIdeas = what => /profile|resume|idea|names?|suggestion|someone|girl|boy/i.test(what || '');
  ir.tasks.forEach((t, i) => add(t.who, { item: `t${i}` }));
  ir.waiting.forEach((t, i) => add(t.who, { item: `w${i}`, hint: sendsIdeas(t.what) ? 'go-between' : null }));

  // ---- 2. who is each name? ----
  const singleIdsInMessage = () => mentions.filter(m => m.status === 'resolved' && W.byId[m.id]?.roles.includes('single')).map(m => m.id);
  const compatible = (p, m) => {
    const h = m.hints;
    if (h.has('go-between') && !p.roles.some(r => GO_BETWEEN.includes(r))) return false;
    if (h.has('single') && !p.roles.includes('single')) return false;
    if (h.has('go-between-or-family') && p.roles.includes('single')) return false;
    return true;
  };
  const strongClash = (p, m) => {
    const hon = honorificOf(m.name);
    if (hon && p.roles.includes('single')) return `${p.name} is a single, not "${hon.word === 'mrs' ? 'Mrs.' : titleCase(hon.word)}"`;
    if (m.hints.has('single') && !p.roles.includes('single')) return `${p.name} is a ${p.roles[0]}, not a single`;
    if (m.hints.has('go-between') && p.roles.includes('single')) return `${p.name} is a single`;
    if (m.role === 'single' && !p.roles.includes('single') && !m.hints.size) return `${p.name} is a ${p.roles[0]}, not a single`;
    return null;
  };

  for (const m of mentions) {
    m.status = 'unknown';
    if (isMe(m.name)) { m.status = 'me'; continue; }
    if (isPronoun(m.name)) { m.status = 'pronoun'; continue; }
    const rel = splitRelation(m.name, m.of) || ((m.role === 'family' || m.role === 'reference') && m.of
      ? { base: m.of, relation: m.role } : null);
    if (rel) { m.rel = rel; m.status = 'relation'; continue; }
    if (isGroup(m.name)) { m.status = 'group'; continue; }
    const cands = matchContacts(m.name, world.people);
    m.candidates = cands.map(c => c.id);
    if (!cands.length) {
      const looksLikeName = /[A-Z֐-׿Ѐ-ӿ]/.test(m.name) || honorificOf(m.name)
        || /^[a-z]{3,}$/.test(m.name.trim()) && text.toLowerCase().includes(m.name.trim().toLowerCase());
      m.status = looksLikeName ? 'new' : 'unknown';
      continue;
    }
    if (cands.length === 1) {
      const p = W.byId[cands[0].id];
      const clash = strongClash(p, m);
      if (clash) { m.status = 'new'; m.lookalike = p.id; m.why = clash; continue; }
      m.status = 'resolved'; m.id = p.id; m.how = cands[0].how; continue;
    }
    const compat = cands.filter(c => compatible(W.byId[c.id], m));
    if (compat.length === 1 && compat.length < cands.length) {
      const p = W.byId[compat[0].id];
      m.status = 'resolved'; m.id = p.id;
      m.how = `${compat[0].how}; the only ${p.roles.includes('single') ? 'single' : p.roles[0]} named so`;
      continue;
    }
    const pool = compat.length ? compat : cands;
    const byCity = pool.filter(c => W.byId[c.id].city && new RegExp(`\\b${W.byId[c.id].city}\\b`, 'i').test(text));
    if (byCity.length === 1) { m.status = 'resolved'; m.id = byCity[0].id; m.how = `${byCity[0].how}; ${W.byId[m.id].city} is in the note`; continue; }
    m.status = 'ambiguous'; m.pool = pool.map(c => c.id);
  }

  // relations: "Rivka's mother", "Leah's reference", "her father"
  const resolveBase = (m) => {
    const { base, pronounBase, relation } = m.rel;
    if (!base) return null;
    if (pronounBase) {
      const singles = singleIdsInMessage();
      if (singles.length === 1) return { id: singles[0], how: `"${base}" = ${label(W, singles[0])}, the single in this note` };
      if (ctx) return { id: ctx.id, how: `you are on ${ctx.name}'s page` };
      return null;
    }
    if (isMe(base)) return { id: 'me' };
    let bm = mentions.find(x => x !== m && x.status !== 'relation' && nameEq(x.name, base));
    if (!bm) {
      bm = { name: base, role: null, hints: new Set(), items: new Set(), status: 'unknown', synthetic: true };
      if (/reference/.test(relation) || ['mother', 'father', 'parents', 'side', 'sister', 'brother', 'aunt', 'family'].includes(relation)) {
        // whose parents/side/references: prefer a single when the name is shared
      }
      const cands = matchContacts(base, world.people);
      bm.candidates = cands.map(c => c.id);
      if (cands.length === 1) Object.assign(bm, { status: 'resolved', id: cands[0].id, how: cands[0].how });
      else if (cands.length > 1) {
        const singles = cands.filter(c => W.byId[c.id].roles.includes('single'));
        const wantSingle = ['mother', 'father', 'parents', 'side', 'sister', 'brother', 'aunt', 'uncle', 'family', 'reference', 'references'].includes(relation);
        if (wantSingle && singles.length === 1) Object.assign(bm, { status: 'resolved', id: singles[0].id, how: `${singles[0].how}; the only single named so` });
        else Object.assign(bm, { status: 'ambiguous', pool: cands.map(c => c.id) });
      } else bm.status = 'new';
      mentions.push(bm);
    }
    if (bm.status === 'ambiguous' && /reference|mother|father|parents|side|sister|brother|aunt|uncle|family/.test(relation)) {
      const singles = (bm.pool || []).filter(id => W.byId[id].roles.includes('single'));
      if (singles.length === 1) Object.assign(bm, { status: 'resolved', id: singles[0], how: 'the only single named so' });
    }
    return bm.status === 'resolved' ? { id: bm.id, how: bm.how } : bm.status === 'ambiguous' ? { ambiguous: bm } : null;
  };
  for (const m of mentions.filter(x => x.status === 'relation')) {
    const b = resolveBase(m);
    m.base = b;
    if (/reference/.test(m.rel.relation)) {
      const baseId = b?.id && b.id !== 'me' ? b.id : null;
      const idea = baseId ? W.ideaBySingle[baseId] : (!m.rel.base && ctxIdea ? ctxIdea : null);
      if (b?.id === 'me') { m.status = 'my-reference'; continue; }
      if (idea) {
        m.status = 'reference'; m.ideaId = idea.id; m.refs = idea.references;
        m.how = baseId ? `${label(W, baseId)}'s references` : `you are on ${ctx.name}'s page`;
      } else m.status = 'ask-reference';
    } else {
      m.status = b?.id ? 'relative' : b?.ambiguous ? 'relative-ambiguous' : 'relative-unknown';
    }
  }

  // links between ambiguous names and the shidduchim in the same note
  for (const m of mentions.filter(x => x.status === 'ambiguous')) {
    const relatedSingles = new Set();
    for (const o of mentions) {
      const sid = o.status === 'resolved' && W.byId[o.id]?.roles.includes('single') ? o.id
        : (o.status === 'relative' || o.status === 'reference') && o.base?.id && W.byId[o.base.id]?.roles.includes('single') ? o.base.id : null;
      if (!sid) continue;
      const shares = [...m.items].some(it => o.items.has(it)) || (o.status !== 'resolved' && [...m.items].some(it => mentions.some(x => x.items.has(it) && x.base?.id === sid)));
      if (shares) relatedSingles.add(sid);
    }
    if (!relatedSingles.size && m.items.size === 0) {
      // named only in passing (no activity of its own): the one single in the note decides
      const all = new Set([...singleIdsInMessage(), ...mentions.filter(o => (o.status === 'relative' || o.status === 'reference') && o.base?.id && W.byId[o.base.id]?.roles.includes('single')).map(o => o.base.id)]);
      if (all.size === 1) all.forEach(x => relatedSingles.add(x));
    }
    const viaIdea = m.pool.filter(id => [...relatedSingles].some(sid => W.ideaBySingle[sid]?.suggestedBy.includes(id)));
    if (viaIdea.length === 1) {
      const sid = [...relatedSingles].find(s => W.ideaBySingle[s]?.suggestedBy.includes(viaIdea[0]));
      m.status = 'resolved'; m.id = viaIdea[0]; m.how = `she suggested ${label(W, sid)}`; continue;
    }
    if (ctx && m.pool.includes(ctx.id)) { m.status = 'resolved'; m.id = ctx.id; m.how = `you are on ${ctx.name}'s page`; continue; }
    if (ctxIdea && m.pool.filter(id => ctxIdea.suggestedBy.includes(id)).length === 1) {
      m.status = 'resolved'; m.id = m.pool.find(id => ctxIdea.suggestedBy.includes(id)); m.how = `suggested ${ctxIdea.label}, whose page you are on`; continue;
    }
  }
  // relatives whose base was resolved only now
  for (const m of mentions.filter(x => x.status === 'relative-ambiguous')) {
    const bm = m.base.ambiguous;
    if (bm.status === 'resolved') { m.base = { id: bm.id, how: bm.how }; m.status = 'relative'; }
  }

  // ---- 3. the plan ----
  const actions = [];
  const push = a => { if (!actions.some(x => JSON.stringify(x) === JSON.stringify(a))) actions.push(a); };
  const links = new Set();
  const pending = [];
  const linkPerson = (id) => {
    if (!id || id === 'me') return;
    links.add(id);
    const p = W.byId[id];
    const idea = W.ideaBySingle[id];
    if (p?.roles.includes('single') && idea && ACTIVE(idea.status)) links.add(idea.id);
    for (const i of world.ideas) if (i.references.includes(id) && ACTIVE(i.status)) links.add(i.id);
  };
  const checked = new Set();
  const checkExisting = (id, name, reason) => {
    if (checked.has(id)) return; checked.add(id);
    const idea = W.ideaBySingle[id];
    push({ act: 'check_existing', on: id, name, tier: 'choice',
      text: `Is "${name}" ${label(W, id)}? ${reason || ''}`.trim(),
      detail: idea ? `${idea.label}: ${idea.status === 'ended' ? `ended ${idea.closedAt ? niceDate(idea.closedAt) : ''}` : idea.status}${idea.lastDate ? `, last met ${niceDate(idea.lastDate)}` : ''}` : '' });
  };

  for (const m of mentions) {
    if (m.synthetic && m.status !== 'ambiguous') continue;
    if (m.status === 'resolved') {
      const idea = W.ideaBySingle[m.id];
      if (idea && idea.status === 'ended') {
        const firstNameOnly = nameTokens(m.name).length < 2;
        checkExisting(m.id, m.name, idea.lastDate ? `You met ${niceDate(idea.lastDate).replace(/^\w+, /, '')} ${idea.lastDate.slice(0, 4)} and it ended.` : 'That shidduch ended.');
        if (firstNameOnly) { pending.push(`?${m.name}`); continue; }
      }
      linkPerson(m.id);
    } else if (m.status === 'ambiguous') {
      if (actions.some(a => a.act === 'ask_which' && nameEq(a.name, m.name))) continue;
      push({ act: 'ask_which', name: m.name, options: m.pool, tier: 'choice', text: `Which ${m.name}?`,
        optionDetails: m.pool.map(id => ({ id, label: label(W, id), detail: personDetail(W, id) })) });
      pending.push(`?${m.name}`);
    } else if (m.status === 'new') {
      const role = m.role || ([...m.hints].includes('single') ? 'single' : [...m.hints].includes('go-between') ? 'shadchan' : 'other');
      push({ act: 'new_contact', name: m.name, role, tier: 'confirm',
        text: `Add "${m.name}" as a new contact (${role})${m.why ? ` — not ${label(W, m.lookalike)}: ${m.why}` : ''}`,
        note: 'Only the name as written; no surname, phone or details are added.' });
      pending.push(`+${m.name}`);
    } else if (m.status === 'relative') {
      if (m.base.id === 'me') continue;
      const bp = W.byId[m.base.id];
      const idea = W.ideaBySingle[m.base.id];
      if (idea && idea.status === 'ended') { checkExisting(m.base.id, m.rel.base, 'That shidduch ended.'); pending.push(`?${m.rel.base}`); continue; }
      if (bp) linkPerson(bp.id);
      m.how = `${m.rel.relation} of ${label(W, m.base.id)}${m.base.how ? ` (${m.base.how})` : ''}`;
    } else if (m.status === 'relative-ambiguous') {
      const bm = m.base.ambiguous;
      if (!actions.some(a => a.act === 'ask_which' && nameEq(a.name, bm.name))) {
        push({ act: 'ask_which', name: bm.name, options: bm.pool, tier: 'choice', text: `Which ${bm.name}?`,
          optionDetails: bm.pool.map(id => ({ id, label: label(W, id), detail: personDetail(W, id) })) });
        pending.push(`?${bm.name}`);
      }
    } else if (m.status === 'reference') {
      links.add(m.ideaId);
      if (m.refs.length === 1) links.add(m.refs[0]);
    } else if (m.status === 'ask-reference') {
      const opts2 = world.ideas.filter(i => ACTIVE(i.status));
      push({ act: 'ask_which', name: 'reference', question: 'Whose reference?', options: opts2.map(i => i.id), tier: 'choice',
        text: 'Whose reference?', optionDetails: opts2.map(i => ({ id: i.id, label: `${i.label}'s references`, detail: i.references.length ? i.references.map(r => label(W, r)).join(', ') : 'none saved' })) });
      pending.push('?reference');
    } else if (m.status === 'my-reference') {
      // "my reference" — one of my own references, no shidduch link
    }
  }

  // dates with no name ("We had our second date") → the shidduch in progress
  for (const e of ir.events) {
    if (e.type !== 'date' || e.negated) continue;
    const named = [e.with, e.about].filter(Boolean).map(n => mentions.find(m => nameEq(m.name, n))).filter(m => m && m.status === 'resolved');
    let idea = named.map(m => W.ideaBySingle[m.id]).find(Boolean);
    let how = null;
    if (!idea && !named.length) {
      if (ctxIdea) { idea = ctxIdea; how = `you are on ${ctx.name}'s page`; }
      else {
        const dating = world.ideas.filter(i => i.status === 'dating');
        if (dating.length === 1) { idea = dating[0]; how = 'your only shidduch in progress'; }
      }
      if (idea) mentions.push({ name: e.with || 'we', status: 'resolved', id: idea.single, how, hints: new Set(), items: new Set() });
    }
    if (idea) {
      linkPerson(idea.single);
      const when = resolveWhen(e.when, today);
      push({ act: 'date_logged', idea: idea.id, on: idea.id, tier: 'auto', when: when.date,
        text: `Date with ${label(W, idea.single)}${when.date ? ` (${niceDate(when.date)})` : ''} — date ${idea.dates + 1}${how ? ` · ${how}` : ''}` });
    }
  }

  // nothing named but typed on someone's page → it belongs there
  if (!links.size && !pending.length && ctx) { linkPerson(ctx.id); }

  const resolvedOf = (name) => {
    if (!name) return null;
    if (isMe(name)) return { me: true };
    const m = mentions.find(x => nameEq(x.name, name) || x.name.toLowerCase() === name.toLowerCase());
    if (!m) return null;
    if (m.status === 'resolved') return { id: m.id };
    if (m.status === 'relative') return { id: m.base.id, relative: true };
    if (m.status === 'reference') return { ideaId: m.ideaId, refs: m.refs, reference: true };
    if (m.status === 'ambiguous') return { pending: `?${m.name}` };
    if (m.status === 'relative-ambiguous') return { pending: `?${m.base.ambiguous.name}` };
    if (m.status === 'ask-reference') return { pending: '?reference' };
    if (m.status === 'new') return { pending: `+${m.name}`, isNew: true };
    if (m.status === 'pronoun') {
      const singles = singleIdsInMessage();
      if (ctx) return { id: ctx.id };
      if (singles.length === 1) return { id: singles[0] };
    }
    return null;
  };

  // answers
  const activeIdeas = world.ideas.filter(i => ACTIVE(i.status));
  for (const a of ir.answers) {
    let idea = null, side = 'them';
    if (isMe(a.of)) {
      side = 'me';
      const r = resolvedOf(a.about);
      if (r?.id) idea = W.ideaBySingle[r.id];
      if (!idea && !a.about) {
        const linked = [...links].filter(x => W.ideaById[x]);
        if (linked.length === 1) idea = W.ideaById[linked[0]];
        else if (ctxIdea) idea = ctxIdea;
      }
    } else {
      const r = resolvedOf(a.of);
      if (r?.id) idea = W.ideaBySingle[r.id];
      if (r?.pending) { push({ act: 'info', tier: 'info', text: `${a.of}'s answer (${a.value}) — kept in the note until you choose who it is` }); continue; }
    }
    if (!idea || !ACTIVE(idea.status)) {
      push({ act: 'ask_which', name: a.about || a.of || 'shidduch', question: 'Which shidduch?', options: activeIdeas.map(i => i.id), tier: 'choice',
        text: `Which shidduch is "${side === 'me' ? 'my' : a.of + "'s"} answer: ${a.value}" about?`,
        optionDetails: activeIdeas.map(i => ({ id: i.id, label: i.label, detail: i.status })) });
      continue;
    }
    const src = a.source ? resolvedOf(a.source) : null;
    const srcLabel = a.source ? (src?.id && !src.relative ? label(W, src.id) : a.source) : null; // "Rivka's mother" stays as written
    if (a.value === 'more_info') {
      push({ act: 'info', tier: 'info', idea: idea.id, text: `${label(W, idea.single)}'s side wants more information${srcLabel ? ` (via ${srcLabel})` : ''} — noted in history, no answer changed` });
      continue;
    }
    const current = idea.answers[side];
    if (current === a.value) { push({ act: 'info', tier: 'info', idea: idea.id, text: `Already recorded: ${side === 'me' ? 'my' : label(W, idea.single) + "'s"} answer is ${a.value}` }); continue; }
    push({ act: 'answer', idea: idea.id, on: idea.id, side, value: a.value, from: current, source: src?.id || a.source || null, tier: 'confirm',
      text: `${side === 'me' ? 'My answer' : `${label(W, idea.single)}'s answer`}: ${current || 'none'} → ${a.value}${srcLabel ? ` (reported by ${srcLabel})` : ''}` });
    const next = { ...idea.answers, [side]: a.value };
    if (a.value === 'yes' && next.me === 'yes' && next.them === 'yes' && idea.status !== 'dating')
      push({ act: 'stage', idea: idea.id, on: idea.id, to: 'dating', tier: 'confirm', text: `Move ${idea.label} to In progress (both said yes)` });
    if (a.value === 'no' && idea.status !== 'ended')
      push({ act: 'stage', idea: idea.id, on: idea.id, to: 'ended', tier: 'confirm', text: `Close ${idea.label} (answer: no)` });
  }

  // tasks → reminders
  const singleTarget = () => {
    const ids = [...links];
    const ideas = ids.filter(x => W.ideaById[x]);
    if (ideas.length === 1) return ideas[0];
    const persons = ids.filter(x => W.byId[x]);
    return persons.length === 1 ? persons[0] : null;
  };
  for (const t of ir.tasks) {
    let on = null, pend = null, how = '';
    const r = t.who ? resolvedOf(t.who) : null;
    if (r?.reference) { on = r.ideaId; how = 'references'; }
    else if (r?.id) { const idea = W.ideaBySingle[r.id]; on = idea && ACTIVE(idea.status) && W.byId[r.id].roles.includes('single') ? idea.id : r.id; }
    else if (r?.pending) pend = r.pending;
    else if (!t.who || isMe(t.who) || isPronoun(t.who)) on = singleTarget() || ctxIdea?.id || ctx?.id || null;
    const due = resolveWhen(t.when, today);
    const date = due.past ? null : due.date;
    const exact = date && !due.approx;
    const target = on ? label(W, on) : pend ? pend.slice(1) : null;
    push({ act: 'reminder', on: on || pend, due: date, approx: !!due.approx, what: t.what || 'follow up',
      tier: on && exact ? 'auto' : 'choice',
      text: `Reminder: ${t.what || 'follow up'}${target ? ` — ${target}${how === 'references' ? ' (references)' : ''}` : ''} · ${date ? (due.approx ? `around ${niceDate(date)} — check the day` : niceDate(date)) : 'no date given — pick a day'}` });
  }

  // waiting for someone
  for (const w of ir.waiting) {
    const r = resolvedOf(w.who);
    const on = r?.id || (r?.reference ? r.ideaId : null);
    const pend = r?.pending || null;
    const due = resolveWhen(w.when, today);
    push({ act: 'waiting', on: on || pend, due: due.past ? null : due.date, tier: on ? 'auto' : 'choice',
      text: `Waiting for ${on ? label(W, on) : w.who}${w.what ? ` to ${w.what}` : ''}${due.date && !due.past ? ` · expected ${due.approx ? 'around ' : ''}${niceDate(due.date)}` : ''}` });
  }

  // events with their own filing
  for (const e of ir.events) {
    if (e.negated) { push({ act: 'not_recorded', tier: 'info', text: `Not recorded as done: ${e.type.replace('_', ' ')}${e.actor ? ` by ${e.actor}` : ''}${e.about ? ` about ${e.about}` : ''} (the note says it didn't happen / not yet)` }); continue; }
    if (e.type === 'profile_sent' && (!e.actor || isMe(e.actor))) {
      const r = resolvedOf(e.with);
      if (r?.id) push({ act: 'profile_sent', on: r.id, tier: 'auto', text: `My profile → sent to ${label(W, r.id)}` });
    }
    if (['suggestion', 'profile_received'].includes(e.type) && e.about) {
      const r = resolvedOf(e.about);
      const idea = r?.id ? W.ideaBySingle[r.id] : null;
      if (idea && ACTIVE(idea.status)) {
        push({ act: 'existing_idea', idea: idea.id, on: idea.id, tier: 'info',
          text: `Already in your shidduchim: ${idea.label} (suggested by ${idea.suggestedBy.map(id => label(W, id)).join(', ')}, ${niceDate(idea.suggestedAt)}) — filed there, no duplicate` });
      }
    }
  }
  for (const u of ir.uncertain) push({ act: 'not_recorded', tier: 'info', text: `Left open: ${u}` });

  const on = [...links, ...pending];
  if (on.length) actions.unshift({ act: 'history', on, tier: 'auto',
    text: `History entry (the note as written) → ${on.map(x => x[0] === '?' ? `${x.slice(1)} (after you choose)` : x[0] === '+' ? `${x.slice(1)} (new)` : label(W, x)).join(', ')}` });
  else if (!actions.some(a => a.act === 'reminder' && a.on)) actions.unshift({ act: 'memo', tier: 'auto', text: 'Memo (no person named) — saved to Memos' });

  const order = { auto: 0, choice: 1, confirm: 2, info: 3 };
  actions.sort((a, b) => order[a.tier] - order[b.tier]);
  return {
    original: text,
    mentions: mentions.filter(m => !m.synthetic || m.status === 'ambiguous').map(m => ({
      name: m.name, role: m.role, status: m.status, id: m.id || m.base?.id || m.ideaId || null,
      label: m.id ? label(W, m.id) : m.base?.id && m.base.id !== 'me' ? label(W, m.base.id) : m.ideaId ? label(W, m.ideaId) : null,
      how: m.how || m.why || null, relation: m.rel?.relation || null, options: m.pool || null
    })),
    actions,
    counts: Object.fromEntries(['auto', 'choice', 'confirm', 'info'].map(t => [t, actions.filter(a => a.tier === t).length])),
    problems: ir.problems
  };
}

/** One plain line per item: what the engine understood (no filing). */
export function describe(irIn) {
  const ir = normalizeIR(irIn);
  const who = n => (n == null ? '' : isMe(n) ? 'I' : n);
  const lines = [];
  for (const e of ir.events) {
    const verb = { call: 'call', message: 'message', meeting: 'met', date: 'date', suggestion: 'suggested', effort: 'worked on it',
      profile_sent: 'sent profile', profile_received: 'got profile', reference_check: 'reference check', request: 'asked',
      promise: 'promised', note: 'note' }[e.type];
    lines.push(`${e.negated ? 'NOT / not yet: ' : ''}${[who(e.actor), verb, e.with ? `with ${who(e.with)}` : '', e.about ? `about ${e.about}` : '',
      e.count != null ? `×${e.count}` : '', e.result ? `→ ${e.result}` : '', e.when ? `(${e.when})` : ''].filter(Boolean).join(' ')}`);
  }
  for (const a of ir.answers) lines.push(`${isMe(a.of) ? 'My' : `${a.of}'s`} answer${a.about ? ` about ${a.about}` : ''}: ${a.value}${a.source ? ` (told by ${a.source})` : ''}`);
  for (const t of ir.tasks) lines.push(`To do: ${t.what || 'follow up'}${t.who ? ` — ${who(t.who)}` : ''}${t.when ? ` (${t.when})` : ' (no time given)'}`);
  for (const w of ir.waiting) lines.push(`Waiting for ${w.who}${w.what ? ` to ${w.what}` : ''}${w.when ? ` (${w.when})` : ''}`);
  return lines;
}
