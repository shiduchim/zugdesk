// Fictional demo contacts. Everything here is invented; phone numbers use the
// reserved 555 range. Demo ids are fixed (demo_c_001 …) so loading is idempotent
// and "Remove all demo data" can find them by the `demo: true` flag.
//
// Field notes (spec/contacts.md CT-04): `communities` = communities the shadchan
// WORKS WITH; `background` = the shadchan's own affiliation. They are separate on purpose.

const CITIES = [
  ['Jerusalem','Israel'],['Bnei Brak','Israel'],['Beit Shemesh','Israel'],['Tzfat','Israel'],['Kfar Chabad','Israel'],
  ['Haifa','Israel'],['Petah Tikva','Israel'],['Brooklyn','USA'],['Lakewood','USA'],['Monsey','USA'],['Baltimore','USA'],
  ['Los Angeles','USA'],['Chicago','USA'],['Miami','USA'],['Toronto','Canada'],['Montreal','Canada'],['London','UK'],
  ['Manchester','UK'],['Antwerp','Belgium'],['Paris','France'],['Melbourne','Australia'],['Johannesburg','South Africa'],
];
const LANGS = ['English','Hebrew','Yiddish','French','Russian','Spanish','Portuguese','German'];
const COMMUNITIES = ['Chabad','Haredi','Litvish','Bukharian','Sephardi','Breslev','Dati Leumi','Modern Orthodox','Yeshivish'];
const ROLES = ['shadchan','reference','friend','family','helper'];
const STATUSES = ['none','waiting','follow-up','active'];
const METHODS = ['WhatsApp','Phone call','Email','Text message'];
const FIRST_F = ['Rivka','Chana','Miriam','Sara','Leah','Devorah','Esther','Shoshana','Tova','Malka','Bracha','Yehudit','Nechama','Tzippy','Faigy','Gitty','Rochel','Dina','Batya','Aliza','Shira','Michal','Noa','Tamar','Yael'];
const FIRST_M = ['Yosef','Moshe','Dovid','Shmuel','Avraham','Yaakov','Yitzchak','Eliyahu','Menachem','Shlomo','Chaim','Mordechai','Baruch','Tzvi','Aryeh','Yehuda','Nachman','Binyomin','Refael','Meir'];
const LAST = ['Cohen','Levi','Friedman','Goldberg','Katz','Weiss','Klein','Schwartz','Rosen','Berkowitz','Shapiro','Gross','Stern','Adler','Mizrahi','Peretz','Azoulay','Ben-David','Dahan','Biton','Abramov','Yusupov','Kagan','Horowitz','Lieberman','Mandel','Segal','Blau','Spitzer','Reich'];
const TITLES_F = ['Mrs.','Rebbetzin','Mrs.','Mrs.','Dr.'];
const TITLES_M = ['Rabbi','Mr.','Rabbi','Mr.','Dr.'];

