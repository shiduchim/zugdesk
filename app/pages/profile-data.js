// My Profile data: one owner record (store.profile id "me"), language versions, the
// generated Suggested short text and the allowlisted text that Share may send.
// Private notes, conversation history, reference notes and anyone else's data are never
// read here — so they can never end up in outgoing text.
import * as store from '../js/store.js';

export const LANGS = [['en', 'English', 'EN'], ['he', 'עברית', 'HE']];
export const langName = (l) => (LANGS.find(x => x[0] === l) || LANGS[0])[1];
export const langCode = (l) => (LANGS.find(x => x[0] === l) || LANGS[0])[2];
export const isRtl = (l) => l === 'he';

const LABELS = {
  en: { facts: 'Facts', about: 'About me', looking: 'What I’m looking for', lookingShort: 'Looking for', inquiries: 'For inquiries', onRequest: 'Full profile on request', phone: 'My phone', email: 'My email', refs: 'References' },
  he: { facts: 'פרטים', about: 'קצת עליי', looking: 'מה אני מחפש/ת', lookingShort: 'מחפש/ת', inquiries: 'לבירורים', onRequest: 'פרופיל מלא לפי בקשה', phone: 'הטלפון שלי', email: 'האימייל שלי', refs: 'ממליצים' },
};
export const L = (lang) => LABELS[lang] || LABELS.en;

export const EMPTY = () => ({ id: 'me', name: '', age: '', city: '', occupation: '', intro: '', facts: [], about: '', looking: '', sections: [],
  contact: { inquiriesName: '', inquiriesPhone: '', phone: '', email: '' }, references: [], shortFacts: [], lang: 'en', translations: {},
  languages: [], answers: {}, answerLabels: {}, religiousOther: '', maxAge: '' });

export async function loadProfile() {
  const [me, versions, shares, files] = await Promise.all([
    store.profile.get('me'), store.profileVersions.list(), store.shares.list(), store.attachments.list()]);
  versions.sort((a, b) => (b.savedAt || b.createdAt || '').localeCompare(a.savedAt || a.createdAt || ''));
  shares.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  return { me: me || null, versions, shares, files: files.filter(a => a.profileFile) };
}

// The profile as seen in one language: translated text where it exists, base text otherwise.
// `missing` lists fields still showing the base language.
// Answers picked in the Edit form (same choices as Add Person) shown as facts, before the typed ones.
const DERIVED = [['Languages', (b) => b.languages], ['Status', (b) => b.answers.pStatus], ['Religious level', (b) => b.answers.pLevel],
  ['Tzniut', (b) => b.answers.pTzniut], ['Religious background', (b) => b.answers.pBackground], ['Religious', (b) => b.answers.pReligious],
  ['Other religious details', (b) => b.religiousOther], ['Character & lifestyle', (b) => b.answers.pTraits], ['Body type', (b) => b.answers.pBody]];
const STD_KEYS = ['pStatus', 'pLevel', 'pTzniut', 'pBackground', 'pReligious', 'pTraits', 'pBody', 'languages'];
function derivedFacts(b) {
  const txt = (v) => Array.isArray(v) ? v.filter(Boolean).join(', ') : String(v ?? '').trim();
  const out = DERIVED.map(([label, get]) => ({ id: 'd:' + label, label, value: txt(get(b)), derived: true }));
  for (const [k, v] of Object.entries(b.answers || {})) if (!STD_KEYS.includes(k)) out.push({ id: 'd:' + k, label: (b.answerLabels || {})[k] || k, value: txt(v), derived: true });
  if (b.maxAge) out.push({ id: 'd:maxAge', label: 'Looking up to age', value: String(b.maxAge), derived: true });
  return out.filter(f => f.value);
}
function withDerived(out) {
  const d = derivedFacts(out), have = new Set(d.map(f => f.label.toLowerCase()));
  out.customFacts = out.facts;
  out.facts = [...d, ...out.facts.filter(f => !have.has((f.label || '').toLowerCase()))];
  return out;
}
export function view(me, lang) {
  const base = { ...EMPTY(), ...(me || {}) };
  base.answers = base.answers || {};
  base.contact = { ...EMPTY().contact, ...(base.contact || {}) };
  const baseLang = base.lang || 'en';
  if (lang === baseLang) return withDerived({ ...base, viewLang: lang, missing: new Set() });
  const t = (base.translations || {})[lang] || {};
  const missing = new Set();
  const pick = (k) => { if (t[k]) return t[k]; if (base[k]) missing.add(k); return base[k]; };
  const out = { ...base, viewLang: lang, missing };
  for (const k of ['name', 'city', 'occupation', 'intro', 'about', 'looking']) out[k] = pick(k);
  out.facts = base.facts.map(f => { const x = (t.facts || {})[f.id]; if (!x || !x.value) missing.add('fact:' + f.id); return { ...f, label: x?.label || f.label, value: x?.value || f.value }; });
  out.sections = base.sections.map(s => { const x = (t.sections || {})[s.id]; if (!x || !x.text) missing.add('section:' + s.id); return { ...s, title: x?.title || s.title, text: x?.text || s.text }; });
  out.contact = { ...base.contact, inquiriesName: (t.contact || {}).inquiriesName || base.contact.inquiriesName };
  return withDerived(out);
}

