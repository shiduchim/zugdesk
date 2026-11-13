// Fictional demo data for Shadchan Mode: 60 singles (30 guys, 30 girls), a few contacts,
// originals, conversations, notes and follow-ups. Everything is invented; phone numbers use the
// reserved 555 range. Ids are fixed (demo_s_g01 …) so loading is idempotent, and every record
// has demo:true so Settings can remove it without touching what the shadchan typed.
//
// A single is a `people` record, the same shape Add Person saves, plus the Shadchan Mode
// fields described in spec/shadchan/build-notes.md: status, starred, minAge, talkTo, confirmedAt.

const day = 86400000;
const ago = (d, hours = 0) => new Date(Date.now() - d * day - hours * 3600000).toISOString();
const ahead = (d) => new Date(Date.now() + d * day).toISOString().slice(0, 10);
const pad2 = (n) => String(n).padStart(2, '0');

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const GUYS = ['Yehuda', 'Dovid', 'Moshe', 'Shmuel', 'Avraham', 'Yaakov', 'Yitzchak', 'Eliyahu', 'Menachem', 'Shlomo',
  'Chaim', 'Mordechai', 'Baruch', 'Tzvi', 'Aryeh', 'Nachman', 'Binyomin', 'Refael', 'Meir', 'Yosef',
  'Aharon', 'Shimon', 'Levi', 'Nosson', 'Pinchas', 'Gavriel', 'Ezra', 'Akiva', 'Yonah', 'Daniel'];
const GIRLS = ['Chana', 'Rivka', 'Miriam', 'Sara', 'Leah', 'Devorah', 'Esther', 'Shoshana', 'Tova', 'Malka',
  'Bracha', 'Yehudit', 'Nechama', 'Tzippy', 'Faigy', 'Gitty', 'Rochel', 'Dina', 'Batya', 'Aliza',
  'Shira', 'Michal', 'Noa', 'Tamar', 'Yael', 'Ahuva', 'Chaya', 'Elisheva', 'Penina', 'Hadassah'];
const LAST = ['Stern', 'Levy', 'Friedman', 'Goldberg', 'Katz', 'Weiss', 'Klein', 'Schwartz', 'Rosen', 'Berkowitz',
  'Shapiro', 'Gross', 'Adler', 'Mizrahi', 'Peretz', 'Azoulay', 'Ben-David', 'Dahan', 'Biton', 'Abramov',
  'Kagan', 'Horowitz', 'Lieberman', 'Mandel', 'Segal', 'Blau', 'Spitzer', 'Reich', 'Cohen', 'Feldman'];
// city, country, languages usually spoken there, a phone pattern
const CITIES = [
  ['Jerusalem', 'Israel', ['Hebrew', 'English']], ['Bnei Brak', 'Israel', ['Hebrew', 'Yiddish']], ['Beit Shemesh', 'Israel', ['English', 'Hebrew']],
  ['Brooklyn', 'USA', ['English', 'Yiddish']], ['Lakewood', 'USA', ['English']], ['Monsey', 'USA', ['English', 'Yiddish']],
  ['London', 'UK', ['English']], ['Manchester', 'UK', ['English']], ['Toronto', 'Canada', ['English']],
  ['Baltimore', 'USA', ['English']], ['Kfar Chabad', 'Israel', ['Hebrew', 'English']], ['Antwerp', 'Belgium', ['Yiddish', 'English']],
];
const BACKGROUNDS = ['Chabad', 'Yeshivish', 'Litvish', 'Sephardi', 'Dati Leumi', 'Breslev', 'Haredi'];
const WORK_GUY = ['Learns full time in yeshiva', 'Learns mornings, works in computers', 'Accountant', 'Electrician', 'Teaches in a cheder',
  'Works in sales', 'Software developer', 'Sofer', 'Studying nursing', 'Runs a small business', 'Paramedic', 'Graphic designer'];
const WORK_GIRL = ['Teacher', 'Preschool teacher', 'Nurse', 'Speech therapist', 'Bookkeeper', 'Graphic designer',
  'Secretary', 'Studying occupational therapy', 'Programmer', 'Social worker', 'Special education teacher', 'Office manager'];