// Hand-written first 20 so the starting app feels real and varied.
const CURATED = [
  { title:'Mrs.', firstName:'Rivka', lastName:'Cohen', g:'f', city:'Jerusalem', roles:['shadchan'], languages:['English','Hebrew'], communities:['Chabad','Dati Leumi'], background:'Chabad', status:'waiting', method:'WhatsApp', days:3, about:'Works mostly with families in Jerusalem and Beit Shemesh. Prefers a short written summary first.' },
  { title:'Rabbi', firstName:'Yosef', lastName:'Friedman', g:'m', city:'Brooklyn', roles:['shadchan','reference'], languages:['English','Yiddish'], communities:['Haredi','Yeshivish'], background:'Litvish', status:'follow-up', method:'Phone call', days:12, about:'Evenings only. Knows many learning families in Flatbush and Lakewood.' },
  { title:'Mrs.', firstName:'Chana', lastName:'Mizrahi', g:'f', city:'Bnei Brak', roles:['shadchan'], languages:['Hebrew','French'], communities:['Sephardi','Haredi'], background:'Sephardi', status:'active', method:'Phone call', days:1, about:'' },
  { title:'Rebbetzin', firstName:'Devorah', lastName:'Katz', g:'f', city:'Lakewood', roles:['shadchan'], languages:['English'], communities:['Yeshivish','Litvish'], background:'Litvish', status:'none', method:'Email', days:45, about:'Likes to receive a full profile with references before suggesting.' },
  { title:'Mr.', firstName:'Dovid', lastName:'Abramov', g:'m', city:'Queens', roles:['shadchan','friend'], languages:['English','Russian'], communities:['Bukharian'], background:'Bukharian', status:'waiting', method:'WhatsApp', days:6, about:'' },
  { title:'Mrs.', firstName:'Esther', lastName:'Azoulay', g:'f', city:'Paris', roles:['shadchan'], languages:['French','Hebrew','English'], communities:['Sephardi','Chabad'], background:'Chabad', status:'none', method:'WhatsApp', days:null, about:'Introduced by a cousin; not yet contacted.' },
  { title:'Rabbi', firstName:'Menachem', lastName:'Segal', g:'m', city:'Kfar Chabad', roles:['shadchan','reference'], languages:['Hebrew','English','Yiddish'], communities:['Chabad'], background:'Chabad', status:'follow-up', method:'Phone call', days:20, about:'Sent two ideas last year. Ask about the family from Tzfat.' },
  { title:'Mrs.', firstName:'Tova', lastName:'Berkowitz', g:'f', city:'Monsey', roles:['shadchan'], languages:['English','Yiddish'], communities:['Haredi'], background:'Haredi', status:'active', method:'Text message', days:2, about:'' },
  { title:'Dr.', firstName:'Miriam', lastName:'Rosen', g:'f', city:'Toronto', roles:['reference','friend'], languages:['English'], communities:[], background:'Modern Orthodox', status:'none', method:'Email', days:90, about:'Family friend; agreed to be a reference.' },
  { title:'Mrs.', firstName:'Malka', lastName:'Dahan', g:'f', city:'Beit Shemesh', roles:['shadchan'], languages:['Hebrew','English'], communities:['Dati Leumi','Sephardi'], background:'Dati Leumi', status:'waiting', method:'WhatsApp', days:9, about:'' },
  { title:'Rabbi', firstName:'Shmuel', lastName:'Horowitz', g:'m', city:'London', roles:['shadchan'], languages:['English','Yiddish'], communities:['Haredi','Litvish'], background:'Litvish', status:'none', method:'Phone call', days:60, about:'Golders Green. Slow to reply but thorough.' },
  { title:'Mrs.', firstName:'Shoshana', lastName:'Peretz', g:'f', city:'Tzfat', roles:['shadchan'], languages:['Hebrew','English'], communities:['Breslev','Chabad'], background:'Breslev', status:'follow-up', method:'WhatsApp', days:15, about:'' },
  { title:'Mrs.', firstName:'Faigy', lastName:'Klein', g:'f', city:'Antwerp', roles:['shadchan'], languages:['Yiddish','French','English'], communities:['Haredi'], background:'Haredi', status:'none', method:'Phone call', days:null, about:'' },
  { title:'Mr.', firstName:'Eliyahu', lastName:'Yusupov', g:'m', city:'Jerusalem', roles:['helper','friend'], languages:['Hebrew','Russian','English'], communities:['Bukharian'], background:'Bukharian', status:'none', method:'WhatsApp', days:30, about:'Helps with introductions in the Bukharian community; not a formal shadchan.' },
  { title:'Mrs.', firstName:'Nechama', lastName:'Gross', g:'f', city:'Baltimore', roles:['shadchan'], languages:['English','Hebrew'], communities:['Yeshivish','Modern Orthodox'], background:'Yeshivish', status:'waiting', method:'Email', days:5, about:'' },
  { title:'Rebbetzin', firstName:'Leah', lastName:'Lieberman', g:'f', city:'Melbourne', roles:['shadchan','reference'], languages:['English'], communities:['Chabad'], background:'Chabad', status:'none', method:'WhatsApp', days:120, about:'Time difference: best reached Sunday evening Israel time.' },
  { title:'Mrs.', firstName:'Gitty', lastName:'Spitzer', g:'f', city:'Brooklyn', roles:['shadchan'], languages:['Yiddish','English'], communities:['Haredi'], background:'Haredi', status:'active', method:'Phone call', days:4, about:'' },
  { title:'Rabbi', firstName:'Chaim', lastName:'Ben-David', g:'m', city:'Haifa', roles:['shadchan'], languages:['Hebrew'], communities:['Sephardi','Dati Leumi'], background:'Sephardi', status:'none', method:'Phone call', days:200, about:'' },
  { title:'Mrs.', firstName:'Batya', lastName:'Mandel', g:'f', city:'Manchester', roles:['shadchan'], languages:['English','Hebrew'], communities:['Litvish','Haredi'], background:'Litvish', status:'follow-up', method:'WhatsApp', days:11, about:'Asked for an updated short profile.' },
  { title:'', firstName:'רחל', lastName:'לוי', g:'f', city:'Petah Tikva', roles:['shadchan'], languages:['Hebrew'], communities:['Haredi','Sephardi'], background:'Haredi', status:'waiting', method:'WhatsApp', days:7, about:'מעדיפה הודעות בעברית.' },
];

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
function pickSome(rnd, arr, min, max) {
  const n = min + Math.floor(rnd() * (max - min + 1));
  const pool = [...arr]; const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}
const pad3 = n => String(n).padStart(3, '0');

function phoneFor(country, rnd, n) {
  const d = pad3(n).padStart(4, '0');
  if (country === 'Israel') return `05${2 + (n % 3)}-555-${d}`;
  if (country === 'UK') return `0044 7700 900${pad3(n % 1000)}`;
  if (country === 'France' || country === 'Belgium') return `0033 6 55 55 ${pad3(n % 1000).slice(0,2)} ${pad3(n % 1000).slice(1)}`;
  if (country === 'Australia') return `0061 4 5555 ${d}`;
  if (country === 'South Africa') return `0027 55 555 ${d}`;
  return `(${['212','718','732','845','410','323','312','305','416','514'][n % 10]}) 555-${d}`;
}

