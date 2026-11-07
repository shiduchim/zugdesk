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