const ABOUT = ['Warm and easy to talk to.', 'Quiet at first, with a good sense of humour.', 'Organised and dependable.',
  'Loves learning and keeps a regular chavrusa.', 'Outgoing; always helping at community events.', 'Thoughtful and a good listener.',
  'Cheerful and hard-working.', 'Serious about growth and down to earth.', 'Close with the family; enjoys hosting guests.', ''];
const LOOKING = ['Someone kind and sincere who wants a Torah home.', 'A calm, positive person with good middos.',
  'Someone who values learning and family.', 'Open to living in Israel or abroad.', 'A warm person from a similar background.', '', ''];

function phone(country, n) {
  const d = String(1000 + n).slice(-4);
  if (country === 'Israel') return `05${2 + (n % 3)}-555-${d}`;
  if (country === 'UK') return `0044 7700 90${d}`;
  if (country === 'Belgium') return `0032 470 55 ${d.slice(0, 2)} ${d.slice(2)}`;
  return `(${['718', '732', '845', '416', '410'][n % 5]}) 555-${d}`;
}

// Fictional contacts: parents, other shadchanim who send profiles, references, a rav.
const CONTACTS = [
  ['Mrs.', 'Gittel', 'Stern', 'Jerusalem', 'Israel', ['parent'], 'Mother of Yehuda Stern. Best reached in the evening.', 2],
  ['Mrs.', 'Bracha', 'Levy', 'Brooklyn', 'USA', ['parent'], 'Mother of Chana Levy.', 5],
  ['Mr.', 'Shimon', 'Friedman', 'Lakewood', 'USA', ['parent'], 'Father of Moshe Friedman. Prefers a phone call.', 20],
  ['Mrs.', 'Henny', 'Goldberg', 'London', 'UK', ['parent'], 'Mother of Sara Goldberg.', 9],
  ['Mrs.', 'Zahava', 'Katz', 'Beit Shemesh', 'Israel', ['parent'], '', null],
  ['Mrs.', 'Rivka', 'Cohen', 'Jerusalem', 'Israel', ['shadchan'], 'Sends profiles from her seminary girls. Replies within a day.', 1],
  ['Rabbi', 'Yosef', 'Feldman', 'Brooklyn', 'USA', ['shadchan', 'reference'], 'Knows many yeshiva guys personally.', 12],
  ['Mrs.', 'Devorah', 'Mandel', 'Manchester', 'UK', ['shadchan'], 'Works mostly with the UK and Antwerp.', 30],
  ['Mrs.', 'Malka', 'Dahan', 'Bnei Brak', 'Israel', ['shadchan'], '', 60],
  ['Rabbi', 'Aharon', 'Segal', 'Kfar Chabad', 'Israel', ['rav'], 'Families ask him before going ahead.', 45],
  ['Mrs.', 'Tova', 'Reich', 'Monsey', 'USA', ['reference'], 'Taught several of the girls; gives careful answers.', 15],
  ['Mr.', 'Baruch', 'Blau', 'Toronto', 'Canada', ['reference', 'other'], '', null],
];

function contact(i) {
  const [title, firstName, lastName, city, country, roles, about, days] = CONTACTS[i];
  const id = `demo_s_c${pad2(i + 1)}`;
  const lastContactAt = days == null ? null : ago(days, i);
  const createdAt = ago(200 + i * 9);
  return {
    id, demo: true, title, firstName, lastName, city, country, roles,
    languages: CITIES.find(c => c[0] === city)[2], communities: [], background: '',
    phone: phone(country, 900 + i), email: '', preferredContact: i % 2 ? 'Phone call' : 'WhatsApp',
    status: 'none', lastContactAt, about, pinned: i === 5, folderId: null,
    createdAt, updatedAt: lastContactAt || createdAt,
  };
}
const fullName = (c) => [c.title, c.firstName, c.lastName].filter(Boolean).join(' ');

// The first three guys and girls are tied to the contacts above so the demo shows real links.
const TIES = {
  g1: { last: 'Stern', city: 'Jerusalem', parent: 0, sender: 5 }, g3: { last: 'Friedman', city: 'Lakewood', parent: 2, sender: 6 },
  r1: { last: 'Levy', city: 'Brooklyn', parent: 1, sender: 6 }, r4: { last: 'Goldberg', city: 'London', parent: 3, sender: 7 },
};