function build(i, base, rnd) {
  const id = `demo_c_${pad3(i)}`;
  const [city, country] = CITIES.find(c => c[0] === base.city) || [base.city, 'USA'];
  const daysAgo = base.days;
  const lastContactAt = daysAgo == null ? null : new Date(Date.now() - daysAgo * 86400000 - Math.floor(rnd() * 86400000)).toISOString();
  const createdAt = new Date(Date.now() - (365 + Math.floor(rnd() * 400)) * 86400000).toISOString();
  const email = base.roles.includes('shadchan') && rnd() > 0.35
    ? `${base.firstName.toLowerCase().replace(/[^a-z]/g, '') || 'contact'}.${base.lastName.toLowerCase().replace(/[^a-z]/g, '') || pad3(i)}@example.com` : '';
  return {
    id, demo: true,
    title: base.title, firstName: base.firstName, lastName: base.lastName,
    city, country,
    roles: base.roles, languages: base.languages, communities: base.communities,
    background: base.background,
    phone: phoneFor(country, rnd, i), email, preferredContact: base.method,
    status: base.status, lastContactAt,
    about: base.about || '',
    pinned: false, folderId: null,
    createdAt, updatedAt: lastContactAt || createdAt,
  };
}

function generated(i, rnd) {
  const g = rnd() > 0.6 ? 'm' : 'f';
  const [city] = pick(rnd, CITIES);
  const roles = rnd() > 0.2 ? ['shadchan'] : [pick(rnd, ROLES.slice(1))];
  if (rnd() > 0.75) roles.push(pick(rnd, ROLES.filter(r => !roles.includes(r))));
  const days = rnd() > 0.15 ? Math.floor(rnd() * rnd() * 400) : null;
  return {
    title: pick(rnd, g === 'f' ? TITLES_F : TITLES_M),
    firstName: pick(rnd, g === 'f' ? FIRST_F : FIRST_M), lastName: pick(rnd, LAST), g, city, roles,
    languages: pickSome(rnd, LANGS, 1, 3),
    communities: roles.includes('shadchan') ? pickSome(rnd, COMMUNITIES, 1, 3) : [],
    background: pick(rnd, COMMUNITIES),
    status: pick(rnd, STATUSES), method: pick(rnd, METHODS), days,
    about: rnd() > 0.7 ? pick(rnd, ['Prefers messages over calls.', 'Met at a wedding; said to send a profile.', 'Ask before Yom Tov season.', 'Works together with a partner shadchan.', 'Replies within a day or two.']) : '',
  };
}

export function makeDemoContacts(total = 200) {
  const rnd = mulberry32(20261107);
  const out = [];
  for (let i = 1; i <= total; i++) {
    const base = i <= CURATED.length ? CURATED[i - 1] : generated(i, rnd);
    out.push(build(i, base, rnd));
  }
  return out;
}

// ---------- fictional conversation history + follow-ups (Stage 2) ----------
// Fixed ids (demo_ev_<contact>_<n>) keep loading idempotent. Texts are generic and
// invented; they never claim an offer, a Yes/No answer or a delivered message.
const EVENT_TEXTS = {
  call: ['Spoke briefly. Asked for an updated résumé before suggesting anyone.', 'Called back in the evening. Will think about who might fit and get back to me.', 'Short call. Mentioned two families she wants to check with first.', 'Asked about my plans for the next year and preferred city.'],
  whatsapp: ['Sent my short profile. Reply: “Thank you, I will look at it this week.”', 'Asked if I am available to hear ideas after Yom Tov.', 'Wrote that she is still waiting for an answer from the other side.', 'Shared a name to look into; I asked for more details first.'],
  email: ['Received an email asking for two references.', 'Sent the updated profile by email. No reply recorded yet.', 'Email with a few questions about hashkafa and plans.'],
  text: ['Text: “Are you free to talk tomorrow evening?”', 'Texted a reminder about the profile I sent.'],
  note: ['Personal note: prefers short written summaries first.', 'Personal note: best reached after 8 PM.', 'Personal note: met at a wedding, very warm and organised.'],
};
const FU_TEXTS = ['Ask whether there is any news', 'Send updated short profile', 'Call back after Shabbos', 'Check if references were contacted'];
const TYPE_OF = { 'WhatsApp': 'whatsapp', 'Phone call': 'call', 'Email': 'email', 'Text message': 'text' };

export function makeDemoActivity(contacts) {
  const events = [], followUps = [];
  for (const c of contacts) {
    const n = parseInt((c.id.match(/(\d+)$/) || [])[1] || '0', 10);
    if (!n) continue;
    const rnd = mulberry32(9000 + n);
    if (!c.lastContactAt) continue; // nothing recorded stays nothing recorded
    const count = n <= 20 ? 2 + Math.floor(rnd() * 3) : (rnd() > 0.5 ? 1 : 0);
    let at = new Date(c.lastContactAt).getTime();
    for (let k = 0; k < count; k++) {
      const type = k === 0 ? (TYPE_OF[c.preferredContact] || 'call') : pick(rnd, ['call', 'whatsapp', 'email', 'text', 'note']);
      events.push({ id: `demo_ev_${pad3(n)}_${k + 1}`, demo: true, type, text: pick(rnd, EVENT_TEXTS[type]),
        at: new Date(at).toISOString(), contactIds: [c.id], personIds: [] });
      at -= (3 + Math.floor(rnd() * 40)) * 86400000;
    }
    if (c.status === 'follow-up') {
      const due = new Date(Date.now() + Math.floor(rnd() * 10 - 3) * 86400000).toISOString().slice(0, 10);
      followUps.push({ id: `demo_fu_${pad3(n)}`, demo: true, contactId: c.id, personId: null, text: pick(rnd, FU_TEXTS), dueAt: due, done: false });
    }
  }
  return { events, followUps };
}

