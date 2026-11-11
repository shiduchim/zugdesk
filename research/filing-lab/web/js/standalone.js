// The one-file version of the lab. Everything (rules, test notes, contacts, the browser AI runtime)
// is inside the HTML file. Engines A and B download their model once on first use.
import { plan, describe, normalizeIR } from './planner.js';
import { rulesInterpret } from './engine_c.js';
import { toISO } from './dates.js';
import { summarize } from './score.js';
import { BROWSER_MODELS, BrowserLLM, GpuMemoryError, modelInfo, webgpuStatus } from './engine_webllm.js';
import { WORLD as world, DEV as devSet, HOLD as holdSet, SAVED } from './data.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const today = toISO(new Date());
let engine = 'ALL';
let gpu = null;
const llms = {};
const ENGINE_NAMES = { A: 'Engine A · tiny AI model', B: 'Engine B · small AI model', C: 'Engine C · no AI' };

function store(k, v) { try { if (v === undefined) return localStorage.getItem('zmlab.' + k); localStorage.setItem('zmlab.' + k, v); } catch { return null; } }

// ---------------- setup ----------------
async function init() {
  renderWorld();
  renderExamples();
  for (const k of ['A', 'B']) {
    const sel = $(`#model${k}`);
    sel.innerHTML = BROWSER_MODELS.map(m => { const i = modelInfo(m.id); return `<option value="${m.id}" ${i.available ? '' : 'disabled'}>${esc(m.label)} · ${esc(m.download.replace('≈ ', ''))}</option>`; }).join('');
    const saved = store(`model${k}`);
    sel.value = BROWSER_MODELS.some(m => m.id === saved) ? saved : BROWSER_MODELS.find(m => m.defaultFor === k).id;
    sel.onchange = () => { store(`model${k}`, sel.value); labelEngines(); };
  }
  labelEngines();
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => showTab(b.dataset.tab));
  document.querySelectorAll('.eng').forEach(b => b.onclick = () => setEngine(b.dataset.eng));
  setEngine(store('engine') || 'ALL');
  $('#analyze').onclick = analyzeNow;
  $('#note').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) analyzeNow(); });
  let t; $('#note').addEventListener('input', () => { clearTimeout(t); t = setTimeout(liveC, 120); });
  $('#context').onchange = liveC;
  $('#randomEx').onclick = () => {
    const pool = [...devSet.cases.filter(c => c.set === 'unseen'), ...holdSet.cases].filter(c => c.cat !== 'M');
    useExample(pool[Math.floor(Math.random() * pool.length)]);
  };
  $('#loadSaved').onclick = () => showBench(savedSets());
  $('#runLive').onclick = runLive;
  $('#unload').onclick = async () => { for (const k of Object.keys(llms)) { await llms[k].unload(); delete llms[k]; } status(); };
  $('#benchSet').onchange = () => showBench(savedSets());
  if (location.hash === '#bench') showTab('bench');
  gpu = await webgpuStatus();
  status();
  useExample(devSet.cases.find(c => c.id === 'D1'), false);
  showBench(savedSets());
}

function showTab(name) {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.dataset.tab === name));
  document.querySelectorAll('.tabpane').forEach(p => p.hidden = p.id !== `tab-${name}`);
}

function labelEngines() {
  for (const k of ['A', 'B']) $(`#lbl${k}`).textContent = modelInfo($(`#model${k}`).value).label;
}

function status() {
  const loaded = Object.values(llms).filter(l => l.engine).map(l => modelInfo(l.id).label);
  $('#status').innerHTML = (gpu?.ok ? `<span class="ok">AI ready to run on this computer</span> (${esc(gpu.adapter)})` : `<span class="bad">AI engines unavailable here</span>: ${esc(gpu?.why || 'checking…')} Engine C still works.`)
    + ` · Loaded: ${loaded.length ? esc(loaded.join(', ')) : 'none'}`;
}

function setEngine(e) {
  engine = e; store('engine', e);
  document.querySelectorAll('.eng').forEach(b => { b.classList.toggle('on', b.dataset.eng === e); b.setAttribute('aria-checked', String(b.dataset.eng === e)); });
}

