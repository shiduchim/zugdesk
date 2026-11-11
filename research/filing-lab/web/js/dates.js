// Turns a time phrase ("in two days", "by Thursday", "motzei Shabbos") into a calendar date.
// Plain rules, no AI. It never invents: a vague phrase ("soon", "sometime") gives no date, and a
// phrase that names a range ("next week") gives a date marked approx so the app asks first.
// Week starts on Sunday. Dates are ISO strings (YYYY-MM-DD) in local time.

const DAY_MS = 86400000;
const WEEKDAYS = [
  ['sunday', 'יום ראשון', 'воскресенье', 'воскресенья'],
  ['monday', 'יום שני', 'понедельник', 'понедельника'],
  ['tuesday', 'tue', 'tues', 'יום שלישי', 'вторник', 'вторника'],
  ['wednesday', 'weds', 'יום רביעי', 'среду', 'среда', 'среды'],
  ['thursday', 'thu', 'thur', 'thurs', 'יום חמישי', 'четверг', 'четверга'],
  ['friday', 'fri', 'erev shabbos', 'erev shabbat', 'יום שישי', 'ערב שבת', 'пятницу', 'пятница', 'пятницы'],
  ['saturday', 'shabbos', 'shabbat', 'shabbes', 'שבת', 'субботу', 'суббота', 'субботы']
];
const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, couple: 2, 'a couple of': 2, 'a couple': 2, few: 3, 'a few': 3,
  'два': 2, 'две': 2, 'три': 3, 'четыре': 4, 'пять': 5 };
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
  'october', 'november', 'december'];
const MON3 = MONTHS.map(m => m.slice(0, 3));

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
export function toISO(dt) {
  const p = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}