// ---------- Stage 3/4: fictional suggested people ----------
// Linked to the hand-written starter contacts (demo_c_001 …). Originals are kept
// word for word as "received" text; extracted fields only hold what the text says.
export function makeDemoPeople() {
  const day = 86400000;
  const ago = (d) => new Date(Date.now() - d * day).toISOString();
  const P = [], SRC = [], INT = [], EV = [], FU = [];
  const card = (id, role, name, number, contactId = null) => ({ id, role, name, number, email: '', contactId });

  P.push({ id: 'demo_p_001', demo: true, kind: 'guy', name: 'Yehuda Stern', age: '29', city: 'Jerusalem', occupation: 'Accountant',
    languages: ['English', 'Hebrew'], about: 'Calm and organised. Learns every morning before work and enjoys hiking.',
    looking: 'Someone warm and sincere who values a Torah home.', maxAge: '28',
    contactCards: [card('k1', 'shadchan', 'Mrs. Rivka Cohen', '053-555-0001', 'demo_c_001'), card('k2', 'mother', 'Mrs. Stern', '052-555-7781')],
    sender: 'Mrs. Rivka Cohen', senderContactId: 'demo_c_001', know: ['Never spoke'], yearsKnown: '', howKnow: '',
    answers: { pStatus: ['Never been married'], pLevel: 'Strong', pBackground: ['Yeshivish'], pTraits: ['Kind', 'Quiet'] },
    religiousOther: '', contactIds: ['demo_c_001'], createdAt: ago(9), updatedAt: ago(9) });
  SRC.push({ id: 'demo_src_001', demo: true, personId: 'demo_p_001', sender: 'Mrs. Rivka Cohen', senderContactId: 'demo_c_001', receivedAt: ago(9),
    text: 'Name: Yehuda Stern\nAge: 29\nCity: Jerusalem\nOccupation: Accountant\nLanguages: English, Hebrew\n\nAbout: Calm and organised. Learns every morning before work and enjoys hiking.\nLooking for: Someone warm and sincere who values a Torah home.\nUp to age: 28\n\nShadchan: Mrs. Rivka Cohen 053-555-0001\nMother: Mrs. Stern 052-555-7781' });
  INT.push({ id: 'demo_int_001', demo: true, personId: 'demo_p_001', side: 'mine', value: 'Want to learn more', reason: 'Sounds serious and settled.', at: ago(8) });
  INT.push({ id: 'demo_int_002', demo: true, personId: 'demo_p_001', side: 'theirs', value: 'Checking availability', reason: '', reportedBy: 'Mrs. Rivka Cohen', reportedByContactId: 'demo_c_001', at: ago(6) });
  EV.push({ id: 'demo_pev_001', demo: true, type: 'whatsapp', contactIds: ['demo_c_001'], personIds: ['demo_p_001'], at: ago(6),
    text: 'Mrs. Cohen will ask the family whether he is available right now.' });
  FU.push({ id: 'demo_pfu_001', demo: true, personId: 'demo_p_001', contactId: 'demo_c_001', text: 'Ask Mrs. Cohen if she heard back', dueAt: ago(-3).slice(0, 10), done: false });

  P.push({ id: 'demo_p_002', demo: true, kind: 'guy', name: 'Dovid Weiss', age: '31', city: 'Lakewood', occupation: 'Software developer',
    languages: ['English', 'Yiddish'], about: 'Works part-time and learns afternoons. Friendly, enjoys music.', looking: '', maxAge: '',
    contactCards: [card('k1', 'shadchan', 'Rabbi Yosef Friedman', '(732) 555-0002', 'demo_c_002'), card('k2', 'reference', 'Rabbi Adler', ''), card('k3', 'unknown', '', '(848) 555-4410')],
    sender: 'Rebbetzin Devorah Katz', senderContactId: 'demo_c_004', know: [], yearsKnown: '', howKnow: '',
    answers: { pBackground: ['Yeshivish'], pTraits: ['Outgoing'] },
    religiousOther: '', contactIds: ['demo_c_002', 'demo_c_004'], createdAt: ago(20), updatedAt: ago(4) });
  SRC.push({ id: 'demo_src_002', demo: true, personId: 'demo_p_002', sender: 'Rabbi Yosef Friedman', senderContactId: 'demo_c_002', receivedAt: ago(20),
    text: 'Dovid Weiss, 31, Lakewood.\nSoftware developer, learns afternoons.\nShadchan: Rabbi Yosef Friedman (732) 555-0002\nReference: Rabbi Adler' });
  SRC.push({ id: 'demo_src_003', demo: true, personId: 'demo_p_002', sender: 'Rebbetzin Devorah Katz', senderContactId: 'demo_c_004', receivedAt: ago(4),
    text: 'Name: Dovid Weiss\nAge: 31\nCity: Lakewood\nOccupation: Software developer\nAbout: Works part-time and learns afternoons. Friendly, enjoys music.\nContact: (848) 555-4410' });
  INT.push({ id: 'demo_int_003', demo: true, personId: 'demo_p_002', side: 'mine', value: 'Not sure yet', reason: 'Want to hear from a reference first.', at: ago(4) });

  P.push({ id: 'demo_p_003', demo: true, kind: 'girl', name: 'Shira Adler', age: '27', city: 'Beit Shemesh', occupation: 'Teacher',
    languages: ['Hebrew', 'English'], about: 'Teaches second grade. Family-oriented and enjoys long walks.', looking: 'A kind, growing person who values learning.', maxAge: '',
    contactCards: [card('k1', 'shadchan', 'Mrs. Malka Dahan', '053-555-0010', 'demo_c_010')],
    sender: 'Mrs. Malka Dahan', senderContactId: 'demo_c_010', know: ['Talked by phone'], yearsKnown: '', howKnow: 'Spoke once about a community event',
    answers: { pStatus: ['Never been married'], pBackground: ['Dati Leumi'] },
    religiousOther: '', contactIds: ['demo_c_010'], createdAt: ago(12), updatedAt: ago(12) });
  SRC.push({ id: 'demo_src_004', demo: true, personId: 'demo_p_003', sender: 'Mrs. Malka Dahan', senderContactId: 'demo_c_010', receivedAt: ago(12),
    text: 'Name: Shira Adler\nAge: 27\nCity: Beit Shemesh\nOccupation: Teacher\nLanguages: Hebrew, English\nAbout: Teaches second grade. Family-oriented and enjoys long walks.\nLooking for: A kind, growing person who values learning.\nShadchan: Mrs. Malka Dahan 053-555-0010' });

  P.push({ id: 'demo_p_004', demo: true, kind: 'girl', name: 'נועה ברק', age: '26', city: 'Petah Tikva', occupation: 'אחות',
    languages: ['Hebrew'], about: 'שמחה, חמה ואוהבת לעזור.', looking: '', maxAge: '',
    contactCards: [card('k1', 'shadchan', 'רחל לוי', '054-555-0020', 'demo_c_020')],
    sender: 'רחל לוי', senderContactId: 'demo_c_020', know: [], yearsKnown: '', howKnow: '',
    answers: {}, religiousOther: '', contactIds: ['demo_c_020'], createdAt: ago(3), updatedAt: ago(3) });
  SRC.push({ id: 'demo_src_005', demo: true, personId: 'demo_p_004', sender: 'רחל לוי', senderContactId: 'demo_c_020', receivedAt: ago(3),
    text: 'שם: נועה ברק\nגיל: 26\nעיר: Petah Tikva\nמקצוע: אחות\nעל עצמי: שמחה, חמה ואוהבת לעזור.\nשדכנית: רחל לוי 054-555-0020' });

  // Saved for later: an original whose owner is not filed yet.
  SRC.push({ id: 'demo_src_006', demo: true, personId: null, sender: '', senderContactId: null, receivedAt: ago(1),
    text: 'Forwarded from a group:\n30, Brooklyn, works in IT. Looking for someone kind and steady.\nContact: (718) 555-9032' });
  return { people: P, sources: SRC, interests: INT, events: EV, followUps: FU };
}