function renderWorld() {
  const nm = id => world.people.find(p => p.id === id)?.name || id;
  $('#people').innerHTML = world.people.map(p => `<li><b>${esc(p.title ? p.title + ' ' : '')}${esc(p.name)}</b><small>${esc(p.roles.join(', '))} · ${esc(p.city)}${p.note ? ' · ' + esc(p.note) : ''}</small></li>`).join('');
  $('#ideas').innerHTML = world.ideas.map(i => `<li><b>${esc(i.label)}</b><small>${esc(i.status)} · via ${esc(i.suggestedBy.map(nm).join(', '))} · my answer: ${esc(i.answers.me ?? '—')} · their answer: ${esc(i.answers.them ?? '—')}${i.references.length ? ' · references: ' + esc(i.references.map(nm).join(', ')) : ''}</small></li>`).join('');
  $('#context').innerHTML = `<option value="">Home (no page open)</option>` + world.people.map(p => `<option value="${p.id}">${esc(p.name)}'s page</option>`).join('');
}

function renderExamples() {
  const ids = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1', 'L1', 'C6', 'F5', 'H4', 'U1', 'U2', 'J5'];
  const cats = { A: 'Talk', B: 'Reminder', C: 'Effort', D: 'Answer', E: 'Waiting', F: 'New person', G: 'History', H: 'Reference', I: 'Several people', J: 'Several things', K: 'Ambiguous', L: 'Not yet', U: 'Other' };
  const list = ids.map(id => devSet.cases.find(c => c.id === id)).filter(Boolean);
  $('#examples').innerHTML = list.map(c => `<button class="chip" data-id="${c.id}"><b>${esc(cats[c.cat] || c.cat)}</b> ${esc(c.text)}</button>`).join('')
    + ['M2', 'M5'].map(id => { const c = devSet.cases.find(x => x.id === id); return `<button class="chip" data-id="${id}"><b>${c.lang === 'he' ? 'Hebrew' : 'Russian'}</b> <span dir="auto">${esc(c.text)}</span></button>`; }).join('');
  $('#examples').querySelectorAll('.chip').forEach(b => b.onclick = () => useExample([...devSet.cases, ...holdSet.cases].find(c => c.id === b.dataset.id)));
}

function useExample(c, run = true) {
  $('#note').value = c.text;
  $('#context').value = c.context || '';
  if (run) analyzeNow(); else liveC(true);
}

// ---------------- analyze ----------------
const selectedEngines = () => (engine === 'ALL' ? ['A', 'B', 'C'] : [engine]);

function runC(text) {
  const t0 = performance.now();
  const { ir, spans } = rulesInterpret(text, world);
  return { engine: 'C', model_label: 'rules + your contacts (no AI)', ir, spans, raw: ir, ms: +(performance.now() - t0).toFixed(2) };
}

function liveC(force) {
  if (!force && !selectedEngines().includes('C')) return;
  const text = $('#note').value.trim();
  if (!text) return;
  const engs = force ? ['C'] : selectedEngines();
  const slot = ensureSlots(engs).C;
  if (slot) renderCard(slot, runC(text), text);
}

function ensureSlots(engs) {
  const box = $('#results');
  const want = engs.join(',');
  if (box.dataset.engs !== want) {
    box.dataset.engs = want;
    box.innerHTML = engs.map(e => `<article class="res" id="res-${e}"></article>`).join('');
  }
  return Object.fromEntries(engs.map(e => [e, $(`#res-${e}`)]));
}

function llmFor(k) {
  const id = $(`#model${k}`).value;
  if (!llms[id]) llms[id] = new BrowserLLM(id);
  return llms[id];
}

function progressText(r) {
  const pct = r.progress != null ? Math.round(r.progress * 100) : null;
  return `${pct != null ? pct + '% · ' : ''}${r.text || ''}`;
}