function single(kind, i, rnd, contacts) {
  const guy = kind === 'guy';
  const n = i + 1;
  const id = `demo_s_${guy ? 'g' : 'r'}${pad2(n)}`;
  const tie = TIES[(guy ? 'g' : 'r') + n] || null;
  const first = (guy ? GUYS : GIRLS)[i];
  const last = tie ? tie.last : LAST[(i * 7 + (guy ? 3 : 11)) % LAST.length];
  const [city, country, langs] = tie ? CITIES.find(c => c[0] === tie.city) : CITIES[Math.floor(rnd() * CITIES.length)];
  // A few have no age on file: unknown stays unknown, it is never guessed.
  const ageKnown = n % 9 !== 0;
  const ageN = guy ? 21 + Math.floor(rnd() * 12) : 19 + Math.floor(rnd() * 11);
  const age = ageKnown ? String(ageN) : '';
  const wants = ageKnown && rnd() > 0.3;
  const minAge = wants ? String(guy ? Math.max(18, ageN - 6) : Math.max(19, ageN - 1)) : '';
  const maxAge = wants ? String(guy ? ageN : ageN + 6) : '';
  const occupation = rnd() > 0.1 ? (guy ? WORK_GUY : WORK_GIRL)[Math.floor(rnd() * 12)] : '';
  const about = ABOUT[Math.floor(rnd() * ABOUT.length)];
  const looking = LOOKING[Math.floor(rnd() * LOOKING.length)];
  const background = BACKGROUNDS[Math.floor(rnd() * BACKGROUNDS.length)];
  const status = n === 12 ? 'engaged' : n === 19 ? 'not-relevant' : n % 15 === 4 ? 'busy' : n % 10 === 7 ? 'paused' : 'available';

  const cards = [];
  const parentC = tie ? contacts[tie.parent] : null;
  const senderC = tie ? contacts[tie.sender] : (n % 4 === 0 ? contacts[5 + (n % 4 + i) % 4] : null);
  const viaFather = !parentC && n % 6 === 0;
  cards.push(parentC
    ? { id: 'k1', role: parentC.title === 'Mr.' ? 'father' : 'mother', name: fullName(parentC), number: parentC.phone, email: '', contactId: parentC.id }
    : { id: 'k1', role: viaFather ? 'father' : 'mother', name: `${viaFather ? 'Mr.' : 'Mrs.'} ${last}`, number: phone(country, (guy ? 100 : 300) + n), email: '', contactId: null });
  if (n % 3 === 0) cards.push({ id: 'k2', role: 'person', name: `${first} ${last}`, number: phone(country, (guy ? 500 : 700) + n), email: '', contactId: null });
  if (senderC) cards.push({ id: 'k3', role: 'shadchan', name: fullName(senderC), number: senderC.phone, email: '', contactId: senderC.id });
  // Whom the shadchan actually talks to about this single: a parent, the single, or another shadchan.
  const talkTo = senderC && n % 8 === 0 ? 'k3' : cards.some(c => c.id === 'k2') && n % 6 === 3 ? 'k2' : 'k1';

  const createdAt = ago(20 + Math.floor(rnd() * 300));
  const p = {
    id, demo: true, kind, name: `${first} ${last}`, age, city, occupation, languages: langs,
    about, looking, minAge, maxAge, contactCards: cards,
    sender: senderC ? fullName(senderC) : '', senderContactId: senderC ? senderC.id : null,
    know: n % 5 === 0 ? ['Met in person'] : n % 5 === 1 ? ['Talked by phone'] : [], yearsKnown: '', howKnow: '',
    answers: { pStatus: [n === 22 ? 'Divorced' : 'Never been married'], pBackground: [background] },
    religiousOther: '', contactIds: [parentC, senderC].filter(Boolean).map(c => c.id),
    status, starred: n % 5 === 1, talkTo,
    confirmedAt: ago(3 + Math.floor(rnd() * 200)).slice(0, 10),
    createdAt, updatedAt: createdAt,
  };
  if (status === 'busy') p.busyUntil = ahead(14 + n);
  return p;
}

