// The lab page. Engines A and B run in the local Python server; Engine C runs right here.
import { plan, describe, normalizeIR } from './planner.js';
import { rulesInterpret } from './engine_c.js';
import { niceDate, toISO } from './dates.js';
import { summarize } from './score.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const today = toISO(new Date());
let world, devSet, holdSet, status = null;
let engine = 'ALL';
const ENGINE_NAMES = { A: 'Engine A · GLiNER2.5', B: 'Engine B · small language model', C: 'Engine C · no AI' };

async function getJSON(url, opts) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok && !j.error) j.error = `HTTP ${r.status}`;
  return j;
}

// ---------------- setup ----------------
async function init() {
  [world, devSet, holdSet] = await Promise.all(['/web/world.json', '/web/cases.json', '/web/holdout.json'].map(u => getJSON(u)));
  renderWorld();
  renderExamples();
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('.tabpane').forEach(p => p.classList.toggle('on', p.id === `tab-${b.dataset.tab}`));
  });
  document.querySelectorAll('.eng').forEach(b => b.onclick = () => setEngine(b.dataset.eng));
  setEngine(localGet('engine') || 'ALL');
  $('#analyze').onclick = () => analyzeNow();
  $('#note').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) analyzeNow(); });
  let t; $('#note').addEventListener('input', () => { clearTimeout(t); t = setTimeout(liveC, 120); });
  $('#context').onchange = liveC;
  $('#randomEx').onclick = () => {
    const pool = [...devSet.cases.filter(c => c.set === 'unseen'), ...holdSet.cases].filter(c => c.cat !== 'M');
    const c = pool[Math.floor(Math.random() * pool.length)];
    useExample(c);
  };
  $('#loadSaved').onclick = loadSaved;
  $('#runLive').onclick = runLive;
  $('#benchSet').onchange = () => { $('#benchSummary').innerHTML = ''; $('#benchRows').innerHTML = ''; };
  await refreshStatus();
  setInterval(refreshStatus, 15000);
}

function localGet(k) { try { return localStorage.getItem('lab.' + k); } catch { return null; } }
function localSet(k, v) { try { localStorage.setItem('lab.' + k, v); } catch { /* private mode */ } }

function setEngine(e) {
  engine = e; localSet('engine', e);
  document.querySelectorAll('.eng').forEach(b => { b.classList.toggle('on', b.dataset.eng === e); b.setAttribute('aria-checked', b.dataset.eng === e); });
}

async function refreshStatus() {
  const s = await getJSON('/api/status').catch(() => null);
  if (!s || s.error) { $('#status').innerHTML = '<span class="bad">Local server not reachable</span> — Engine C still works.'; return; }
  status = s;
  const have = k => s.engines[k].filter(m => m.downloaded);
  const conn = s.outside_connections;
  $('#status').innerHTML = `${s.offline ? '<span class="ok">Offline mode</span>' : 'Online mode'} · ` +
    `${conn == null ? '' : conn === 0 ? '<span class="ok">0 outside connections</span> · ' : `<span class="bad">${conn} outside connections</span> · `}` +
    `A: ${have('A').length ? have('A').map(m => m.id).join(', ') : '<span class="bad">no model</span>'} · ` +
    `B: ${have('B').length ? have('B').map(m => m.id).join(', ') : '<span class="bad">no model</span>'}`;
  for (const k of ['A', 'B']) {
    const sel = $(`#model${k}`);
    const cur = sel.value || localGet(`model${k}`);
    sel.innerHTML = s.engines[k].map(m => `<option value="${m.id}" ${m.downloaded ? '' : 'disabled'}>${esc(m.label)}${m.downloaded ? ` · ${m.size_mb} MB` : ' (not downloaded)'}</option>`).join('');
    const pick = s.engines[k].find(m => m.id === cur && m.downloaded) || s.engines[k].find(m => m.downloaded && m.default) || s.engines[k].find(m => m.downloaded);
    if (pick) sel.value = pick.id;
    sel.onchange = () => localSet(`model${k}`, sel.value);
    $(`#lbl${k}`).textContent = pick ? pick.label : 'model not downloaded';
  }
}