// Writes text in the language being viewed; numbers, phones and choices are shared by all languages.
// The first real edit turns a demo example into the owner's own record (demo: false).
export async function saveProfile(me, lang, patch) {
  const cur = { ...EMPTY(), ...(me || {}) };
  const baseLang = cur.lang || 'en';
  let next;
  if (lang === baseLang || !me) next = { ...cur, ...patch };
  else {
    const TEXT = ['name', 'city', 'occupation', 'intro', 'about', 'looking'];
    const t = { ...((cur.translations || {})[lang] || {}) };
    const shared = {};
    for (const [k, v] of Object.entries(patch)) {
      if (TEXT.includes(k)) t[k] = v;
      else if (k === 'facts') {
        t.facts = { ...(t.facts || {}) };
        for (const f of v) { const b = cur.facts.find(x => x.id === f.id); if (b && (f.label !== b.label || f.value !== b.value)) t.facts[f.id] = { label: f.label, value: f.value }; }
        // new / removed / reordered facts change the shared list too
        shared.facts = v.map(f => cur.facts.find(x => x.id === f.id) || f);
      } else if (k === 'sections') {
        t.sections = { ...(t.sections || {}) };
        for (const s of v) { const b = cur.sections.find(x => x.id === s.id); if (b && (s.title !== b.title || s.text !== b.text)) t.sections[s.id] = { title: s.title, text: s.text }; }
        shared.sections = v.map(s => cur.sections.find(x => x.id === s.id) || s);
      } else if (k === 'contact') {
        t.contact = { inquiriesName: v.inquiriesName };
        shared.contact = { ...v, inquiriesName: cur.contact.inquiriesName || v.inquiriesName };
      } else shared[k] = v;
    }
    next = { ...cur, ...shared, translations: { ...(cur.translations || {}), [lang]: t } };
  }
  next.demo = false;
  return store.profile.save(next);
}

export const summaryLine = (v) => [v.age, v.city, v.occupation].filter(Boolean).join(' · ');
const firstSentence = (s) => { const m = (s || '').trim().match(/^[\s\S]*?[.!?](?=\s|$)/); return (m ? m[0] : (s || '').trim()); };

// "Suggested": automatic, always up to date, built only from allowlisted profile fields.
export function suggestedText(me, lang) {
  const v = view(me, lang), l = L(lang);
  const ids = v.shortFacts && v.shortFacts.length ? v.shortFacts : v.facts.slice(0, 5).map(f => f.id);
  const facts = ids.map(id => v.facts.find(f => f.id === id)).filter(f => f && (f.value || f.label));
  const lines = [v.name || ''];
  if (summaryLine(v)) lines.push('• ' + summaryLine(v));
  for (const f of facts) lines.push('• ' + (f.value || f.label));
  if (v.intro) lines.push('', v.intro);
  if (v.looking) lines.push('', `${l.lookingShort}: ${firstSentence(v.looking)}`);
  const inq = [v.contact.inquiriesName, v.contact.inquiriesPhone].filter(Boolean).join(', ');
  if (inq) lines.push('', `${l.onRequest}: ${inq}`);
  return lines.join('\n').replace(/^\n+/, '').trim();
}

// Full profile text. Own phone / email / references / sections only when chosen.
export function fullText(me, lang, { phone = false, email = false, refIds = [] } = {}) {
  const v = view(me, lang), l = L(lang);
  const out = [v.name || ''];
  if (summaryLine(v)) out.push(summaryLine(v));
  if (v.intro) out.push(v.intro);
  const facts = v.facts.filter(f => f.value || f.label);
  if (facts.length) out.push('', l.facts + ':', ...facts.map(f => f.value ? `${f.label}: ${f.value}` : f.label));
  if (v.about) out.push('', l.about + ':', v.about);
  if (v.looking) out.push('', l.looking + ':', v.looking);
  for (const s of v.sections.filter(s => s.share !== false && s.text)) out.push('', s.title + ':', s.text);
  const contact = [];
  const inq = [v.contact.inquiriesName, v.contact.inquiriesPhone].filter(Boolean).join(', ');
  if (inq) contact.push(`${l.inquiries}: ${inq}`);
  if (phone && v.contact.phone) contact.push(`${l.phone}: ${v.contact.phone}`);
  if (email && v.contact.email) contact.push(`${l.email}: ${v.contact.email}`);
  if (contact.length) out.push('', ...contact);
  const refs = (v.references || []).filter(r => refIds.includes(r.id));
  if (refs.length) out.push('', l.refs + ':', ...refs.map(r => [r.name, r.relation ? `(${r.relation})` : '', r.phone].filter(Boolean).join(' ')));
  return out.join('\n').trim();
}

// Extra lines added to a short text when the owner ticks them in Share.
export function extrasText(me, lang, { phone = false, email = false, refIds = [] } = {}) {
  const v = view(me, lang), l = L(lang);
  const out = [];
  if (phone && v.contact.phone) out.push(`${l.phone}: ${v.contact.phone}`);
  if (email && v.contact.email) out.push(`${l.email}: ${v.contact.email}`);
  const refs = (v.references || []).filter(r => refIds.includes(r.id));
  if (refs.length) out.push(l.refs + ':', ...refs.map(r => [r.name, r.relation ? `(${r.relation})` : '', r.phone].filter(Boolean).join(' ')));
  return out.join('\n');
}

export const fileKind = (f) => (/^image\//.test(f.type || '') ? 'photo' : /pdf/.test(f.type || '') ? 'PDF' : 'file');
export function filesSummary(files) {
  if (!files.length) return 'none yet';
  const n = { photo: 0, PDF: 0, file: 0 };
  for (const f of files) n[fileKind(f)]++;
  return [n.photo ? `${n.photo} photo${n.photo > 1 ? 's' : ''}` : '', n.PDF ? `${n.PDF} PDF` : '', n.file ? `${n.file} file${n.file > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
}