export function addDays(iso, n) { return toISO(new Date(parseISO(iso).getTime() + n * DAY_MS)); }
export function weekday(iso) { return parseISO(iso).getDay(); }
export function niceDate(iso) {
  return parseISO(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function num(s) {
  if (s == null) return null;
  const t = s.trim().toLowerCase();
  if (/^\d+$/.test(t)) return Number(t);
  return NUM[t] ?? null;
}

function findWeekday(t) {
  for (let i = 0; i < 7; i++) {
    for (const w of WEEKDAYS[i]) {
      const re = /[a-z]/.test(w) ? new RegExp(`\\b${w}\\b`) : new RegExp(w);
      if (re.test(t)) return i;
    }
  }
  return -1;
}

// Next occurrence of weekday `dow` after today (today itself counts as "in a week", approx).
function nextDow(today, dow) {
  let d = (dow - weekday(today) + 7) % 7;
  return { d: d === 0 ? 7 : d, sameDay: d === 0 };
}

/** resolveWhen(phrase, today) → { date: ISO|null, approx: bool, past: bool, vague: bool } */
export function resolveWhen(phrase, today) {
  const out = (date, extra = {}) => ({ date, approx: false, past: false, vague: false, ...extra });
  if (phrase == null) return out(null);
  let t = String(phrase).toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
  if (!t) return out(null);

  const iso = t.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/);
  if (iso) return out(iso[0], { iso: true });

  if (/\b(soon|later|sometime|some time|anytime|any time|at some point|when possible|eventually)\b/.test(t)
      && !/\blater (today|tonight)\b/.test(t)) return out(null, { vague: true });
  if (/\blast (year|month)\b|\bago\b/.test(t)) return out(null, { past: true, vague: true });
  if (/\b(yesterday|last night)\b|אתמול|вчера/.test(t)) return out(addDays(today, -1), { past: true });

  if (/\b(day after tomorrow)\b|מחרתיים|послезавтра/.test(t)) return out(addDays(today, 2));
  if (/\b(tomorrow|tmrw|tomorow|tommorow|tomorrrow)\b|מחר|завтра/.test(t)) return out(addDays(today, 1));
  if (/\b(today|tonight|this evening|this afternoon|this morning|later today|later tonight|by tonight|by the end of the day)\b|היום|הערב|сегодня|вечером/.test(t))
    return out(today);

  // in N days / weeks
  let m = t.match(/\b(?:in|within|after)?\s*(a couple of|a couple|a few|couple|few|an?|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+days?\b/);
  if (m) { const n = num(m[1]); if (n != null) return out(addDays(today, n), { approx: /few|couple/.test(m[1]) }); }
  m = t.match(/\b(?:in|within)?\s*(a couple of|a few|an?|\d+|one|two|three|four)\s+weeks?\b/);
  if (m && !/\b(next|this) week\b/.test(t)) { const n = num(m[1]); if (n != null) return out(addDays(today, 7 * n), { approx: /few|couple/.test(m[1]) }); }
  if (/בעוד יומיים|יומיים/.test(t)) return out(addDays(today, 2));
  if (/בעוד שבוע/.test(t)) return out(addDays(today, 7));
  m = t.match(/через\s+(\d+|два|две|три|четыре|пять)?\s*(дн|недел)/);
  if (m) { const n = num(m[1] || 'one') ?? 1; return out(addDays(today, m[2].startsWith('дн') ? n : 7 * n)); }

  // after / motzei Shabbos → Saturday night
  if (/\b(motzei|motzai|motzaei|motzoei) (shabbos|shabbat|shabbes)\b|\bafter (shabbos|shabbat|shabbes)\b|\bsaturday night\b|מוצאי שבת|מוצ"ש|אחרי שבת/.test(t)) {
    const { d } = nextDow(today, 6);
    return out(addDays(today, weekday(today) === 6 ? 0 : d), { approx: /after/.test(t) });
  }
  // before Shabbos → Friday
  if (/\bbefore (shabbos|shabbat|shabbes)\b|לפני שבת|до субботы/.test(t)) {
    const wd = weekday(today);
    return out(addDays(today, wd === 5 ? 0 : wd === 6 ? 6 : 5 - wd));
  }

  if (/\bnext week\b|שבוע הבא|בשבוע הבא|на следующей неделе|следующей неделе/.test(t)) {
    const d = 7 - weekday(today);
    return out(addDays(today, d), { approx: true });
  }
  if (/\b(this week|end of the week|later this week|by the end of the week)\b|השבוע|на этой неделе/.test(t)) {
    const wd = weekday(today);
    return out(addDays(today, wd <= 5 ? 5 - wd : 6), { approx: true });
  }
  if (/\bnext month\b|חודש הבא|в следующем месяце/.test(t)) {
    const dt = parseISO(today); return out(toISO(new Date(dt.getFullYear(), dt.getMonth() + 1, 1, 12)), { approx: true });
  }

  // Month name + day, or "the 20th"
  m = t.match(new RegExp(`\\b(${MONTHS.join('|')}|${MON3.join('|')})\\.?\\s+(\\d{1,2})(st|nd|rd|th)?\\b`));
  if (m) {
    const mi = (MONTHS.indexOf(m[1]) >= 0 ? MONTHS.indexOf(m[1]) : MON3.indexOf(m[1]));
    const dt = parseISO(today); let y = dt.getFullYear();
    let cand = new Date(y, mi, Number(m[2]), 12);
    if (toISO(cand) < today) cand = new Date(y + 1, mi, Number(m[2]), 12);
    return out(toISO(cand));
  }
  m = t.match(/\b(?:on |by )?the (\d{1,2})(st|nd|rd|th)\b|\b(\d{1,2})(st|nd|rd|th)\b/);
  if (m) {
    const day = Number(m[1] || m[3]); const dt = parseISO(today);
    let cand = new Date(dt.getFullYear(), dt.getMonth(), day, 12);
    if (toISO(cand) < today) cand = new Date(dt.getFullYear(), dt.getMonth() + 1, day, 12);
    return out(toISO(cand));
  }

  // Weekdays
  const dow = findWeekday(t);
  if (dow >= 0) {
    const wd = weekday(today);
    if (/\bnext\b|הבא|следующ/.test(t)) {
      const startNext = 7 - wd; // days until next Sunday
      const date = addDays(today, startNext + dow);
      // "next Tuesday" said on a Monday could mean tomorrow or a week later — flag it.
      return out(date, { approx: dow > wd });
    }
    if (/\blast\b/.test(t)) return out(addDays(today, -(((wd - dow + 7) % 7) || 7)), { past: true });
    const { d, sameDay } = nextDow(today, dow);
    return out(addDays(today, d), { approx: sameDay });
  }
  return out(null, { vague: true });
}

// Phrases the rules can find inside free text (used by the no-AI engine).
const FIND_RES = [
  /\b(?:in|within)\s+(?:a couple of|a couple|a few|couple|few|an?|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:days?|weeks?)\b/i,
  /\b(?:day after tomorrow|tomorrow(?: night| morning| evening)?|tmrw|tonight|today|this (?:evening|afternoon|morning|week)|later today|by tonight|yesterday|last night|last year)\b/i,
  /\b(?:motzei|motzai|motzaei)\s+(?:shabbos|shabbat)\b|\b(?:after|before)\s+(?:shabbos|shabbat|shabbes)\b/i,
  /\b(?:next|this)\s+week\b|\bend of the week\b|\bnext month\b/i,
  /\b(?:on |by |this |next |last )?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?: night| morning| evening)?\b/i,
  /\b(?:on |by )?the \d{1,2}(?:st|nd|rd|th)\b/i,
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\b/i,
  /\b(?:soon|anytime|sometime)\b/i,
  /מחרתיים|מחר|היום|הערב|אתמול|בעוד יומיים|בעוד שבוע|בשבוע הבא|מוצאי שבת|לפני שבת|ביום (?:ראשון|שני|שלישי|רביעי|חמישי|שישי)/,
  /послезавтра|завтра|сегодня|вчера|через\s+\S+\s+\S+|на следующей неделе|в (?:понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)/i
];

/** findWhen(text) → [{ phrase, index }] in order of appearance (no overlaps). */
export function findWhen(text) {
  const hits = [];
  for (const re of FIND_RES) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = g.exec(text))) {
      if (!hits.some(h => m.index < h.index + h.phrase.length && h.index < m.index + m[0].length))
        hits.push({ phrase: m[0], index: m.index });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}