// The profile as it "arrived": only what the record holds, in the labelled lines Add Person reads.
function original(p, contacts) {
  const lines = [`Name: ${p.name}`];
  if (p.age) lines.push(`Age: ${p.age}`);
  lines.push(`City: ${p.city}`);
  if (p.occupation) lines.push(`Occupation: ${p.occupation}`);
  lines.push(`Languages: ${p.languages.join(', ')}`);
  if (p.about) lines.push('', `About: ${p.about}`);
  if (p.looking) lines.push(`Looking for: ${p.looking}`);
  if (p.maxAge) lines.push(`Up to age: ${p.maxAge}`);
  lines.push('');
  for (const c of p.contactCards) {
    if (c.role === 'person') lines.push(`Own phone: ${c.number}`);
    else lines.push(`${c.role[0].toUpperCase() + c.role.slice(1)}: ${c.name} ${c.number}`);
  }
  return { id: p.id.replace('demo_s_', 'demo_s_src_'), demo: true, personId: p.id, kind: p.kind,
    sender: p.sender, senderContactId: p.senderContactId, receivedAt: p.createdAt, text: lines.join('\n'), createdAt: p.createdAt, updatedAt: p.createdAt };
}

export function makeShadchanDemo() {
  const rnd = mulberry32(20261112);
  const contacts = CONTACTS.map((_, i) => contact(i));
  const people = [];
  for (let i = 0; i < 30; i++) people.push(single('guy', i, rnd, contacts));
  for (let i = 0; i < 30; i++) people.push(single('girl', i, rnd, contacts));

  // Two Hebrew profiles, to check right-to-left text.
  Object.assign(people[27], { name: 'עקיבא ברק', city: 'Bnei Brak', occupation: 'אברך', languages: ['Hebrew'], about: 'שקט, רציני ובעל לב טוב.', looking: '' });
  Object.assign(people[52], { name: 'נועה מזרחי', city: 'Jerusalem', occupation: 'מורה', languages: ['Hebrew'], about: 'שמחה, חמה ואוהבת לעזור.', looking: 'בן תורה עם מידות טובות.' });

  // Every second single arrived as a pasted profile; the rest were typed in.
  const sources = people.filter((_, i) => i % 2 === 0).map(p => original(p, contacts));
  // "To file": saved as they arrived, nobody opened them yet.
  sources.push(
    { id: 'demo_s_src_file1', demo: true, personId: null, kind: 'guy', sender: 'Rabbi Yosef Feldman', senderContactId: 'demo_s_c07', receivedAt: ago(1, 3), createdAt: ago(1, 3), updatedAt: ago(1, 3),
      text: 'Name: Elchanan Gross\nAge: 25\nCity: Lakewood\nOccupation: Learns full time in yeshiva\nAbout: Steady and kind; a real masmid.\nFather: Mr. Gross (732) 555-4471' },
    { id: 'demo_s_src_file2', demo: true, personId: null, kind: 'girl', sender: 'Mrs. Rivka Cohen', senderContactId: 'demo_s_c06', receivedAt: ago(2), createdAt: ago(2), updatedAt: ago(2),
      text: 'Name: Tehila Rosen\nAge: 22\nCity: Jerusalem\nOccupation: Teacher\nLanguages: Hebrew, English\nMother: Mrs. Rosen 052-555-3310' },
    { id: 'demo_s_src_file3', demo: true, personId: null, kind: 'guy', sender: '', senderContactId: null, receivedAt: ago(4), createdAt: ago(4), updatedAt: ago(4),
      text: 'Forwarded from a group:\n27, Monsey, works in an office and learns at night. Looking for someone warm and steady.\nContact: (845) 555-9032' });

  const ev = (id, type, contactIds, personIds, at, text, noteId) => ({ id, demo: true, type, contactIds, personIds, at, text, ...(noteId ? { noteId } : {}), createdAt: at, updatedAt: at });
  const events = [
    ev('demo_s_ev01', 'call', ['demo_s_c01'], ['demo_s_g01'], ago(2, 4), 'Mrs. Stern says Yehuda is free to hear ideas now. He would like someone who also grew up in Israel.'),
    ev('demo_s_ev02', 'whatsapp', ['demo_s_c06'], ['demo_s_g01'], ago(30), 'Mrs. Cohen sent Yehuda Stern’s profile and offered to answer questions.'),
    ev('demo_s_ev03', 'call', ['demo_s_c02'], ['demo_s_r01'], ago(5, 2), 'Spoke to Mrs. Levy. Chana finishes her course in June and prefers to stay near Brooklyn.'),
    ev('demo_s_ev04', 'call', ['demo_s_c03'], ['demo_s_g03'], ago(20), 'Mr. Friedman asked to be called first about any idea for Moshe.'),
    ev('demo_s_ev05', 'email', ['demo_s_c08'], [], ago(30, 5), 'Mrs. Mandel will send three profiles from Manchester after Yom Tov.'),
  ];
  const notes = [];
  const note = (id, title, color, pinned, contactIds, personIds, entries) => {
    notes.push({ id, demo: true, title, color, pinned, contactIds, personIds, createdAt: entries[0][1], updatedAt: entries[entries.length - 1][1] });
    entries.forEach(([text, at], i) => events.push(ev(`${id}_e${i + 1}`, 'note', contactIds, personIds, at, text, id)));
  };
  note('demo_s_note01', 'Yehuda Stern — what the family wants', 'blue', true, ['demo_s_c01'], ['demo_s_g01'], [
    ['Mrs. Stern: they would like a family that also lives in Israel. Age up to his own.', ago(8, 2)],
    ['Checked again: Beit Shemesh or Jerusalem are both fine.', ago(2, 3)]]);
  note('demo_s_note02', 'Questions to ask a reference', 'yellow', true, [], [], [
    ['Ask about character, how they treat people at home, and what they are like under pressure. Write the answer down straight away.', ago(40)]]);
  note('demo_s_note03', 'Profiles Mrs. Mandel promised', 'plain', false, ['demo_s_c08'], [], [
    ['Three profiles from Manchester are coming after Yom Tov.', ago(30, 5)]]);

  const fu = (id, text, o) => ({ id, demo: true, noteId: null, contactId: null, personId: null, kind: 'task', dueAt: null, done: false, text, createdAt: ago(3), updatedAt: ago(3), ...o });
  const followUps = [
    fu('demo_s_fu01', 'Call Mr. Friedman about an idea for Moshe', { contactId: 'demo_s_c03', personId: 'demo_s_g03', dueAt: ahead(2) }),
    fu('demo_s_fu02', 'Ask Mrs. Mandel for the Manchester profiles', { contactId: 'demo_s_c08', noteId: 'demo_s_note03', dueAt: ahead(6) }),
    fu('demo_s_fu03', 'Waiting for Mrs. Levy to send Chana’s updated profile', { contactId: 'demo_s_c02', personId: 'demo_s_r01', kind: 'waiting' }),
    fu('demo_s_fu04', 'File the three profiles that arrived this week', { dueAt: ahead(1) }),
  ];
  return { contacts, people, sources, events, notes, followUps, ...shidduchim(people) };
}

