// Engine C — no AI. Word lists + a few sentence rules + your own saved contacts.
// It produces the same interpretation format as the AI engines, so the same filing step and the
// same scoring apply. It runs in the browser (and on a phone) with nothing to download.
//
// Honest limits: it only knows the words in its lists. Unknown names are found only when they are
// capitalized or follow a cue ("named", "met", "Mrs."). Hebrew/Russian: saved names and dates only.

import { findWhen } from './dates.js';
import { tokenSim, cleanToken, HONORIFICS, RELATIONS } from './names.js';

const CITIES = new Set(['lakewood', 'monsey', 'brooklyn', 'passaic', 'flatbush', 'boro', 'williamsburg', 'jerusalem',
  'yerushalayim', 'bnei', 'brak', 'toms', 'river', 'teaneck', 'baltimore', 'chicago', 'london', 'manchester',
  'cleveland', 'detroit', 'miami', 'queens', 'staten', 'island', 'beitar', 'modiin', 'elad', 'telz', 'stone']);
const NOT_NAMES = new Set(('i,i\'m,i\'ll,i\'d,i\'ve,we,he,she,they,it,the,a,an,my,our,his,her,their,this,that,no,yes,not,' +
  'called,call,calling,met,meet,spoke,speak,talked,talk,tried,try,had,have,has,need,needs,remind,text,texted,follow,' +
  'sent,send,got,get,heard,according,waiting,wait,bought,told,tell,left,leave,still,also,just,maybe,only,then,' +
  'after,before,today,tomorrow,tonight,yesterday,sunday,monday,tuesday,wednesday,thursday,friday,saturday,shabbos,' +
  'shabbat,motzei,erev,yom,tov,january,february,march,april,may,june,july,august,september,october,november,' +
  'december,mrs,mr,ms,rabbi,reb,rebbetzin,dr,shul,yeshiva,kollel,seminary,wedding,date,dates,reference,references,' +
  'profile,resume,idea,ideas,shadchan,shadchanim,shidduch,shidduchim,nobody,anyone,someone,everyone,both,neither,' +
  'none,good,great,nice,ok,okay,so,but,and,or,if,whether,when,what,who,why,how,thanks,thank,please,hashem,b"h,bh,' +
  'g-d,gd,email,emailed,whatsapp,phone,phoned,message,messaged,asked,ask,said,says,say,wants,want,will,would,' +
  'should,could,can,must,did,didn\'t,does,doesn\'t,is,was,are,were,be,been,going,gonna,let,lets,let\'s,mom,dad,' +
  'mother,father,sister,brother,aunt,uncle,cousin,friend,friends,family,parents,wife,husband,girl,girls,boy,' +
  'boys,guy,guys,new,another,second,first,third,next,last,week,month,year,later,soon,again,too,very,really,' +
  'busy,interested,agreed,english,hebrew,russian,american,israeli,chassidish,yeshivish,litvish,sephardi,' +
  'ashkenazi,modern,orthodox,bt,ffb,named,lady,man,woman,group,anyone,nobody,someone').split(','));

const REL_WORDS = 'mother|father|parents|mom|dad|sister|brother|aunt|uncle|wife|husband|family|side|grandmother|grandfather|cousin|references?|rebbetzin|rav|friend|neighbor';
const RE_REL = new RegExp(`\\b([A-Za-z\\u0590-\\u05FF\\u0400-\\u04FF][\\w\\u0590-\\u05FF\\u0400-\\u04FF]*(?:\\s[A-Z][a-z]+)?)['’]s\\s+(${REL_WORDS})\\b`, 'gi');
const RE_REL_PRON = new RegExp(`\\b(her|his|their)\\s+(${REL_WORDS})\\b`, 'gi');
const RE_REF_BARE = /\b(?:the\s+|a\s+)?references?\b/gi;
const RE_HON = /\b(Mrs|Mr|Ms|Rabbi|Rebbetzin|Reb|Dr)\.?\s+([A-Z][a-z]+|[a-z]{3,})\b/g;