// Stage 5: fictional formal offers for the demo people (one couple = me + one person).
// Lanes: Yehuda = In Progress (Date 1 happened, Date 2 arranged); Dovid = Offer (waiting
// for his answer); Shira = 2nd Try in progress with the 1st Try ended; Noa = Ended (said No).
export function makeDemoShidduchim() {
  const day = 86400000, hour = 3600000;
  const ago = (d, hrs = 0) => new Date(Date.now() - d * day - hrs * hour).toISOString();
  const local = (d, hrs) => { const x = new Date(Date.now() - d * day); x.setHours(hrs, 0, 0, 0); const p = (n) => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:00`; };
  const O = [], T = [], E = [], D = [];
  const ev = (id, tryId, offerId, text, at, extra = {}) => E.push({ id, demo: true, tryId, offerId, text, source: '', eventAt: null, kind: 'note', at, ...extra });

  // Yehuda Stern — In Progress
  O.push({ id: 'demo_off_001', demo: true, personId: 'demo_p_001', personName: 'Yehuda Stern', contactId: 'demo_c_001', status: 'progress', createdAt: ago(8), updatedAt: ago(1) });
  T.push({ id: 'demo_try_001', demo: true, offerId: 'demo_off_001', personId: 'demo_p_001', n: 1, myAnswer: 'Yes', theirAnswer: 'Yes', refsChecked: true, phase: 'dating', endedBy: null, endedReason: '', endedAt: null, startedAt: ago(8), createdAt: ago(8), updatedAt: ago(1) });
  ev('demo_sev_001', 'demo_try_001', 'demo_off_001', 'Offer recorded.', ago(8), { kind: 'offer' });
  ev('demo_sev_002', 'demo_try_001', 'demo_off_001', 'References checked.', ago(7, 3), { kind: 'refs' });
  ev('demo_sev_003', 'demo_try_001', 'demo_off_001', 'Me: Yes.', ago(6, 5), { kind: 'answer' });
  ev('demo_sev_004', 'demo_try_001', 'demo_off_001', 'Yehuda: Yes.', ago(6, 1), { kind: 'answer', source: 'Mrs. Rivka Cohen' });
  ev('demo_sev_005', 'demo_try_001', 'demo_off_001', 'Both said Yes; moved to In Progress.', ago(6, 1), { kind: 'stage' });
  D.push({ id: 'demo_dt_001', demo: true, tryId: 'demo_try_001', offerId: 'demo_off_001', n: 1, when: local(3, 19), where: 'Hotel lobby, Jerusalem', status: 'Happened', feedback: 'Easy to talk to. Would like to meet again.', at: ago(5), createdAt: ago(5), updatedAt: ago(2) });
  ev('demo_sev_006', 'demo_try_001', 'demo_off_001', 'Date 1 happened.', ago(2, 20), { kind: 'date', eventAt: local(3, 19) });
  D.push({ id: 'demo_dt_002', demo: true, tryId: 'demo_try_001', offerId: 'demo_off_001', n: 2, when: local(-4, 19), where: 'Jerusalem', status: 'Arranged', feedback: '', at: ago(1), createdAt: ago(1), updatedAt: ago(1) });
  ev('demo_sev_007', 'demo_try_001', 'demo_off_001', 'Date 2 arranged.', ago(1), { kind: 'date' });

  // Dovid Weiss — Offer, waiting for his answer
  O.push({ id: 'demo_off_002', demo: true, personId: 'demo_p_002', personName: 'Dovid Weiss', contactId: 'demo_c_002', status: 'offers', createdAt: ago(3), updatedAt: ago(2) });
  T.push({ id: 'demo_try_002', demo: true, offerId: 'demo_off_002', personId: 'demo_p_002', n: 1, myAnswer: 'Yes', theirAnswer: '', refsChecked: false, phase: 'checking', endedBy: null, endedReason: '', endedAt: null, startedAt: ago(3), createdAt: ago(3), updatedAt: ago(2) });
  ev('demo_sev_010', 'demo_try_002', 'demo_off_002', 'Offer recorded. Waiting for Dovid’s answer.', ago(3), { kind: 'offer' });
  ev('demo_sev_011', 'demo_try_002', 'demo_off_002', 'Me: Yes.', ago(2), { kind: 'answer' });

  // Shira Adler — 1st Try ended after two dates; 2nd Try just started, both Yes, Date 1 arranged
  O.push({ id: 'demo_off_003', demo: true, personId: 'demo_p_003', personName: 'Shira Adler', contactId: 'demo_c_010', status: 'progress', createdAt: ago(120), updatedAt: ago(0, 6) });
  T.push({ id: 'demo_try_003', demo: true, offerId: 'demo_off_003', personId: 'demo_p_003', n: 1, myAnswer: 'Yes', theirAnswer: 'No', refsChecked: true, phase: 'ended', endedBy: 'them', endedReason: 'Timing was not right.', endedAt: ago(100), startedAt: ago(120), createdAt: ago(120), updatedAt: ago(100) });
  ev('demo_sev_020', 'demo_try_003', 'demo_off_003', 'Offer recorded.', ago(120), { kind: 'offer' });
  ev('demo_sev_021', 'demo_try_003', 'demo_off_003', 'References checked.', ago(118), { kind: 'refs' });
  ev('demo_sev_022', 'demo_try_003', 'demo_off_003', 'Both said Yes; moved to In Progress.', ago(116), { kind: 'stage' });
  D.push({ id: 'demo_dt_010', demo: true, tryId: 'demo_try_003', offerId: 'demo_off_003', n: 1, when: local(112, 19), where: 'Beit Shemesh', status: 'Happened', feedback: '', at: ago(113), createdAt: ago(113), updatedAt: ago(112) });
  ev('demo_sev_023', 'demo_try_003', 'demo_off_003', 'Date 1 happened.', ago(111, 20), { kind: 'date', eventAt: local(112, 19) });
  D.push({ id: 'demo_dt_011', demo: true, tryId: 'demo_try_003', offerId: 'demo_off_003', n: 2, when: local(105, 19), where: 'Jerusalem', status: 'Happened', feedback: '', at: ago(107), createdAt: ago(107), updatedAt: ago(105) });
  ev('demo_sev_024', 'demo_try_003', 'demo_off_003', 'Date 2 happened.', ago(104, 20), { kind: 'date', eventAt: local(105, 19) });
  ev('demo_sev_025', 'demo_try_003', 'demo_off_003', 'Shira: No. The shidduch ended. Reason: Timing was not right.', ago(100), { kind: 'ended', source: 'Mrs. Malka Dahan' });
  T.push({ id: 'demo_try_004', demo: true, offerId: 'demo_off_003', personId: 'demo_p_003', n: 2, myAnswer: 'Yes', theirAnswer: 'Yes', refsChecked: false, phase: 'dating', endedBy: null, endedReason: '', endedAt: null, startedAt: ago(2), createdAt: ago(2), updatedAt: ago(0, 6) });
  ev('demo_sev_030', 'demo_try_004', 'demo_off_003', 'The 2nd Try started.', ago(2), { kind: 'try' });
  ev('demo_sev_031', 'demo_try_004', 'demo_off_003', 'Me: Yes.', ago(1, 8), { kind: 'answer' });
  ev('demo_sev_032', 'demo_try_004', 'demo_off_003', 'Shira: Yes.', ago(1, 2), { kind: 'answer', source: 'Mrs. Malka Dahan' });
  ev('demo_sev_033', 'demo_try_004', 'demo_off_003', 'Both said Yes; moved to In Progress.', ago(1, 2), { kind: 'stage' });
  D.push({ id: 'demo_dt_020', demo: true, tryId: 'demo_try_004', offerId: 'demo_off_003', n: 1, when: local(-6, 20), where: 'Jerusalem', status: 'Arranged', feedback: '', at: ago(0, 6), createdAt: ago(0, 6), updatedAt: ago(0, 6) });
  ev('demo_sev_034', 'demo_try_004', 'demo_off_003', 'Date 1 arranged.', ago(0, 6), { kind: 'date' });

  // נועה ברק — Ended: she said No after references
  O.push({ id: 'demo_off_004', demo: true, personId: 'demo_p_004', personName: 'נועה ברק', contactId: 'demo_c_020', status: 'ended', createdAt: ago(30), updatedAt: ago(20) });
  T.push({ id: 'demo_try_005', demo: true, offerId: 'demo_off_004', personId: 'demo_p_004', n: 1, myAnswer: 'Thinking', theirAnswer: 'No', refsChecked: true, phase: 'ended', endedBy: 'them', endedReason: '', endedAt: ago(20), startedAt: ago(30), createdAt: ago(30), updatedAt: ago(20) });
  ev('demo_sev_040', 'demo_try_005', 'demo_off_004', 'Offer recorded.', ago(30), { kind: 'offer' });
  ev('demo_sev_041', 'demo_try_005', 'demo_off_004', 'Me: Thinking.', ago(28), { kind: 'answer' });
  ev('demo_sev_042', 'demo_try_005', 'demo_off_004', 'References checked.', ago(25), { kind: 'refs' });
  ev('demo_sev_043', 'demo_try_005', 'demo_off_004', 'נועה: No. The shidduch ended.', ago(20), { kind: 'ended', source: 'רחל לוי' });
  return { offers: O, tries: T, stageEvents: E, dateEvents: D };
}

// ---------- Stage 6: fictional Home notes ----------
// A note is one record (title, colour, pin, links). Its dated entries are conversation
// records (events with noteId), so they also show in the linked contact / person history.
export function makeDemoNotes() {
  const day = 86400000, hour = 3600000;
  const ago = (d, hrs = 0) => new Date(Date.now() - d * day - hrs * hour).toISOString();
  const dayAhead = (d) => new Date(Date.now() + d * day).toISOString().slice(0, 10);
  const N = [], E = [], F = [], A = [];
  const note = (id, title, color, pinned, contactIds, personIds, entries) => {
    N.push({ id, demo: true, title, color, pinned, contactIds, personIds, createdAt: entries[0][1], updatedAt: entries[entries.length - 1][1] });
    entries.forEach(([text, at], i) => E.push({ id: `${id}_e${i + 1}`, demo: true, noteId: id, type: 'note', contactIds, personIds, text, at }));
  };
  note('demo_note_001', 'Mrs. Cohen about Yehuda Stern', 'blue', true, ['demo_c_001'], ['demo_p_001'], [
    ['Spoke to Mrs. Cohen about Yehuda Stern. She will ask the family whether he is available right now.', ago(6, 2)],
    ['Called Mrs. Cohen again. She heard back: they are happy to go ahead. References next.', ago(2, 4)]]);
  note('demo_note_002', 'Questions to ask references', 'yellow', true, [], [], [
    ['Ask about character, kindness, family values and how he treats people. Remember to listen carefully and write it down right after.', ago(12)]]);
  note('demo_note_003', 'Dovid Weiss — second suggestion', 'peach', false, ['demo_c_004'], ['demo_p_002'], [
    ['Rebbetzin Katz sent Dovid Weiss again — Rabbi Friedman suggested him last month too.', ago(4, 3)],
    ['Want to hear from Rabbi Adler (reference) before deciding.', ago(4, 1)]]);
  note('demo_note_004', 'Rabbi Friedman has new ideas', 'plain', false, ['demo_c_002'], [], [
    ['Rabbi Friedman says he has a few new ideas. Call him back next week.', ago(1, 5)]]);
  note('demo_note_005', 'Shira Adler — 2nd try', 'green', false, ['demo_c_010'], ['demo_p_003'], [
    ['Mrs. Dahan says Shira agreed to try again. Date 1 is arranged.', ago(1, 1)]]);
  F.push({ id: 'demo_hfu_001', demo: true, noteId: 'demo_note_004', contactId: 'demo_c_002', personId: null, kind: 'task', text: 'Call Rabbi Friedman back about his new ideas', dueAt: dayAhead(6), done: false, createdAt: ago(1, 5) });
  F.push({ id: 'demo_hfu_002', demo: true, noteId: null, contactId: 'demo_c_003', personId: null, kind: 'waiting', text: 'Waiting for Mrs. Mizrahi to send the profile she mentioned', dueAt: null, done: false, createdAt: ago(3) });
  F.push({ id: 'demo_hfu_003', demo: true, noteId: 'demo_note_003', contactId: 'demo_c_004', personId: 'demo_p_002', kind: 'task', text: 'Ask Rabbi Adler about Dovid Weiss', dueAt: dayAhead(2), done: true, doneAt: ago(0, 3), createdAt: ago(4, 1) });
  A.push({ id: 'demo_act_001', demo: true, at: ago(2, 3), what: 'Changed note colour', text: 'Mrs. Cohen about Yehuda Stern · Blue', noteId: 'demo_note_001', contactIds: [], personIds: [], href: null });
  return { notes: N, events: E, followUps: F, activity: A };
}

// ---------- Stage 7: a fictional example owner profile ----------
// Same sample identity as the My Profile design (source/My Profile.html). Marked demo so
// "Remove all demo data" clears it; the first real edit turns it into the owner's own record.
export function makeDemoProfile() {
  const day = 86400000;
  const ago = (d) => new Date(Date.now() - d * day).toISOString();
  const facts = [
    ['f_bg', 'Religious background', 'Chabad'], ['f_learn', 'Learning', 'Daily learning seder'],
    ['f_edu', 'Education', 'Yeshiva in Israel; degree in architecture'], ['f_height', 'Height', '178 cm'],
    ['f_lang', 'Languages', 'Hebrew, English, Russian'], ['f_status', 'Status', 'Never married'],
    ['f_family', 'Family', 'Parents in Jerusalem; 2 married sisters, 1 brother'], ['f_int', 'Interests', 'Hiking, piano, cooking for friends'],
    ['f_kohen', 'Kohen', 'No'],
  ].map(([id, label, value]) => ({ id, label, value }));
  const profile = { id: 'me', demo: true, name: 'Daniel Ben-Ami', age: '34', city: 'Jerusalem', occupation: 'Architect',
    intro: 'An architect who loves good conversations and a welcoming home.', facts,
    about: 'Warm, thoughtful, and down to earth. I enjoy learning, good conversations, and making a home feel welcoming. Weekends are for a long walk, a good sefer, and cooking something for whoever shows up.',
    looking: 'A kind, sincere woman who values Torah, warmth, and building a happy home together. Someone who laughs easily and takes people seriously.',
    sections: [],
    contact: { inquiriesName: 'Mrs. Rivka Ben-Ami (mother)', inquiriesPhone: '052-555-0118', phone: '052-555-0177', email: 'daniel.benami@example.com' },
    references: [
      { id: 'ref_1', name: 'Rabbi Moshe Levi', relation: 'My rosh yeshiva', phone: '02-555-0144', privateNote: 'Ask him first before giving out his number.' },
      { id: 'ref_2', name: 'Mr. Avi Shapiro', relation: 'Friend since yeshiva', phone: '054-555-0190', privateNote: '' }],
    shortFacts: ['f_bg', 'f_learn', 'f_edu', 'f_height', 'f_lang'],
    lang: 'en', translations: {}, createdAt: ago(30), updatedAt: ago(18) };
  const cohenText = 'Name: Daniel Ben-Ami\nAge: 34\nCity: Jerusalem\nWork: Architect at a design studio\nBackground: Chabad\nHeight: 178 cm\nLooking for: A kind, sincere woman who values Torah, warmth, and building a happy home together.\nPhotos available on request.';
  const versions = [{ id: 'demo_pv_001', demo: true, title: 'Mrs. Cohen', lang: 'en', text: cohenText, savedAt: ago(16), createdAt: ago(16) }];
  const notes = [
    { id: 'demo_note_me1', demo: true, me: true, title: 'Ask Rabbi Levi if he’ll be a reference', color: 'plain', pinned: false, contactIds: [], personIds: [], createdAt: ago(9), updatedAt: ago(9) },
    { id: 'demo_note_me2', demo: true, me: true, title: 'Mrs. Cohen will show my profile', color: 'plain', pinned: false, contactIds: ['demo_c_001'], personIds: [], createdAt: ago(5), updatedAt: ago(5) }];
  const events = [
    { id: 'demo_note_me1_e1', demo: true, noteId: 'demo_note_me1', type: 'note', contactIds: [], personIds: [], text: 'Ask Rabbi Levi if he’ll be a reference.', at: ago(9) },
    { id: 'demo_note_me2_e1', demo: true, noteId: 'demo_note_me2', type: 'note', contactIds: ['demo_c_001'], personIds: [], text: 'Mrs. Cohen will show my profile to the Levin family this week. Call her Thursday.', at: ago(5) }];
  const shares = [{ id: 'demo_sh_001', demo: true, at: ago(5), createdAt: ago(5), recipientContactId: 'demo_c_001', recipientName: 'Mrs. Rivka Cohen', channel: 'whatsapp',
    what: 'Short version · Mrs. Cohen', text: cohenText, files: [], confirmed: true }];
  return { profile, versions, notes, events, shares };
}