function renderWorld() {
  const role = p => p.roles.join(', ');
  $('#people').innerHTML = world.people.map(p => `<li><b>${esc(p.title ? p.title + ' ' : '')}${esc(p.name)}</b> <small>${esc(role(p))} · ${esc(p.city)}${p.note ? ' · ' + esc(p.note) : ''}</small></li>`).join('');
  const nm = id => world.people.find(p => p.id === id)?.name || id;
  $('#ideas').innerHTML = world.ideas.map(i => `<li><b>${esc(i.label)}</b> <small>${esc(i.status)} · via ${esc(i.suggestedBy.map(nm).join(', '))} · my answer: ${esc(i.answers.me ?? '—')} · their answer: ${esc(i.answers.them ?? '—')}${i.references.length ? ' · references: ' + esc(i.references.map(nm).join(', ')) : ''}</small></li>`).join('');
  $('#context').innerHTML = `<option value="">Home (no page open)</option>` + world.people.map(p => `<option value="${p.id}">${esc(p.name)}'s page</option>`).join('');
}

function renderExamples() {
  const given = devSet.cases.filter(c => c.set === 'given' || (c.set === 'unseen' && /^[CDFHJU]\d$/.test(c.id) && ['C6', 'D6', 'F5', 'H4', 'J5', 'U1', 'U2'].includes(c.id)));
  const cats = { A: 'Talk', B: 'Reminder', C: 'Effort', D: 'Answer', E: 'Waiting', F: 'New', G: 'History', H: 'Reference', I: 'Several people', J: 'Several things', K: 'Ambiguous', L: 'Not yet', U: 'Other' };
  $('#examples').innerHTML = given.map(c => `<button class="chip" data-id="${c.id}"><b>${esc(cats[c.cat] || c.cat)}</b>${esc(c.text)}</button>`).join('')
    + `<button class="chip" data-id="M2"><b>Hebrew</b>${esc(devSet.cases.find(c => c.id === 'M2').text)}</button>`
    + `<button class="chip" data-id="M5"><b>Russian</b>${esc(devSet.cases.find(c => c.id === 'M5').text)}</button>`;
  $('#examples').querySelectorAll('.chip').forEach(b => b.onclick = () => useExample([...devSet.cases, ...holdSet.cases].find(c => c.id === b.dataset.id)));
}

function useExample(c) {
  $('#note').value = c.text;
  $('#context').value = c.context || '';
  analyzeNow();
}

// ---------------- analyze ----------------
const selectedEngines = () => (engine === 'ALL' ? ['A', 'B', 'C'] : [engine]);

function runC(text) {
  const t0 = performance.now();
  const { ir, spans } = rulesInterpret(text, world);
  return { engine: 'C', model_label: 'rules + your contacts (no AI)', ir, spans, raw: ir, ms: +(performance.now() - t0).toFixed(2) };
}

function liveC() {
  if (!selectedEngines().includes('C')) return;
  const text = $('#note').value.trim();
  if (!text) return;
  const slot = ensureSlots(selectedEngines()).C;
  renderCard(slot, runC(text), text);
}

function ensureSlots(engs) {
  const box = $('#results');
  const want = engs.join(',');
  if (box.dataset.engs !== want) {
    box.dataset.engs = want;
    box.innerHTML = engs.map(e => `<div class="res" id="res-${e}"></div>`).join('');
  }
  return Object.fromEntries(engs.map(e => [e, $(`#res-${e}`)]));
}