// ---------- vocabularies ----------
const V = {
  profileSent: /\b(sent|send|forwarded|emailed|gave|passed)\s+(over\s+)?my\s+(profile|resume|r[eé]sum[eé]|shidduch (resume|profile)|info|information)\b/i,
  profileRecv: /\b(sent|forwarded|emailed|passed)\s+me\s+(\S+['’]s\s+|her\s+|his\s+|the\s+|a\s+)?(profile|resume|r[eé]sum[eé])\b|\b(got|received)\s+(\S+['’]s\s+|the\s+|a\s+)?(profile|resume)\b/i,
  suggestion: /\b(suggest(ed|s|ing)?|redt|red\s+me|has an idea|have an idea|had an idea|an idea for me|set me up|proposed|sent me a (girl|guy|name|idea)|came up)\b/i,
  effort: /\b(contacted|reached out to|tried\s+(\d+|one|two|three|four|five|several|a few)|asked around|asking around|asking (her|his) friends|asking people|has been asking|working on|looking (for|into)|redt me to|checking (with|around)|wants to help|will help|offered to help)\b/i,
  call: /\b(call(ed|ing)?|phoned?|rang|spoke|speak|talked|talking|chat(ted)?|on the phone|picked up|pick up|left a (voice\s?)?message|voicemail|got a call)\b|התקשר|דיברתי|позвонил|звонил|говорил/i,
  message: /\b(text(ed|ing)?|messag(ed|e|ing)|whatsapp(ed)?|e-?mail(ed)?|wrote|sms)\b|הודעה|сообщение|написал/i,
  meeting: /\b(met|meet|saw|ran into|bumped into)\b|פגשתי|встретил/i,
  date: /\b(date|dated|went out|go out again|going out)\b/i,
  request: /\b(asked (me )?(to|if|about|whether|for)|wants me to|want me to|wants to (know|hear|talk|meet|see|speak)|want to (know|hear|talk|meet)|to ask about|asking (about|for)|wants (more )?info(rmation)?|wants more details|needs (more )?info(rmation)?)\b/i,
  promise: /\b(will|'ll|’ll|is going to|are going to|going to|gonna|promised|said (she|he|they)['’]?d)\b/i
};
const WAIT_RE = /\b(will|'ll|’ll|is going to|are going to|going to|gonna|promised to|said (she|he|they)['’]?d|should)\s+(call|get back|text|send|let me know|be in touch|update|reach out|contact|email|message|tell)\b/i;
const WAIT_RE2 = /\bwaiting (to hear back |to hear |for an answer |for )?(from |for )?/i;
const TASK_START = /^(please\s+)?(call|text|email|e-mail|message|whatsapp|phone|ring|remind me to|remind me|need to|needs to|have to|has to|must|should|try|follow up|follow-up|get back to|send|thank|ask|check|i['’]ll|i will|i need to|i have to|i should|don['’]t forget to|להתקשר|לשלוח|позвонить|написать)\b/i;
const ASKED_ME = /\b(asked me to|wants me to|want me to|told me to|needs me to)\s+([^,.;]*)/i;
const HEAR_FROM_ME = /\bwants? to hear (back )?from me\b/i;

