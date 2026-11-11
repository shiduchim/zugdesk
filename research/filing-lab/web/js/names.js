// Name handling shared by the filing step and the scorer: normalizing, comparing, and matching a
// written name ("Mrs Kohen", "Rivky", "Leah's reference", "Михаилу") against saved contacts.
// Plain rules, no AI.

export const HONORIFICS = new Map([
  ['mrs', 'f'], ['ms', 'f'], ['miss', 'f'], ['rebbetzin', 'f'], ['mr', 'm'], ['rabbi', 'm'], ['reb', 'm'],
  ['r', 'm'], ['rav', 'm'], ['harav', 'm'], ['dr', ''], ['גברת', 'f'], ['הגברת', 'f'], ['מרת', 'f'],
  ['הרב', 'm'], ['מר', 'm'], ['госпожа', 'f'], ['господин', 'm'], ['раввин', 'm'], ['ребецн', 'f']
]);
const STOP = new Set(['the', 'a', 'an', 'my', 'of', 'this', 'that', 'his', 'her', 'their', 'our']);
export const RELATIONS = new Set(['mother', 'father', 'parents', 'parent', 'mom', 'dad', 'sister', 'brother',
  'aunt', 'uncle', 'wife', 'husband', 'family', 'side', 'grandmother', 'grandfather', 'cousin', 'son',
  'daughter', 'friend', 'rebbetzin', 'rav', 'rebbe', 'teacher', 'neighbor', 'boss', 'sisterinlaw',
  'reference', 'references', 'shadchan', 'contact']);
const GROUP = new Set(['families', 'family', 'girls', 'girl', 'boys', 'boy', 'guys', 'guy', 'people', 'nobody',
  'noone', 'anyone', 'anybody', 'someone', 'somebody', 'everyone', 'everybody', 'both', 'neither', 'none',
  'friends', 'shadchanim', 'shadchan', 'singles', 'single', 'names', 'ideas', 'idea', 'options', 'women', 'men',
  'lady', 'man', 'woman', 'different', 'new', 'other', 'others', 'few', 'several', 'some', 'many', 'all',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'more', 'couple', 'group']);
export const PRONOUNS = new Set(['he', 'she', 'him', 'her', 'they', 'them', 'we', 'us', 'his', 'hers', 'it',
  'הוא', 'היא', 'הם', 'הן', 'он', 'она', 'они']);
export const ME_WORDS = new Set(['me', 'i', 'myself', 'user', 'the user', 'self', 'אני', 'אותי', 'לי', 'я', 'мне', 'меня']);

const HEB_PREFIX = 'לשובמהכ';
const isHeb = s => /[֐-׿]/.test(s);
const isCyr = s => /[Ѐ-ӿ]/.test(s);