async function runAI(k, text, onProgress) {
  if (!gpu?.ok) return { engine: k, error: `Can't run AI in this browser. ${gpu?.why || ''}`, model_label: modelInfo($(`#model${k}`).value).label };
  const llm = llmFor(k);
  const attempt = async () => {
    const res = await llm.analyze(text, onProgress);
    return { engine: k, model_label: modelInfo(llm.id).label, load_seconds: llm.loadSeconds, ...res };
  };
  try {
    return await attempt();
  } catch (e) {
    if (e instanceof GpuMemoryError) {
      // Free every other model on the graphics card and try once more with this one alone.
      onProgress && onProgress({ progress: 0, text: 'Graphics memory was full. Freeing the other models and trying again…' });
      for (const [id, other] of Object.entries(llms)) { if (other !== llm) { await other.unload(); delete llms[id]; } }
      status();
      try { return await attempt(); }
      catch (e2) { return { engine: k, model_label: modelInfo(llm.id).label, error: explainError(e2) }; }
    }
    return { engine: k, model_label: modelInfo(llm.id).label, error: explainError(e) };
  }
}

function explainError(e) {
  const m = String(e && (e.message || e));
  if (e instanceof GpuMemoryError) return `${m} Even with the other models freed it does not fit. Pick a smaller model (Qwen3 0.6B or Qwen3 1.7B).`;
  if (/fetch|network|Failed to fetch|NetworkError/i.test(m)) return `The model could not be downloaded (${m}). The first use needs internet: huggingface.co and raw.githubusercontent.com must be reachable. After that it works offline.`;
  if (/memory|OOM|out of memory|device lost|allocation/i.test(m)) return `Not enough graphics memory for this model (${m}). Press "Free AI memory", or pick a smaller model.`;
  return m;
}

async function analyzeNow() {
  const text = $('#note').value.trim();
  if (!text) { $('#note').focus(); return; }
  const engs = selectedEngines();
  const slots = ensureSlots(engs);
  $('#analyze').disabled = true;
  if (slots.C) renderCard(slots.C, runC(text), text);
  // One model at a time on the graphics card: A first, then B.
  for (const k of engs.filter(e => e !== 'C')) {
    const info = modelInfo($(`#model${k}`).value);
    const loaded = llms[info.id]?.engine;
    slots[k].innerHTML = `<h3>${ENGINE_NAMES[k]}</h3><div class="meta">${esc(info.label)}</div>
      <div class="loading"><div class="bar"><span style="width:0%"></span></div><div class="ptext">${loaded ? 'Thinking…' : `Loading ${esc(info.label)} (${esc(info.download)} the first time; then from this computer)…`}</div></div>`;
    const bar = slots[k].querySelector('.bar span'), ptext = slots[k].querySelector('.ptext');
    const res = await runAI(k, text, r => { if (bar) bar.style.width = `${Math.round((r.progress || 0) * 100)}%`; if (ptext) ptext.textContent = progressText(r); });
    renderCard(slots[k], res, text);
    status();
  }
  $('#analyze').disabled = false;
}