// ---- Stage S3: fictional shidduchim in every lane (shapes: pages/sh-shidduch-data.js) ----
// One record per couple (offers), one per try, dated history lines, and dates with both sides' answers.
function shidduchim(people) {
  const P = (kind, n) => people.find(p => p.id === `demo_s_${kind}${pad2(n)}`);
  const first = (p) => p.name.trim().split(/\s+/)[0];
  const talk = (p) => { const c = p.contactCards.find(x => x.id === p.talkTo); return c ? c.name : ''; };
  const side = (answer = '', asked = null, answered = null, toldBy = '', feedback) =>
    ({ answer, askedAt: asked == null ? null : ago(asked), answeredAt: answered == null ? null : ago(answered), toldBy, ...(feedback == null ? {} : { feedback }) });
  const at = (days, hour = 19, min = 30) => { const d = new Date(Date.now() - days * day); d.setHours(hour, min, 0, 0); return d.toISOString(); };
  const offers = [], tries = [], stageEvents = [], dateEvents = [];
  let k = 0;
  // tries: [{ phase, guy, girl, refs, started, end: { by, saidNo, reason, days, told }, engaged, lines: [[text, daysAgo, source]], dates: [[daysAgo, where, status, guySide, girlSide]] }]
  const couple = (g, r, status, list) => {
    const guy = P('g', g), girl = P('r', r), id = `demo_s_off${pad2(++k)}`;
    const startedAt = ago(list[0].started), lastAt = ago(Math.min(...list.flatMap(t => t.lines.map(l => l[1]))));
    offers.push({ id, demo: true, guyId: guy.id, girlId: girl.id, guyName: guy.name, girlName: girl.name, status, createdAt: startedAt, updatedAt: lastAt });
    list.forEach((t, i) => {
      const tid = `${id}_t${i + 1}`, e = t.end || null;
      tries.push({ id: tid, demo: true, offerId: id, guyId: guy.id, girlId: girl.id, n: i + 1, phase: t.phase, sides: { guy: t.guy || side(), girl: t.girl || side() },
        refsChecked: !!t.refs, endedBy: e ? e.by : null, saidNo: !!(e && e.saidNo), endedReason: e ? e.reason || '' : '', endedAt: e ? ago(e.days) : null,
        told: { guy: !!(e && e.told === 'guy'), girl: !!(e && e.told === 'girl') }, engagedAt: t.engaged == null ? null : ago(t.engaged), startedAt: ago(t.started), createdAt: ago(t.started), updatedAt: lastAt });
      t.lines.forEach(([text, days, source], j) => { const when = ago(days, -j / 60); stageEvents.push({ id: `${tid}_e${j + 1}`, demo: true, tryId: tid, offerId: id, text, source: source || '', eventAt: null, kind: 'note', at: when, createdAt: when, updatedAt: when }); });
      (t.dates || []).forEach(([days, where, st, gs, rs], j) => dateEvents.push({ id: `${tid}_d${j + 1}`, demo: true, tryId: tid, offerId: id, n: j + 1, when: at(days), where, status: st,
        sides: { guy: gs || side('', null, null, '', ''), girl: rs || side('', null, null, '', '') }, at: ago(days + 2), createdAt: ago(days + 2), updatedAt: ago(Math.max(0, days)) }));
    });
    return { guy, girl };
  };
  const his = (p, a) => `His side (${first(p)}): ${a}.`, her = (p, a) => `Her side (${first(p)}): ${a}.`;
  const idea = 'Saved as an idea.', bothYes = 'Both sides said Yes. Next: Date 1.', dating = 'First date set up. Moved to In Progress.';
  let a, b;

  // Offers — his side said Yes, her side was not asked yet: "Your move".
  a = P('g', 1); b = P('r', 1);
  couple(1, 1, 'offer', [{ phase: 'open', started: 6, guy: side('yes', 4, 1, talk(a)), lines: [[idea, 6], [his(a, 'Asked'), 4], [his(a, 'Yes'), 1, talk(a)]] }]);
  // Offers — waiting nine days for her side.
  a = P('g', 21); b = P('r', 2);
  couple(21, 2, 'offer', [{ phase: 'open', started: 14, guy: side('yes', 13, 12, talk(a)), girl: side('asked', 9), lines: [[idea, 14], [his(a, 'Asked'), 13], [his(a, 'Yes'), 12, talk(a)], [her(b, 'Asked'), 9]] }]);
  // Ended — her side said No; his side has not been told yet: "Your move".
  a = P('g', 3); b = P('r', 8);
  couple(3, 8, 'ended', [{ phase: 'ended', started: 12, guy: side('yes', 11, 9, talk(a)), girl: side('no', 8, 3, talk(b)), end: { by: 'girl', saidNo: true, days: 3, reason: 'They are looking for someone who lives closer.' },
    lines: [[idea, 12], [his(a, 'Asked'), 11], [his(a, 'Yes'), 9, talk(a)], [her(b, 'Asked'), 8], [`Her side (${first(b)}) said No. The shidduch ended. Reason: They are looking for someone who lives closer.`, 3, talk(b)]] }]);
  // Offers — his side is thinking.
  a = P('g', 14); b = P('r', 5);
  couple(14, 5, 'offer', [{ phase: 'open', started: 5, guy: side('thinking', 3, 2, talk(a)), lines: [[idea, 5], [his(a, 'Asked'), 3], [his(a, 'Thinking'), 2, talk(a)]] }]);
  // In Progress — Date 2 was two days ago; her side answered, his side was not asked: "Your move".
  a = P('g', 2); b = P('r', 3);
  couple(2, 3, 'progress', [{ phase: 'dating', refs: true, started: 30, guy: side('yes', 28, 26, talk(a)), girl: side('yes', 25, 22, talk(b)),
    lines: [[idea, 30], [his(a, 'Asked'), 28], [his(a, 'Yes'), 26, talk(a)], [her(b, 'Asked'), 25], [her(b, 'Yes'), 22, talk(b)], [bothYes, 22], ['References checked.', 18], ['Date 1 arranged.', 14], [dating, 14], ['Date 1 happened.', 9],
      [`After Date 1 · his side (${first(a)}): Yes.`, 8, talk(a)], [`After Date 1 · her side (${first(b)}): Yes.`, 8, talk(b)], ['Both sides want to continue after Date 1.', 8], ['Date 2 arranged.', 6], ['Date 2 happened.', 2], [`After Date 2 · her side (${first(b)}): Yes.`, 0.2, talk(b)]],
    dates: [[9, 'Hotel lobby', 'Happened', side('yes', 9, 8, talk(a), 'Enjoyed it. Easy conversation.'), side('yes', 9, 8, talk(b), 'She liked how he listens.')],
      [2, 'A walk in the park', 'Happened', side('', null, null, '', ''), side('yes', 1, 0.2, talk(b), 'Wants to continue.')]] }]);
  // In Progress — Date 1 is in two days.
  a = P('g', 5); b = P('r', 6);
  couple(5, 6, 'progress', [{ phase: 'dating', refs: true, started: 16, guy: side('yes', 14, 12, talk(a)), girl: side('yes', 11, 6, talk(b)),
    lines: [[idea, 16], [his(a, 'Asked'), 14], [his(a, 'Yes'), 12, talk(a)], [her(b, 'Asked'), 11], [her(b, 'Yes'), 6, talk(b)], [bothYes, 6], ['References checked.', 4], ['Date 1 arranged.', 1], [dating, 1]],
    dates: [[-2, 'Hotel lobby', 'Arranged']] }]);
  // Ideas — nobody was asked yet.
  couple(6, 9, 'idea', [{ phase: 'open', started: 2, lines: [[idea, 2]] }]);
  couple(1, 10, 'idea', [{ phase: 'open', started: 7, lines: [[idea, 7], ['Wait for an answer about Chana first.', 6]] }]);
  couple(10, 13, 'idea', [{ phase: 'open', started: 20, lines: [[idea, 20]] }]);
  // Ended eight months ago after two dates; both sides know.
  a = P('g', 8); b = P('r', 11);
  couple(8, 11, 'ended', [{ phase: 'ended', refs: true, started: 270, guy: side('yes', 268, 266), girl: side('yes', 265, 262), end: { by: 'girl', saidNo: true, days: 240, reason: 'Did not feel it was for her.', told: 'guy' },
    lines: [[idea, 270], [his(a, 'Yes'), 266], [her(b, 'Yes'), 262], [bothYes, 262], [dating, 258], ['Date 1 happened.', 252], ['Date 2 happened.', 244], [`Her side (${first(b)}) said No. The shidduch ended. Reason: Did not feel it was for her.`, 240]],
    dates: [[252, 'Hotel lobby', 'Happened', side('yes', 252, 251, '', ''), side('yes', 252, 251, '', '')], [244, 'Restaurant', 'Happened', side('yes', 244, 243, '', ''), side('no', 244, 240, '', 'Nice, but not for her.')]] }]);
  // Engaged three weeks ago.
  a = P('g', 12); b = P('r', 12);
  couple(12, 12, 'engaged', [{ phase: 'engaged', refs: true, started: 110, engaged: 21, guy: side('yes', 108, 105), girl: side('yes', 104, 100),
    lines: [[idea, 110], [his(a, 'Yes'), 105], [her(b, 'Yes'), 100], [bothYes, 100], [dating, 95], ['Date 5 happened.', 30], ['Engaged. Mazal tov!', 21]],
    dates: [90, 80, 66, 48, 30].map(d => [d, 'Hotel lobby', 'Happened', side('yes', d, d - 1, '', ''), side('yes', d, d - 1, '', '')]) }]);
  // A second try: the first ended five months ago, his side was asked again yesterday.
  a = P('g', 9); b = P('r', 14);
  couple(9, 14, 'offer', [
    { phase: 'ended', started: 160, guy: side('no', 158, 150), girl: side('asked', 157), end: { by: 'guy', saidNo: true, days: 150, reason: 'He wanted to finish the year in yeshiva first.', told: 'girl' },
      lines: [[idea, 160], [his(a, 'Asked'), 158], [her(b, 'Asked'), 157], [`His side (${first(a)}) said No. The shidduch ended. Reason: He wanted to finish the year in yeshiva first.`, 150]] },
    { phase: 'open', started: 3, guy: side('asked', 1), lines: [['The 2nd Try started.', 3], [his(a, 'Asked'), 1]] }]);
  return { offers, tries, stageEvents, dateEvents };
}