const YES = /\b(agreed|agrees|said yes|says yes|is interested|are interested|wants to go out( again)?|want to go out|wants to meet (me|him)|open to meeting|is open to|is ok with|is fine with|fine with it|accepted|is on board|likes the idea|is a yes|is in)\b|הסכימה|הסכים|מעוניינת|согласилась|согласился/i;
const NO = /\b(said no|says no|not interested|isn['’]t interested|aren['’]t interested|declined|passed|turned (it |him |her )?down|is a no|not for (her|him)|doesn['’]t want|does not want)\b|לא מעוניינת|отказалась/i;
const THINKING = /\b(still thinking|thinking (about )?it|needs (some |a little |more )?time|needs a few (more )?days|still deciding|considering|needs to think|wants to think)\b|חושבת|думает/i;
const MORE_INFO = /\b(wants|want|needs|asked for|asking for)\s+(more|a bit more|some more)\s+(info|information|details)\b/i;
const NEG_GUARD = /\b(hasn['’]t|has not|haven['’]t|have not|didn['’]t|did not|not yet|isn['’]t sure|not sure|unsure|whether|wondering if|if)\b/i;
const NEGATED_EVENT = /\b(hasn['’]t|has not|haven['’]t|didn['’]t|did not|never|not yet|not sure if|isn['’]t sure)\b(?!\s+(pick up|answer|get through))/i;
const NO_PICKUP = /\b(didn['’]t (pick up|answer)|did not (pick up|answer)|no answer|wasn['’]t (home|available)|went to voicemail|not picking up|not answering)\b/i;
const OUTCOME = /\b(no answer|didn['’]t (answer|pick up)|did not answer|not answering|busy|voicemail|nobody (was )?interested|no one (was )?interested|no luck|nothing (new|yet)|no news|didn['’]t find (anyone|anybody)|not available|good things|wonderful|both said no|neither had news|doesn['’]t have anyone|has no one|nothing)\b/i;
const COUNT = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|several|a few)\s+(different\s+|new\s+|more\s+)?(families|girls|boys|guys|people|names|ideas|options|shadchanim|singles)\b/i;
const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const REPORT_INTRO = /\b(according to|heard from)\s+$/i;

function contactRole(p) {
  if (p.roles.includes('single')) return 'single';
  if (p.roles.includes('reference') && !p.roles.includes('friend')) return 'reference';
  if (p.roles.some(r => ['shadchan', 'friend', 'helper'].includes(r))) return 'shadchan';
  return 'other';
}

/** Find people in the text: saved contacts (any spelling close enough), relations, new capitalized names. */
function findPeople(text, world) {
  const found = [];
  const overlaps = (s, e) => found.some(f => s < f.end && f.start < e);
  const addHit = (start, end, name, extra) => { if (!overlaps(start, end)) found.push({ start, end, name, ...extra }); };
  let m;
  // relations first: "Rivka's mother", "her father"
  for (const re of [RE_REL, RE_REL_PRON]) {
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      let base = m[1], start = m.index;
      const bw = base.split(/\s+/);
      if (bw.length === 2 && (!/^[A-Z]/.test(bw[0]) || NOT_NAMES.has(bw[0].toLowerCase()) || CITIES.has(bw[0].toLowerCase()))) {
        start += m[0].indexOf(bw[1]); base = bw[1];
      }
      if (re === RE_REL && (NOT_NAMES.has(base.toLowerCase()) || CITIES.has(base.toLowerCase()))) continue;
      const relation = m[2].toLowerCase();
      addHit(start, m.index + m[0].length, text.slice(start, m.index + m[0].length), { kind: 'relation', base, relation });
    }
  }
  // honorific + name
  RE_HON.lastIndex = 0;
  while ((m = RE_HON.exec(text))) {
    if (NOT_NAMES.has(m[2].toLowerCase())) continue;
    addHit(m.index, m.index + m[0].length, m[0], { kind: 'name' });
  }
  // words that match saved names (two-word full names first)
  const words = [...text.matchAll(/[A-Za-z֐-׿Ѐ-ӿ][\w'’֐-׿Ѐ-ӿ]*/g)]
    .map(w => ({ raw: w[0].replace(/['’]s$/, ''), start: w.index, end: w.index + w[0].replace(/['’]s$/, '').length }));
  const known = [];
  for (const p of world.people) {
    const toks = [p.name, ...(p.altNames || [])].flatMap(n => n.split(/\s+/)).map(cleanToken).filter(t => t && !HONORIFICS.has(t));
    known.push({ p, toks: [...new Set(toks)] });
  }
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const t = cleanToken(w.raw);
    if (t.length < 3 || NOT_NAMES.has(t) || CITIES.has(t)) continue;
    const cap = /^[A-Z֐-׿Ѐ-ӿ]/.test(w.raw);
    const hit = known.some(k => k.toks.some(kt => { const s = tokenSim(t, kt); return s === 1 || (s > 0 && cap); }));
    if (!hit) continue;
    let end = w.end, name = w.raw;
    const nx = words[i + 1];
    if (nx && /^[A-Z]/.test(nx.raw) && text.slice(w.end, nx.start).trim() === '' && !NOT_NAMES.has(nx.raw.toLowerCase()) && !CITIES.has(nx.raw.toLowerCase())) {
      end = nx.end; name = `${w.raw} ${nx.raw}`; i++;
    }
    addHit(w.start, end, name, { kind: 'name' });
  }
  // new names: capitalized words that are not ordinary words, or any word after a naming cue
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const t = w.raw.toLowerCase();
    if (overlaps(w.start, w.end) || NOT_NAMES.has(t) || CITIES.has(t) || t.length < 3) continue;
    const before = text.slice(Math.max(0, w.start - 22), w.start).toLowerCase();
    const cue = /(named|name is)\s*$/.test(before);
    const cap = /^[A-Z]/.test(w.raw);
    const sentenceStart = /(^|[.!?]\s+)$/.test(text.slice(0, w.start));
    if ((cap && (!sentenceStart || /^\s+(suggested|said|says|called|told|texted|sent|asked|wants|will|is|was|has|agreed|thinks|met)\b/i.test(text.slice(w.end, w.end + 12)))) || (cue && /^[a-z]+$/.test(w.raw) && !NOT_NAMES.has(t))) {
      if (cap || cue) addHit(w.start, w.end, w.raw, { kind: 'name', isNew: true });
    }
  }
  // bare "reference"
  RE_REF_BARE.lastIndex = 0;
  while ((m = RE_REF_BARE.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 6), m.index).toLowerCase();
    if (/my\s*$|be\s*$/.test(before) || /\bmy\s+$/.test(text.slice(0, m.index).toLowerCase().slice(-3))) continue;
    if (/\bbe my $|\bmy $/.test(text.slice(Math.max(0, m.index - 6), m.index).toLowerCase())) continue;
    addHit(m.index, m.index + m[0].length, m[0].replace(/^(the|a)\s+/i, ''), { kind: 'relation', base: null, relation: 'reference' });
  }
  return found.sort((a, b) => a.start - b.start);
}

function splitClauses(text) {
  const out = [];
  const re = /(?<!\b(?:Mrs|Mr|Ms|Dr|St|R))[.;!?]+\s*|,\s*(?=(?:and|but|so|who|which|she|he|they|i|i['’]ll|call|text|try|need|remind|both|nobody|neither|no|nothing|still|sounds|her name|his name)\b)|\s+(?=but\b)|\s+and\s+(?=(?:she|he|they|texted|called|sent|asked|mrs|mr|rabbi)\b)/gi;
  let last = 0, m;
  const pushPart = (a, b) => {
    let seg = text.slice(a, b);
    const lead = seg.match(/^\s*(?:(?:and|but|so)\s+)?/i)[0];
    a += lead.length; seg = seg.slice(lead.length);
    const trail = seg.match(/\s*$/)[0];
    if (seg.trim()) out.push({ start: a, end: b - trail.length, text: seg.slice(0, seg.length - trail.length) });
  };
  while ((m = re.exec(text))) {
    if (m.index > last) pushPart(last, m.index);
    last = m.index + m[0].length;
  }
  if (last < text.length) pushPart(last, text.length);
  return out;
}

export function rulesInterpret(text, world) {
  const people = findPeople(text, world);
  const clauses = splitClauses(text);
  const ir = { people: [], events: [], answers: [], tasks: [], waiting: [], uncertain: [] };
  const spans = [];
  const savedRole = (name, hasHon = /^(mrs|mr|ms|rabbi|reb|rebbetzin|dr)\b/i.test(name)) => {
    const t = cleanToken(name.split(/\s+/).filter(x => !HONORIFICS.has(cleanToken(x))).join(' ').split(' ')[0] || '');
    const ps = world.people.filter(p => !(hasHon && p.roles.includes('single'))
      && [p.name, ...(p.altNames || [])].some(n => n.split(/\s+/).map(cleanToken).some(k => tokenSim(t, k) > 0)));
    const roles = [...new Set(ps.map(contactRole))];
    return roles.length === 1 ? roles[0] : null; // two saved people with different roles → don't guess here
  };

  // people list with roles
  for (const p of people) {
    let role = null, of = null;
    if (p.kind === 'relation') {
      role = /reference/.test(p.relation) ? 'reference' : 'family';
      of = p.base && !/^(her|his|their)$/i.test(p.base) ? p.base : null;
      if (!of && p.base) {
        const earlier = people.filter(q => q.end <= p.start && q.kind === 'name');
        const singles = earlier.filter(q => savedRole(q.name) === 'single');
        of = (singles[singles.length - 1] || earlier[earlier.length - 1])?.name || null;
      }
    } else {
      const before = text.slice(Math.max(0, p.start - 30), p.start).toLowerCase();
      const sentence = text.slice(Math.max(0, text.lastIndexOf('.', p.start - 5) + 1), (text.indexOf('.', p.end) + 1 || text.length + 1) - 1).toLowerCase();
      const hasHon = /^(mrs|mr|ms|rabbi|reb|rebbetzin|dr)\b/i.test(p.name);
      if (/(girl|guy|boy|single) (named|called)\s*$|name is\s*$|idea for me,?\s*$|suggested( a girl named)?\s*$/.test(before) && !hasHon) role = 'single';
      else if (/looking for a shidduch/.test(text.slice(p.end, p.end + 40).toLowerCase())) role = 'single';
      else if (/\bcousin\s*$/.test(before)) role = 'family';
      else role = savedRole(p.name, hasHon);
      if (!role && (/\bshadchan|shadchante|runs a shidduch|shidduch group/.test(sentence))) role = 'shadchan';
      if (!role) role = p.isNew ? 'other' : null;
    }
    ir.people.push({ name: p.name, role: role || 'other', of });
    spans.push({ start: p.start, end: p.end, kind: 'person', label: role || 'person' });
  }
  for (const h of findWhen(text)) spans.push({ start: h.index, end: h.index + h.phrase.length, kind: 'time', label: 'time' });

  let lastPerson = null;        // most recent person named (for "he", "she", "her")
  let lastSubject = null;       // who the previous clause was about
  let reporter = null;          // "According to X," / "X told me that"
  let lastEvent = null;
  const inClause = c => people.filter(p => p.start >= c.start && p.end <= c.end);
  const pronounRef = (w) => (/^(she|he|her|him|they|them|who)$/i.test(w) ? lastPerson : null);

  for (const c of clauses) {
    const ct = c.text.trim();
    const lc = ct.toLowerCase();
    const ps = inClause(c);
    const when = findWhen(ct)[0]?.phrase || null;
    // subject: the person the clause starts with ("Mrs. Cohen contacted…", "According to X, …")
    let subject = null;
    const lead = lc.match(/^(i|i['’]m|i['’]ll|i['’]ve|i['’]d|we|she|he|they|who|her|his)\b/);
    const prefix = ps.length ? text.slice(c.start, ps[0].start).trim().toLowerCase() : null;
    if (ps.length && (prefix === '' || /^(according to|heard from|got a (call|message|text) from|my (cousin|friend|neighbor|sister|brother|uncle|aunt|rebbi|rav|chavrusa|rebbetzin))$/.test(prefix))) subject = ps[0].name;
    else if (lead) subject = /^(i|we)/.test(lead[1]) ? 'me' : pronounRef(lead[1]) || lastSubject;
    else if (/^(called|tried|spoke|met|sent|texted|left|had|got|told|bought|heard|emailed|need|remind|call|text|try|follow|still|no answer)/.test(lc)) subject = 'me';
    if (/^\S+(\s\S+)? and i\b/i.test(ct) && ps.length) subject = 'me';
    if (/^got a (call|message|text) from/.test(lc) && ps.length) subject = ps[0].name;
    const objs = ps.filter(p => p.name !== subject);
    const firstObj = objs[0]?.name || null;
    const negated = NEGATED_EVENT.test(lc);

    // "According to X," / "Heard from X that ..."
    const rep = lc.match(/^(according to|heard from)\s+/);
    if (rep && ps.length) {
      reporter = ps[0].name;
      if (/^according to\s+[^,]+$/i.test(ct)) { lastPerson = ps[0].name; lastSubject = ps[0].name; continue; }
      subject = null;
    }
    const said = lc.match(/^(.*?)\b(told me|says|said|thinks|tells me|mentioned|let me know)\b( that)?/);
    if (said && subject && subject !== 'me') reporter = subject;

    // answers
    const ansMatch = (re) => { const mm = ct.match(re); return mm ? { index: mm.index, text: mm[0] } : null; };
    let value = null, hit = null, answerRecorded = false;
    for (const [v, re] of [['more_info', MORE_INFO], ['no', NO], ['thinking', THINKING], ['yes', YES]]) {
      hit = ansMatch(re); if (hit) { value = v; break; }
    }
    if (value) {
      const pre = ct.slice(0, hit.index);
      const guarded = NEG_GUARD.test(pre) || (/\bdidn['’]t\s+say\s*$|\bdid not say\s*$/.test(pre));
      if (guarded && value !== 'thinking') { ir.uncertain.push(ct); value = null; }
      // whose answer: nearest person before the cue
      const before = ps.filter(p => p.start - c.start < hit.index + (ct.length - c.text.length));
      let whose = before.length ? before[before.length - 1] : null;
      let ofName = whose?.name || null;
      if (!whose && /^(she|he|they)\b/.test(lc)) ofName = lastPerson;
      if (whose?.kind === 'relation' && /side|family|parents/.test(whose.relation) && whose.base) ofName = whose.base;
      else if (whose?.kind === 'relation') ofName = null; // a relative's own opinion is not the single's answer
      let ofRole = ofName ? (ir.people.find(p => p.name === ofName)?.role || savedRole(ofName)) : null;
      if (/^i\b/.test(lc) && (!whose || whose.start - c.start > 2)) { ofName = 'me'; ofRole = 'me'; }
      const tellsMeNo = lc.match(/^(told|gave)\s+.*?\b(no|yes)\b/);
      if (tellsMeNo) { ofName = 'me'; ofRole = 'me'; value = value || tellsMeNo[2]; }
      if (ofRole === 'other') ofRole = savedRole(ofName) || null;
      if (value && ofName && (ofRole === 'single' || ofRole === 'me' || ofRole == null && ofName !== reporter)) {
        const about = ofName === 'me' ? (objs.find(p => p.kind === 'name')?.name || (lc.match(/\bon the ([\w\s]+?)$/)?.[1] ? `the ${lc.match(/\bon the ([\w\s]+?)$/)[1]}` : null)) : null;
        const source = ofName === 'me' ? null : reporter && reporter !== ofName ? reporter : (subject && subject !== ofName && subject !== 'me' ? subject : null);
        ir.answers.push({ of: ofName, about, value, source });
        answerRecorded = true;
        spans.push({ start: c.start + hit.index, end: c.start + hit.index + hit.text.length, kind: 'answer', label: value });
      }
    } else {
      const tellsMe = lc.match(/^(told|gave)\s+\S+(\s+\S+)?\s+(no|yes)\b/);
      if (tellsMe) {
        const aboutM = lc.match(/\b(?:on|about|for) (the [\w\s]+?)$/);
        ir.answers.push({ of: 'me', about: objs.find(p => p.kind === 'name' && !/mrs|rabbi|mr/i.test(p.name))?.name || (aboutM ? aboutM[1] : null), value: tellsMe[3], source: null });
      }
    }

    // my own tasks
    let isTask = false;
    if (TASK_START.test(lc) || /^(להתקשר|לשלוח|לדבר|позвонить|написать|отправить)/.test(lc) || /^(no answer[,.]?\s*)?(try|call) (again|back)/.test(lc)) {
      isTask = true;
      let who = firstObj || ps[0]?.name || null;
      const pr = lc.match(/\b(him|her|them)\b/);
      if (!who && pr) who = lastPerson;
      if (!who) who = lastPerson;
      const what = (lc.match(/^(?:please\s+|remind me to\s+|need to\s+|have to\s+|i['’]ll\s+|i will\s+|i need to\s+|don['’]t forget to\s+)?([a-z]+(?:\s+(?:up|back|again))?)/) || [])[1] || 'follow up';
      ir.tasks.push({ who, what, when });
    }
    const am = ct.match(ASKED_ME);
    if (am && subject && subject !== 'me') {
      ir.events.push({ type: 'request', actor: subject, with: 'me', about: null, source: null, result: am[2].trim(), count: null, when: null, negated: false });
      ir.tasks.push({ who: subject, what: am[2].replace(/\b(by|on|before|in|tomorrow|tonight)\b.*$/i, '').trim(), when });
      isTask = true;
    } else if (HEAR_FROM_ME.test(lc) && subject && subject !== 'me') {
      ir.events.push({ type: 'request', actor: subject, with: 'me', about: null, source: null, result: 'wants to hear from me', count: null, when: null, negated: false });
      ir.tasks.push({ who: subject, what: 'get back to', when });
      isTask = true;
    }

    // waiting for someone else
    if (!isTask) {
      const wm = ct.match(WAIT_RE);
      const w2 = lc.match(WAIT_RE2);
      if (wm && subject && subject !== 'me' && !negated) {
        ir.waiting.push({ who: subject, what: ct.slice(wm.index + wm[1].length).trim().replace(/\b(tomorrow|tonight|next week|after shabbos)\b.*$/i, '').trim() || null, when });
      } else if (w2 && /^waiting/.test(lc) && ps.length) {
        ir.waiting.push({ who: ps[0].name, what: null, when });
      }
    }

    // activities
    let type = null;
    const noPickup = NO_PICKUP.test(lc) && subject && subject !== 'me';
    if (noPickup) type = ps.some(p => savedRole(p.name) === 'reference' || p.kind === 'relation' && /reference/.test(p.relation)) || /reference/.test(lc) ? 'reference_check' : 'call';
    else if (V.profileSent.test(lc) && (subject === 'me' || !subject)) type = 'profile_sent';
    else if (V.profileRecv.test(lc)) type = 'profile_received';
    else if (V.suggestion.test(lc)) type = 'suggestion';
    else if (V.effort.test(lc)) type = 'effort';
    else if (/\breference\b/i.test(lc) && V.call.test(lc)) type = 'reference_check';
    else if (V.date.test(lc) && !/(agreed|wants?) to go out/.test(lc) && !YES.test(lc)) type = 'date';
    else if (V.message.test(lc)) type = 'message';
    else if (V.call.test(lc)) type = 'call';
    else if (V.meeting.test(lc) && !/meet (me|him|my)/.test(lc)) type = 'meeting';
    else if (V.request.test(lc) && !am) type = 'request';
    else if (V.promise.test(lc) && subject && subject !== 'me' && !ir.waiting.length) type = 'promise';
    if (type === 'call' && ps.some(p => savedRole(p.name) === 'reference') && subject === 'me') type = 'reference_check';
    if (type && !(isTask && ['call', 'message'].includes(type) && TASK_START.test(lc))) {
      let actor = subject || 'me';
      let withP = objs.find(p => p.kind === 'name' || p.kind === 'relation')?.name || null;
      if (!withP && actor !== 'me' && ['call', 'message', 'meeting'].includes(type)) withP = 'me';
      let about = null;
      if (['suggestion', 'profile_received'].includes(type)) {
        const rel = objs.find(p => p.kind === 'relation' && p.base);
        about = rel ? rel.base : (objs.find(p => p.kind === 'name')?.name || null);
        if (type === 'profile_received' && rel) withP = 'me';
        if (type === 'suggestion' && about) withP = 'me';
      }
      if (/\babout ([A-Z][a-z]+)/.test(ct)) about = about || ct.match(/\babout ([A-Z][a-z]+)/)[1];
      if (type === 'date' && /(\w+) and i\b/i.test(ct)) withP = ps[0]?.name || withP;
      if (noPickup) { withP = subject; actor = 'me'; }
      if (type === 'suggestion' && !about && subject && subject !== 'me' && (ir.people.find(p => p.name === subject)?.role === 'single')) { about = subject; actor = null; withP = 'me'; }
      const cm = ct.match(COUNT);
      const count = cm ? (/^\d+$/.test(cm[1]) ? Number(cm[1]) : WORDNUM[cm[1].toLowerCase()] ?? null) : null;
      const out = ct.match(OUTCOME);
      const ev = { type, actor, with: withP, about, source: null, result: out ? ct.slice(out.index).trim() : null, count, when, negated: negated && !noPickup };
      ir.events.push(ev);
      lastEvent = ev;
    } else if (!type && !isTask && !answerRecorded) {
      const out = ct.match(OUTCOME) || (value && ct.match(/\b(said|says) (no|yes)\b/i));
      if (out && lastEvent && !lastEvent.result) lastEvent.result = ct.trim();
      else if (subject && subject !== 'me' && !ir.waiting.some(w => w.who === subject)) {
        ir.events.push({ type: 'note', actor: subject, with: null, about: null, source: null, result: ct.trim(), count: null, when, negated });
      } else if (!ir.answers.length && !ps.length && !ir.events.length && clauses.length === 1) {
        ir.events.push({ type: 'note', actor: 'me', with: null, about: null, source: null, result: null, count: null, when, negated });
      }
    }
    // "her name is Chaya" → the suggestion is about her
    const named = lc.match(/(?:her|his) name is (\w+)/);
    if (named) { const ev = [...ir.events].reverse().find(e => e.type === 'suggestion' && !e.about); if (ev) ev.about = ct.match(/name is (\w+)/i)[1]; }

    if (ps.length) lastPerson = ps[ps.length - 1].name;
    if (subject && subject !== 'me') lastSubject = subject;
    else if (ps.length) lastSubject = ps[0].name;
  }
  // roles from what people did in the note (two saved Rivkas → the one passing on news is the friend)
  for (const p of ir.people) {
    if (p.role !== 'other') continue;
    if (ir.answers.some(a => a.source === p.name) || ir.events.some(e => ['effort', 'suggestion', 'profile_received'].includes(e.type) && e.actor === p.name)
        || ir.waiting.some(w => w.who === p.name && /profile|idea|name|girl/.test(w.what || ''))) p.role = 'shadchan';
    else if (ir.answers.some(a => a.of === p.name)) p.role = 'single';
  }
  // "Dina's side said no" names Dina too
  for (const p of people.filter(x => x.kind === 'relation' && x.base && !/^(her|his|their|my)$/i.test(x.base))) {
    if (!ir.people.some(q => q.name.toLowerCase() === p.base.toLowerCase())) ir.people.push({ name: p.base, role: savedRole(p.base) || 'other', of: null });
  }
  if (!ir.events.length && !ir.answers.length && !ir.tasks.length && !ir.waiting.length)
    ir.events.push({ type: 'note', actor: 'me', with: null, about: null, source: null, result: null, count: null, when: null, negated: NEGATED_EVENT.test(text) });
  return { ir, spans };
}