function highlight(text, res) {
  let marks = [];
  if (res.spans) marks = res.spans.map(s => ({ ...s }));
  else if (res.ir) {
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
    res.gen_tps ? `${res.gen_tps} tokens/s` : null, res.load_seconds ? `model load ${res.load_seconds}s` : null].filter(Boolean).join(' · ');
  const rawBlock = `<details><summary>What the model actually returned</summary><pre>${esc(typeof res.raw === 'string' ? res.raw : JSON.stringify(res.raw, null, 1))}</pre></details>`;
  if (res.error && !res.ir) {
    el.innerHTML = `${head}<div class="meta">${esc(meta)}</div><div class="err">The engine failed: ${esc(res.error)}</div>${res.raw ? rawBlock : ''}`;
    return;
  }
  const p = plan(res.ir, world, { text, context: $('#context').value || null, today });
  const lines = describe(res.ir);
  const people = p.mentions.filter(m => m.status !== 'me').map(m => {
    const to = m.status === 'resolved' ? `→ ${esc(m.label)}` : m.status === 'ambiguous' ? `→ which one? (${m.options.length} saved)` :
      m.status === 'new' ? '→ new person' : m.status === 'relative' ? `→ ${esc(m.relation)} of ${esc(m.label)}` :
      m.status === 'reference' ? `→ ${esc(m.label)}` : m.status === 'group' ? '→ a group, not a person' :
      m.status === 'pronoun' ? '→ (he / she)' : `→ ${esc(m.status)}`;
    return `<div class="pp ${m.status}"><span>${esc(m.name)}</span><span class="role">${esc(m.role || '')}</span><span class="to">${to}</span>${m.how ? `<span class="how">${esc(m.how)}</span>` : ''}</div>`;
  }).join('') || '<span class="hint">No people found.</span>';
  const acts = ['auto', 'choice', 'confirm', 'info'].map(t => {
    const list = p.actions.filter(a => a.tier === t);
    if (!list.length) return '';
    return `<div class="tiergroup"><span class="tier ${t}">${TIER[t]}</span><div class="acts">${list.map(a => `<div class="act ${t}">${esc(a.text)}${
      a.optionDetails ? `<div class="opts">${a.optionDetails.map(o => `<span class="opt">${esc(o.label)}<small>${esc(o.detail)}</small></span>`).join('')}${a.act === 'ask_which' && a.name !== 'reference' && !a.question ? '<span class="opt">Someone new</span>' : ''}</div>` : ''}${
      ['answer', 'stage', 'new_contact'].includes(a.act) ? '<div class="opts"><span class="opt">OK</span><span class="opt">Not now</span></div>' : ''}${
      a.act === 'check_existing' ? '<div class="opts"><span class="opt">Yes, same person</span><span class="opt">No, someone else</span></div>' : ''}${
      a.act === 'reminder' && a.tier === 'choice' ? '<div class="opts"><span class="opt">Today</span><span class="opt">Tomorrow</span><span class="opt">Pick a day</span><span class="opt">No reminder</span></div>' : ''}</div>`).join('')}</div></div>`;
  }).join('');
  el.innerHTML = `${head}<div class="meta">${esc(meta)}</div>
    ${res.error ? `<div class="err">${esc(res.error)}</div>` : ''}
    <div class="sec"><b>In the note</b><div class="hl" dir="auto">${highlight(text, res)}</div></div>
    <div class="sec"><b>What it understood</b>${lines.length ? `<ul class="understood">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '<span class="hint">Nothing.</span>'}</div>
    <div class="sec"><b>People and who they are</b><div class="people">${people}</div></div>
    <div class="sec"><b>Where it goes</b>${acts}</div>
    <div class="savebar">Save: ${p.counts.auto} item${p.counts.auto === 1 ? '' : 's'} with one tap${p.counts.choice ? ` · ${p.counts.choice} choice${p.counts.choice > 1 ? 's' : ''}` : ''}${p.counts.confirm ? ` · ${p.counts.confirm} to OK` : ''}<small>The lab never saves anything.</small></div>
    ${p.problems.length ? `<div class="sec"><b>Output problems</b><div class="err">${esc(p.problems.join('\n'))}</div></div>` : ''}
    ${rawBlock}
    <details><summary>Interpretation and filing plan (JSON)</summary><pre>${esc(JSON.stringify({ interpretation: res.ir, plan: p }, null, 1))}</pre></details>`;
}

// ---------------- benchmark ----------------
const benchData = () => ($('#benchSet').value === 'holdout' ? holdSet : devSet);
const savedSets = () => [{ name: 'C · no AI (saved)', results: $('#benchSet').value === 'holdout' ? SAVED.holdout : SAVED.dev }];
let liveSets = [];

async function runLive() {
  const data = benchData();
  const engs = ['A', 'B', 'C'].filter(e => $(`#live${e}`).checked);
  if (!engs.length) return;
  liveSets = engs.map(e => ({ name: e === 'C' ? 'C · no AI' : `${e} · ${modelInfo($(`#model${e}`).value).label}`, engine: e, results: [] }));
  $('#runLive').disabled = true;
  const total = data.cases.length;
  for (const s of liveSets) {
    let i = 0;
    for (const c of data.cases) {
      i++;
      $('#benchProgress').textContent = `${s.name}: ${i}/${total} — ${c.text.slice(0, 60)}`;
      if (s.engine === 'C') { const r = runC(c.text); s.results.push({ id: c.id, ir: r.ir, ms: r.ms }); continue; }
      const r = await runAI(s.engine, c.text, pr => { $('#benchProgress').textContent = `${s.name}: loading model — ${progressText(pr)}`; });
      s.results.push({ id: c.id, ir: r.ir || null, ms: r.ms ?? null, error: r.ir ? null : r.error });
      if (i % 5 === 0) showBench([...savedSets(), ...liveSets]);
    }
    showBench([...savedSets(), ...liveSets]);
  }
  $('#benchProgress').textContent = 'Done. Results stay in this page until you reload it.';
  $('#runLive').disabled = false;
  status();
}

function showBench(sets) {
  const data = benchData();
  const S = sets.filter(s => s.results.length).map(s => ({ name: s.name, sum: summarize(data.cases, s.results, world, data.today) }));
  const part = data === holdSet ? 'holdout' : 'english';
  const cols = [['filedRight', 'Filed right'], ['understoodFully', 'Understood fully'], ['activity', 'Activity type'], ['peopleRoles', 'People & roles'],
    ['negation', '“Not yet” handled'], ['reminders', 'Reminders & waiting'], ['noFalseReminder', 'No unrequested reminder'],
    ['multiple', 'Several items'], ['source', 'Who reported it'], ['casesWithInvented', 'Notes with invented facts'],
    ['oneTap', 'Filed with one tap'], ['avgTaps', 'Taps per note'], ['blameEngine', 'Wrong: engine'], ['blameFiling', 'Wrong: filing rules'],
    ['medianMs', 'Median time (ms)'], ['crashes', 'Failed to answer']];
  const fmt = (k, v) => (v == null ? '—' : ['avgTaps', 'blameEngine', 'blameFiling', 'medianMs', 'crashes'].includes(k) ? v : `${v}%`);
  const n = S[0]?.sum[part].n ?? 0;
  $('#benchSummary').innerHTML = !S.length ? '' : `<h3>${data === holdSet ? 'Holdout set (not tuned on)' : 'Development set (rules were tuned on these)'} · ${n} notes</h3>
    <div class="tablewrap"><table><thead><tr><th></th>${S.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${cols.map(([k, l]) =>
      `<tr><td>${l}</td>${S.map(s => `<td class="num">${fmt(k, s.sum[part][k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  $('#benchRows').innerHTML = !S.length ? '' : `<h3>Every note</h3><div class="tablewrap"><table><thead><tr><th>Note</th>${S.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${data.cases.map(c =>
    `<tr><td><b>${c.id}</b> <span dir="auto">${esc(c.text)}</span></td>${S.map(s => {
      const r = s.sum.rows.find(x => x.id === c.id);
      if (!r) return '<td class="hint">—</td>';
      if (!r.s) return `<td class="no">failed<div class="notes">${esc((r.error || '').slice(0, 120))}</div></td>`;
      const notes = [...r.s.interp.notes, ...r.s.interp.invented.map(x => 'invented: ' + x), ...r.s.filing.missing.map(m => 'missing: ' + m.act + (m.on ? ' ' + m.on : '')), ...r.s.filing.violated.map(m => 'wrong: ' + m.act + (m.on ? ' ' + m.on : ''))];
      return `<td><span class="${r.s.filing.ok ? 'ok' : 'no'}">${r.s.filing.ok ? '✓' : '✗'} filed</span> <span class="${r.s.interp.allOK ? 'ok' : 'no'} light">${r.s.interp.allOK ? '✓' : '✗'} understood</span>${notes.length ? `<div class="notes">${esc(notes.slice(0, 4).join(' · '))}</div>` : ''}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
}

init();