export function cleanToken(t) {
  return t.toLowerCase().normalize('NFKC')
    .replace(/[’`´]/g, "'").replace(/'s$/, '').replace(/s'$/, 's').replace(/^['"(]+|['".,!?:;)]+$/g, '')
    .replace(/[.]/g, '');
}

/** Words of a name, lower case, without punctuation, possessive 's or honorifics. */
export function nameTokens(name, { keepHonorific = false } = {}) {
  if (!name) return [];
  const raw = String(name).replace(/[’`´]/g, "'").replace(/'s\b/g, " 's").split(/[\s,/]+/);
  const out = [];
  for (const r of raw) {
    if (r === "'s") continue;
    const t = cleanToken(r);
    if (!t) continue;
    if (!keepHonorific && HONORIFICS.has(t)) continue;
    if (STOP.has(t)) continue;
    out.push(t);
  }
  return out;
}

export function honorificOf(name) {
  for (const r of String(name || '').split(/\s+/)) {
    const t = cleanToken(r);
    if (HONORIFICS.has(t)) return { word: t, gender: HONORIFICS.get(t) };
  }
  return null;
}

/** Spelling variants of one word: Hebrew one-letter prefixes, Russian case endings. */
export function variants(t) {
  const v = new Set([t]);
  if (isHeb(t)) {
    if (t.length > 3 && HEB_PREFIX.includes(t[0])) v.add(t.slice(1));
    if (t.length > 4 && HEB_PREFIX.includes(t[0]) && HEB_PREFIX.includes(t[1])) v.add(t.slice(2));
  } else if (isCyr(t)) {
    if (t.length > 4) v.add(t.slice(0, -1));
    if (t.length > 5) v.add(t.slice(0, -2));
    if (/[ея]$/.test(t)) v.add(t.slice(0, -1) + 'я');
  } else if (t.length > 4 && t.endsWith('s')) {
    v.add(t.slice(0, -1)); // references → reference
  }
  return v;
}

function damerau(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** How alike two words are as names: 1 = same (or a known variant), 0.5 = one typo apart, 0 = different. */
export function tokenSim(a, b, { fuzzy = true } = {}) {
  if (a === b) return 1;
  const va = variants(a), vb = variants(b);
  for (const x of va) if (vb.has(x) && x.length >= 2) return 1;
  if (fuzzy && a.length >= 5 && b.length >= 5 && !isHeb(a) && !isHeb(b)) {
    if (damerau(a, b) <= 1) return 0.5;
    if (a[0] !== b[0] && damerau(a.slice(1), b.slice(1)) === 0) return 0.5; // Kohen / Cohen
  }
  return 0;
}
export function tokenEq(a, b, opts) { return tokenSim(a, b, opts) > 0; }

/** Same written person? Token sets must correspond one-to-one ("Rivka's mother" = "mother of Rivka"). */
export function nameEq(a, b) {
  if (a == null || b == null) return a == b;
  const A = String(a).trim().toLowerCase(), B = String(b).trim().toLowerCase();
  if (ME_WORDS.has(A) || ME_WORDS.has(B)) return ME_WORDS.has(A) && ME_WORDS.has(B);
  const ta = nameTokens(a), tb = nameTokens(b);
  if (!ta.length || !tb.length) return A === B;
  if (ta.length !== tb.length) return false;
  const used = new Set();
  for (const x of ta) {
    let hit = -1;
    tb.forEach((y, i) => { if (hit < 0 && !used.has(i) && tokenEq(x, y)) hit = i; });
    if (hit < 0) return false;
    used.add(hit);
  }
  return true;
}

/** Does the text actually contain this name (allowing small spelling changes)? */
export function nameInText(name, text) {
  const nt = nameTokens(name);
  if (!nt.length) return ME_WORDS.has(String(name).toLowerCase().trim());
  const tt = nameTokens(text, { keepHonorific: true });
  return nt.every(x => RELATIONS.has(x) || tt.some(y => tokenEq(x, y)));
}

export function isMe(name) { return name != null && ME_WORDS.has(String(name).trim().toLowerCase()); }

export function isGroup(name) {
  const t = nameTokens(name).filter(x => !/^\d+$/.test(x));
  return t.length > 0 && t.every(x => GROUP.has(x));
}
export function isPronoun(name) {
  const t = String(name || '').trim().toLowerCase();
  return PRONOUNS.has(t);
}

/** "Rivka's mother" / "mother of Rivka" / "her father" → { base, relation }. */
export function splitRelation(name, of = null) {
  const s = String(name || '').replace(/[’`´]/g, "'").trim();
  let m = s.match(/^(.+?)'s?\s+(.+)$/i);
  if (m && nameTokens(m[2]).some(t => RELATIONS.has(t) || RELATIONS.has(t.replace(/s$/, ''))))
    return { base: m[1].trim(), relation: m[2].trim().toLowerCase() };
  m = s.match(/^(?:the\s+)?(\w+)\s+of\s+(.+)$/i);
  if (m && RELATIONS.has(m[1].toLowerCase())) return { base: m[2].trim(), relation: m[1].toLowerCase() };
  m = s.match(/^(her|his|their)\s+(.+)$/i);
  if (m && nameTokens(m[2]).some(t => RELATIONS.has(t))) return { base: m[1].toLowerCase(), relation: m[2].toLowerCase(), pronounBase: true };
  if (of) {
    const toks = nameTokens(s);
    if (toks.length && toks.every(t => RELATIONS.has(t) || RELATIONS.has(t.replace(/s$/, ''))))
      return { base: of, relation: toks.join(' ') };
    if (toks.length) {
      const rel = toks.filter(t => RELATIONS.has(t));
      if (rel.length) return { base: of, relation: rel.join(' ') };
    }
  }
  const toks = nameTokens(s);
  if (toks.length === 1 && (toks[0] === 'reference' || toks[0] === 'references')) return { base: null, relation: 'reference' };
  return null;
}

/** Candidate contacts for a written name. Returns [{ id, how, score }] — the best tier only. */
export function matchContacts(name, people) {
  const hon = honorificOf(name);
  const toks = nameTokens(name);
  if (!toks.length) return [];
  const hits = [];
  for (const p of people) {
    if (hon && hon.gender && p.gender && hon.gender !== p.gender) continue;
    const full = nameTokens(p.name);
    const first = full[0], last = full[full.length - 1];
    const aliases = (p.altNames || []).map(a => nameTokens(a)).filter(a => a.length);
    let score = 0, how = '';
    const sim = (x, y) => tokenSim(x, y);
    if (toks.length >= 2) {
      const sFull = toks.length === full.length ? Math.min(...toks.map((t, i) => sim(t, full[i]))) : 0;
      const sAlias = Math.max(0, ...aliases.filter(a => a.length === toks.length).map(a => Math.min(...a.map((t, i) => sim(toks[i], t)))));
      if (sFull > 0) { score = 3 + sFull / 2; how = sFull === 1 ? 'full name' : 'full name (spelling differs)'; }
      else if (sAlias > 0) { score = 3 + sAlias / 2; how = 'saved name'; }
    } else {
      const t = toks[0];
      const sLast = sim(t, last), sFirst = sim(t, first);
      const sAlias = Math.max(0, ...aliases.filter(a => a.length === 1).map(a => sim(t, a[0])));
      const spell = q => (q === 1 ? '' : ' (spelling differs)');
      if (hon && sLast > 0) { score = 2 + sLast / 2; how = `${hon.word === 'mrs' ? 'Mrs.' : hon.word} + surname${spell(sLast)}`; }
      else if (sFirst > 0 || sAlias > 0) {
        const q = Math.max(sFirst, sAlias);
        score = 2 + q / 2; how = (sFirst >= sAlias ? 'first name' : 'saved nickname') + spell(q);
      } else if (sLast > 0) { score = 1 + sLast / 2; how = 'surname only' + spell(sLast); }
    }
    if (score) hits.push({ id: p.id, how, score });
  }
  const best = Math.max(0, ...hits.map(h => h.score));
  return hits.filter(h => h.score === best);
}

export function titleCase(s) {
  return String(s || '').replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
}