async function analyzeNow() {
  const text = $('#note').value.trim();
  if (!text) { $('#note').focus(); return; }
  const engs = selectedEngines();
  const slots = ensureSlots(engs);
  $('#analyze').disabled = true;
  const jobs = engs.map(async e => {
    if (e === 'C') return renderCard(slots.C, runC(text), text);
    slots[e].innerHTML = `<h3>${ENGINE_NAMES[e]}</h3><div class="meta">Thinking… (the first run also loads the model)</div>`;
    const res = await getJSON('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine: e, text, model: $(`#model${e}`).value || null }) }).catch(err => ({ error: String(err) }));
    renderCard(slots[e], { engine: e, ...res }, text);
  });
  await Promise.all(jobs);
  $('#analyze').disabled = false;
  refreshStatus();
}

function highlight(text, res) {
  let marks = [];
  if (res.spans) marks = res.spans.map(s => ({ ...s }));
  else if (res.engine === 'A' && res.raw?.entities) {
    for (const [lab, list] of Object.entries(res.raw.entities)) for (const x of list || [])
      if (x && x.start != null) marks.push({ start: x.start, end: x.end, kind: lab === 'time' ? 'time' : 'person', label: x.role?.label?.split(': ').pop() || lab });
  } else if (res.ir) {
    const ir = normalizeIR(res.ir);
    const find = (needle, kind, label) => {
      if (!needle) return; const i = text.toLowerCase().indexOf(String(needle).toLowerCase());
      if (i >= 0) marks.push({ start: i, end: i + needle.length, kind, label });
    };
    ir.people.forEach(p => find(p.name, 'person', p.role));
    [...ir.tasks, ...ir.waiting, ...ir.events].forEach(x => find(x.when, 'time', 'time'));
  }
  marks = marks.filter(m => m.end > m.start).sort((a, b) => a.start - b.start || b.end - a.end);
  let out = '', pos = 0;
  for (const m of marks) {
    if (m.start < pos) continue;
    out += esc(text.slice(pos, m.start)) + `<mark class="${m.kind}">${esc(text.slice(m.start, m.end))}<small>${esc(m.label || '')}</small></mark>`;
    pos = m.end;
  }
  return out + esc(text.slice(pos));
}

const TIER = { auto: 'Saved with one tap', choice: 'Needs a choice', confirm: 'Needs your OK', info: 'Just so you know' };

function renderCard(el, res, text) {
  const head = `<h3>${ENGINE_NAMES[res.engine]}</h3>`;
  const meta = [res.model_label, res.ms != null ? `${res.ms < 10 ? res.ms : Math.round(res.ms)} ms` : null,
    res.ram_mb ? `${res.ram_mb} MB RAM` : null, res.gen_tps ? `${res.gen_tps} tokens/s` : null,
    res.load_seconds ? `model load ${res.load_seconds}s` : null].filter(Boolean).join(' · ');
  if (res.error && !res.ir) {
    el.innerHTML = `${head}<div class="meta">${esc(meta)}</div><div class="err">The engine failed:\n${esc(res.error)}</div>` +
      (res.raw ? `<details><summary>What the model actually returned</summary><pre>${esc(typeof res.raw === 'string' ? res.raw : JSON.stringify(res.raw, null, 1))}</pre></details>` : '');
    return;
  }
  const p = plan(res.ir, world, { text, context: $('#context').value || null, today });
  const lines = describe(res.ir);
  const people = p.mentions.filter(m => m.status !== 'me').map(m => {
    const to = m.status === 'resolved' ? `→ ${esc(m.label)}` : m.status === 'ambiguous' ? `→ which? (${m.options.length} match)` :
      m.status === 'new' ? '→ new person' : m.status === 'relative' ? `→ ${esc(m.relation)} of ${esc(m.label)}` :
      m.status === 'reference' ? `→ ${esc(m.label)}` : m.status === 'group' ? '→ a group, not a person' :
      m.status === 'pronoun' ? '→ (pronoun)' : `→ ${esc(m.status)}`;
    return `<div class="pp ${m.status}"><span>${esc(m.name)}</span><span class="role">${esc(m.role || '')}</span><span class="to">${to}</span>${m.how ? `<span class="how">${esc(m.how)}</span>` : ''}</div>`;
  }).join('') || '<span class="hint">No people found.</span>';
  const acts = ['auto', 'choice', 'confirm', 'info'].map(t => {
    const list = p.actions.filter(a => a.tier === t);
    if (!list.length) return '';
    return `<div><span class="tier ${t}">${TIER[t]}</span><div class="acts">${list.map(a => `<div class="act ${t}">${esc(a.text)}${
      a.optionDetails ? `<div class="opts">${a.optionDetails.map(o => `<button>${esc(o.label)}<small>${esc(o.detail)}</small></button>`).join('')}${a.act === 'ask_which' && a.name !== 'reference' && !a.question ? '<button>Someone new</button>' : ''}</div>` : ''}${
      a.act === 'answer' || a.act === 'stage' || a.act === 'new_contact' ? `<div class="opts"><button>OK</button><button>Not now</button></div>` : ''}${
      a.act === 'check_existing' ? `<div class="opts"><button>Yes, same person</button><button>No, someone else</button></div>` : ''}${
      a.act === 'reminder' && a.tier === 'choice' ? `<div class="opts"><button>Today</button><button>Tomorrow</button><button>Pick a day</button><button>No reminder</button></div>` : ''}</div>`).join('')}</div></div>`;
  }).join('');
  el.innerHTML = `${head}<div class="meta">${esc(meta)}</div>
    ${res.error ? `<div class="err">${esc(res.error)}</div>` : ''}
    <div class="sec"><b>In the note</b><div class="hl">${highlight(text, res)}</div></div>
    <div class="sec"><b>What it understood</b>${lines.length ? `<ul class="understood">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '<span class="hint">Nothing.</span>'}</div>
    <div class="sec"><b>People and who they are</b><div class="people">${people}</div></div>
    <div class="sec"><b>Where it goes</b>${acts}</div>
    <button class="save" title="The lab never saves anything">Save — ${p.counts.auto} item${p.counts.auto === 1 ? '' : 's'} with one tap${p.counts.choice ? ` · ${p.counts.choice} choice` : ''}${p.counts.confirm ? ` · ${p.counts.confirm} to OK` : ''}</button>
    ${p.problems.length ? `<div class="sec"><b>Output problems</b><div class="err">${esc(p.problems.join('\n'))}</div></div>` : ''}
    <details><summary>What the model actually returned</summary><pre>${esc(typeof res.raw === 'string' ? res.raw : JSON.stringify(res.raw, null, 1))}</pre></details>
    <details><summary>Interpretation and filing plan (JSON)</summary><pre>${esc(JSON.stringify({ interpretation: res.ir, plan: p }, null, 1))}</pre></details>`;
}

// ---------------- benchmark ----------------
const benchData = () => ($('#benchSet').value === 'holdout.json' ? holdSet : devSet);

async function loadSaved() {
  const files = await getJSON('/api/results');
  if (!Array.isArray(files)) { $('#benchSummary').innerHTML = `<div class="err">${esc(files.error || 'no results')}</div>`; return; }
  const hold = $('#benchSet').value === 'holdout.json';
  const mine = files.filter(f => hold ? /-holdout\.jsonl$/.test(f) : !/-holdout\.jsonl$/.test(f));
  const sets = [];
  for (const f of mine) {
    const txt = await (await fetch(`/bench/results/${f}`)).text();
    const results = txt.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
    sets.push({ name: f.replace(/(-holdout)?\.jsonl$/, ''), results });
  }
  showBench(sets);
}

async function runLive() {
  const data = benchData();
  const engs = ['A', 'B', 'C'].filter(e => $(`#live${e}`).checked);
  const sets = engs.map(e => ({ name: e === 'C' ? 'C-rules' : `${e}-${$(`#model${e}`).value}`, engine: e, results: [] }));
  $('#runLive').disabled = true;
  let i = 0;
  for (const c of data.cases) {
    i++;
    $('#benchProgress').textContent = `${i}/${data.cases.length} — ${c.text.slice(0, 50)}`;
    for (const s of sets) {
      if (s.engine === 'C') { const r = runC(c.text); s.results.push({ id: c.id, ir: r.ir, ms: r.ms }); continue; }
      const r = await getJSON('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine: s.engine, text: c.text, model: $(`#model${s.engine}`).value || null }) }).catch(err => ({ error: String(err) }));
      s.results.push({ id: c.id, ir: r.ir || null, ms: r.ms ?? null, error: r.ir ? null : r.error, ram_mb: r.ram_mb });
    }
    if (i % 5 === 0 || i === data.cases.length) showBench(sets);
  }
  $('#benchProgress').textContent = 'Done.';
  $('#runLive').disabled = false;
}

function showBench(sets) {
  const data = benchData();
  const S = sets.map(s => ({ name: s.name, sum: summarize(data.cases, s.results, world, data.today) }));
  const part = data === holdSet ? 'holdout' : 'english';
  const cols = [['understoodFully', 'Understood fully'], ['activity', 'Activity type'], ['peopleRoles', 'People & roles'],
    ['negation', 'Negation / "not yet"'], ['reminders', 'Reminders & waiting'], ['noFalseReminder', 'No unrequested reminder'],
    ['multiple', 'Several items'], ['source', 'Who reported it'], ['casesWithInvented', 'Notes with invented facts'],
    ['filedRight', 'Filed right'], ['oneTap', 'Filed right with one tap'], ['avgTaps', 'Taps per note'],
    ['blameEngine', 'Wrong: engine'], ['blameFiling', 'Wrong: filing rules'], ['medianMs', 'Median ms'], ['crashes', 'Crashes']];
  const fmt = (k, v) => (v == null ? '—' : ['avgTaps', 'blameEngine', 'blameFiling', 'medianMs', 'crashes'].includes(k) ? v : `${v}%`);
  $('#benchSummary').innerHTML = `<h3>${data === holdSet ? 'Holdout set' : 'Development set (English)'} — ${S[0]?.sum[part].n ?? 0} notes</h3>
    <div class="tablewrap"><table><tr><th></th>${S.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr>${cols.map(([k, l]) =>
      `<tr><td>${l}</td>${S.map(s => `<td class="num">${fmt(k, s.sum[part][k])}</td>`).join('')}</tr>`).join('')}
      ${data === devSet ? `<tr><td>Hebrew/Russian filed right (6)</td>${S.map(s => `<td class="num">${fmt('x', s.sum.multilingual.filedRight)}</td>`).join('')}</tr>` : ''}</table></div>`;
  const ids = data.cases.map(c => c.id);
  $('#benchRows').innerHTML = `<h3>Every note</h3><div class="tablewrap"><table><tr><th>Note</th>${S.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr>${ids.map(id => {
    const c = data.cases.find(x => x.id === id);
    return `<tr><td><b>${id}</b> ${esc(c.text)}</td>${S.map(s => {
      const r = s.sum.rows.find(x => x.id === id);
      if (!r) return '<td>—</td>';
      if (!r.s) return `<td class="no">crashed<div class="notes">${esc((r.error || '').slice(0, 120))}</div></td>`;
      const notes = [...r.s.interp.notes, ...r.s.interp.invented.map(x => 'invented: ' + x), ...r.s.filing.missing.map(m => 'missing: ' + m.act + (m.on ? ' ' + m.on : '')), ...r.s.filing.violated.map(m => 'wrong: ' + m.act + (m.on ? ' ' + m.on : ''))];
      return `<td><span class="${r.s.interp.allOK ? 'ok' : 'no'}">${r.s.interp.allOK ? '✓' : '✗'} understood</span><br><span class="${r.s.filing.ok ? 'ok' : 'no'}">${r.s.filing.ok ? '✓' : '✗'} filed</span>${r.blame && !r.s.filing.ok ? ` <small>(${esc(r.blame)})</small>` : ''}${notes.length ? `<div class="notes">${esc(notes.slice(0, 4).join(' · '))}</div>` : ''}</td>`;
    }).join('')}</tr>`;
  }).join('')}</table></div>`;
}

init();
