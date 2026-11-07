// Person card — Profile · Offers · Notes (spec/offers-cards.md). Same reading layout as
// My Profile (source/Shadchanim Offers.html). Reads the one shared person record; editing
// opens the Add Person form. Interest never creates, ends or reopens a formal offer.
import * as store from '../js/store.js';
import { h, icon, toast, sheet, bubbles, confirmDialog } from '../js/ui.js';
import { navigate } from '../js/router.js';
import { loadPerson, pron, kindLabel, dateOnly, LISTS } from './people-data.js';
import { startOffer, laneOf, laneLabel, stageWord, tryName, endedByName } from './shidduch-data.js';

const ico = (n) => h('span', { html: icon(n) }).firstChild;
const NR = () => h('span', { class: 'muted' }, 'Not recorded');
const TABS = [['profile', 'Profile'], ['offers', 'Offers'], ['notes', 'Notes']];
export const MY_INTEREST = ['Interested', 'Want to learn more', 'Not sure yet', 'Not interested'];
export const THEIR_RESPONSE = ['Yes, interested', 'Checking availability', 'Thinking about it', 'Not available now', 'No', 'Not asked yet'];
const TYPE_OPTS = store.EVENT_TYPES.map(([v, l]) => [v || '_unknown', l]);
const today = () => new Date().toISOString().slice(0, 10);
const atFrom = (d, prev) => (!d ? store.now() : prev && prev.slice(0, 10) === d ? prev : d === today() ? store.now() : new Date(d + 'T12:00:00').toISOString());

let root = null, gen = 0, unsub = null, timer = 0, B = null, tab = 'profile';
const drafts = {}; // personId → unsent note text
export function destroy() { root = null; gen++; unsub && unsub(); unsub = null; clearTimeout(timer); }

export async function render(container, params) {
  root = container;
  root.classList.add('person-card-page');
  tab = TABS.some(t => t[0] === params.tab) ? params.tab : 'profile';
  unsub && unsub();
  unsub = store.subscribe((ch) => { if (ch.store !== 'prefs' && ch.store !== 'meta') { clearTimeout(timer); timer = setTimeout(() => draw(params.id, true), 80); } });
  await draw(params.id);
}

async function draw(id, keepScroll = false) {
  const token = ++gen;
  const b = await loadPerson(id);
  if (token !== gen || !root) return;
  const y = window.scrollY;
  root.innerHTML = '';
  if (!b) { root.append(h('p', { class: 'empty' }, 'This person is no longer saved.'), h('a', { class: 'btn', href: '#/people' }, 'Back to People & Ideas')); return; }
  B = b;
  const p = b.p;
  const enc = encodeURIComponent(p.id);
  root.append(
    h('div', { class: 'pc-namebar', 'data-id': 'person-card.namebar' },
      h('a', { class: 'icon-btn', href: '#/people', 'aria-label': 'Back to People & Ideas', 'data-id': 'person-card.back', html: icon('back') }),
      h('h1', { dir: 'auto' }, store.personName(p)),
      p.kind ? h('span', { class: 'pc-kind' }, kindLabel(p.kind)) : null,
      h('span', { class: 'spacer' }),
      h('a', { class: 'icon-btn bordered', href: `#/people/${enc}/edit`, 'aria-label': 'Edit person', title: 'Edit person', 'data-id': 'person-card.edit', html: icon('edit') })),
    h('div', { class: 'pc-actions', 'data-id': 'person-card.actions' },
      h('button', { type: 'button', class: 'btn small', 'data-id': 'person-card.add-note', onClick: () => { setTab('notes'); setTimeout(() => root?.querySelector('[data-id="person-card.note-text"]')?.focus(), 120); } }, ico('message'), 'Add note'),
      h('button', { type: 'button', class: 'btn small', 'data-id': 'person-card.follow-up', onClick: () => followUpSheet() }, ico('clock'), 'Follow-up')),
    h('div', { class: 'pc-tabs', role: 'tablist', 'data-id': 'person-card.tabs' },
      TABS.map(([k, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': tab === k ? 'true' : 'false', 'data-id': 'person-card.tab-' + k, onClick: () => setTab(k) }, l))),
    h('div', { class: 'pc-body', 'data-id': 'person-card.' + tab }, tab === 'profile' ? profileTab(b) : tab === 'offers' ? offersTab(b) : notesTab(b)));
  if (keepScroll) window.scrollTo(0, y);
}

function setTab(k) {
  const path = `/people/${encodeURIComponent(B.p.id)}${k === 'profile' ? '' : '/' + k}`;
  navigate(path, { replace: true });
}

function sec(title, dataId, editHref, ...kids) {
  return h('section', { class: 'pc-sec', 'data-id': dataId },
    h('div', { class: 'pc-sec-head' }, h('h2', { class: 'eyebrow', dir: 'auto' }, title),
      editHref ? h('a', { class: 'icon-btn', href: editHref, 'aria-label': 'Edit ' + title.toLowerCase(), 'data-id': dataId + '-edit', html: icon('edit') }) : null),
    ...kids);
}
const fact = (k, v, dataId) => h('div', { class: 'fact', 'data-id': dataId }, h('dt', {}, k), h('dd', { dir: 'auto' }, v == null || v === '' || (Array.isArray(v) && !v.length) ? NR() : Array.isArray(v) ? v.join(', ') : v));
const firstName = (p) => (p.name || '').trim().split(/\s+/)[0] || pron(p).him;

// ---------- Profile ----------
function profileTab(b) {
  const { p, srcs, atts } = b;
  const P = pron(p), enc = encodeURIComponent(p.id), A = p.answers || {};
  const edit = (s) => `#/people/${enc}/edit/${s}`;
  const summary = [p.age, p.city, p.occupation].filter(Boolean).join(' · ');
  const first = srcs[0];
  const custom = Object.entries(A).filter(([k, v]) => !LISTS[k] && (Array.isArray(v) ? v.length : v));
  const religiousOther = p.religiousOther?.trim();
  const cards = p.contactCards || [];
  return [
    h('div', { class: 'pc-summary', 'data-id': 'person-card.summary' },
      h('div', { class: 'avatar lg' }, store.initials(p)),
      h('div', { class: 'pc-summary-text' },
        h('div', { class: 'pc-summary-line', dir: 'auto' }, summary || 'Age, city and occupation not recorded'),
        p.about ? h('div', { class: 'note clamp', dir: 'auto' }, p.about) : null),
      h('a', { class: 'icon-btn', href: `#/people/${enc}/edit`, 'aria-label': 'Edit basic info', 'data-id': 'person-card.summary-edit', html: icon('edit') })),
    sec('Facts', 'person-card.facts', edit('personal'),
      h('dl', { class: 'facts' },
        fact('Age', p.age, 'person-card.fact-age'),
        fact('City', p.city, 'person-card.fact-city'),
        fact('Occupation', p.occupation, 'person-card.fact-occupation'),
        fact('Languages', p.languages, 'person-card.fact-languages'),
        fact('Status', A.pStatus, 'person-card.fact-status'),
        fact('Religious level', A.pLevel, 'person-card.fact-level'),
        fact('Tzniut', A.pTzniut, 'person-card.fact-tzniut'),
        fact('Religious background', A.pBackground, 'person-card.fact-background'),
        (A.pReligious || []).length ? fact('Religious', A.pReligious, 'person-card.fact-religious') : null,
        religiousOther ? fact('Other religious details', religiousOther, 'person-card.fact-religious-other') : null,
        fact('Character & lifestyle', A.pTraits, 'person-card.fact-traits'),
        fact('Body type', A.pBody, 'person-card.fact-body'),
        p.maxAge ? fact('Looking up to age', p.maxAge, 'person-card.fact-max-age') : null,
        ...custom.map(([k, v]) => fact((p.answerLabels || {})[k] || k, v, 'person-card.fact-custom')),
        fact('Profile source', first ? [first.sender || 'Sender not recorded', dateOnly(first.receivedAt || first.createdAt)].join(' · ') : (p.sender || ''), 'person-card.fact-source')),
      h('a', { class: 'pc-add', href: edit('about'), 'data-id': 'person-card.add-fact' }, 'Add a fact…')),
    sec(`About ${firstName(p)}`, 'person-card.about', edit('about'),
      p.about ? h('p', { class: 'prewrap', dir: 'auto' }, p.about) : h('p', {}, NR())),
    sec(`What ${P.he}${p.kind ? '’s' : '’re'} looking for`, 'person-card.looking', edit('about'),
      p.looking ? h('p', { class: 'prewrap', dir: 'auto' }, p.looking) : h('p', {}, NR())),
    sec('Contacts and source', 'person-card.contacts', edit('contacts'),
      cards.length || p.sender ? h('dl', { class: 'facts' },
        ...cards.map(c => contactFact(c, b)),
        p.sender ? h('div', { class: 'fact' }, h('dt', {}, 'Sent by'), h('dd', { dir: 'auto' }, linkedName(p.sender, p.senderContactId, b)), h('span', { class: 'priv' }, 'private')) : null)
        : h('p', {}, NR()),
      h('p', { class: 'note' }, 'A number given for a mother, father, reference or shadchan is never shown as their own number.')),
    sec(`How I know ${P.him}`, 'person-card.known', edit('known'),
      (p.know || []).length || p.yearsKnown || p.howKnow ? h('dl', { class: 'facts' },
        fact('Contact', p.know, 'person-card.fact-know'),
        p.yearsKnown ? fact('Years known', p.yearsKnown) : null,
        p.howKnow ? fact('How', p.howKnow) : null) : h('p', {}, NR()),
      h('p', { class: 'note' }, 'Internal only. Never part of anything you share.')),
    sec('Also yours to keep', 'person-card.keep', null,
      h('button', { type: 'button', class: 'pc-keep-row', 'data-id': 'person-card.originals', onClick: () => originalsSheet(b) },
        ico('file'), h('span', { class: 'grow' }, 'Original profiles'), h('span', { class: 'mono note' }, `${srcs.length} · private`), ico('chevron')),
      h('button', { type: 'button', class: 'pc-keep-row', 'data-id': 'person-card.attachments', onClick: () => attachmentsSheet(b) },
        ico('folder'), h('span', { class: 'grow' }, 'Attachments'), h('span', { class: 'mono note' }, `${atts.length ? atts.length : 'No files'} · private`), ico('chevron'))),
    h('div', { class: 'stamp pc-stamp' }, `updated ${dateOnly(p.updatedAt)} · added ${dateOnly(p.createdAt)}`),
    h('div', { class: 'pc-danger' }, h('button', { type: 'button', class: 'linkish danger-text', 'data-id': 'person-card.delete', onClick: () => deletePerson(b) }, 'Delete this person')),
  ];
}

function linkedName(name, contactId, b) {
  const c = contactId && b.contactsById.get(contactId);
  return c ? h('a', { href: `#/contacts/${encodeURIComponent(c.id)}` }, name || store.displayName(c)) : name;
}

function contactFact(c, b) {
  const own = c.role === 'person';
  const name = c.name || (own ? b.p.name : '');
  return h('div', { class: 'fact', 'data-id': 'person-card.contact' },
    h('dt', {}, own ? 'Own number' : store.phoneRoleLabel(c.role)),
    h('dd', { dir: 'auto' },
      h('div', {}, name ? linkedName(name, c.contactId, b) : h('span', { class: 'muted' }, c.role === 'unknown' ? 'Not sure whose number' : 'Name not recorded')),
      h('div', { class: 'mono small' }, c.number ? h('a', { href: 'tel:' + c.number.replace(/[^\d]/g, '') }, c.number) : 'Phone not recorded'),
      c.email ? h('div', { class: 'small' }, h('a', { href: 'mailto:' + c.email }, c.email)) : null),
    h('span', { class: 'priv' }, 'private'));
}

function originalsSheet(b) {
  const list = [...b.srcs].reverse();
  sheet({ title: 'Original profiles', dataId: 'person-card.originals-sheet', className: 'tall',
    body: list.length ? [h('p', { class: 'note' }, 'Kept exactly as received. Newer versions never replace older ones.'),
      ...list.map((s, i) => h('div', { class: 'orig-item' },
        h('div', { class: 'eyebrow' }, [dateOnly(s.receivedAt || s.createdAt), s.sender || 'sender not recorded'].join(' · '), i === list.length - 1 ? ' · earliest' : ''),
        s.text ? h('div', { class: 'orig-text', dir: 'auto' }, s.text) : null,
        ...b.atts.filter(a => a.sourceId === s.id).map(a => h('a', { class: 'att-row', href: a.dataUrl, download: a.name }, ico('file'), h('span', { dir: 'auto' }, a.name)))))]
      : [h('p', { class: 'note' }, 'No original was pasted or attached for this person.')] });
}
function attachmentsSheet(b) {
  sheet({ title: 'Attachments', dataId: 'person-card.attachments-sheet',
    body: b.atts.length ? b.atts.map(a => h('a', { class: 'att-row', href: a.dataUrl, download: a.name, 'data-id': 'person-card.attachment' }, ico('file'),
      h('span', { dir: 'auto', class: 'att-name' }, a.name), h('span', { class: 'note' }, a.sourceId ? 'original' : '')))
      : [h('p', { class: 'note' }, 'No files attached. Use Edit person → Attached items to add some.')] });
}

async function deletePerson(b) {
  const { p } = b;
  if (b.offers.length || b.tries.length) { toast('This person has a formal offer or shidduch history, which is kept. Delete is not available.', 5000); return; }
  if (!(await confirmDialog({ title: `Delete ${store.personName(p)}?`, text: 'Removes the person, their originals, attachments, interest records and follow-ups from this phone. Conversation entries also linked to a contact stay with that contact. This cannot be undone.', ok: 'Delete', danger: true, dataId: 'person-card.delete-dialog' }))) return;
  for (const s of b.srcs) await store.sources.remove(s.id);
  for (const a of b.atts) await store.attachments.remove(a.id);
  for (const i of b.ints) await store.interests.remove(i.id);
  for (const f of b.fus) await store.followUps.remove(f.id);
  for (const e of b.evs) {
    const rest = (e.personIds || []).filter(x => x !== p.id);
    if (rest.length || (e.contactIds || []).length) await store.events.save({ ...e, personIds: rest }); else await store.events.remove(e.id);
  }
  await store.people.remove(p.id);
  toast('Deleted'); navigate('/people');
}

// ---------- Offers ----------
function offersTab(b) {
  const { p, ints } = b;
  const P = pron(p);
  const mine = ints.filter(i => i.side === 'mine'), theirs = ints.filter(i => i.side === 'theirs');
  const offersList = b.offers;
  return [
    sec('My interest · private', 'person-card.my-interest', null,
      mine[0] ? interestView(mine[0], 'mine') : h('p', {}, 'Not recorded yet.'),
      h('button', { type: 'button', class: 'btn small', 'data-id': 'person-card.my-interest-btn', onClick: () => interestSheet('mine') }, mine[0] ? 'Change my interest' : 'Record my interest'),
      history(mine.slice(1), 'mine')),
    sec(`${P.His} response · as reported`, 'person-card.their-response', null,
      theirs[0] ? interestView(theirs[0], 'theirs') : h('p', {}, 'No response reported yet.'),
      h('button', { type: 'button', class: 'btn small', 'data-id': 'person-card.their-response-btn', onClick: () => interestSheet('theirs') }, 'Record a reported response'),
      history(theirs.slice(1), 'theirs')),
    sec('Formal offers and shidduchim', 'person-card.formal', null,
      offersList.length
        ? offersList.map(o => formalRow(o, b))
        : h('p', {}, 'No formal offer has been created. Saving a name or recording interest does not move anyone into In Progress.'),
      h('dl', { class: 'facts' },
        fact('Existing tries', b.tries.length ? String(b.tries.length) : 'None'),
        b.fus.filter(f => !f.done)[0] ? fact('Next step', b.fus.filter(f => !f.done).sort((a, c) => (a.dueAt || '9').localeCompare(c.dueAt || '9'))[0].text) : null),
      offersList.length
        ? h('p', { class: 'note' }, 'Answers, dates, ending and Try Again are recorded on the shidduch itself, never here.')
        : h('button', { type: 'button', class: 'btn small', 'data-id': 'person-card.start-offer', onClick: () => startOfferSheet(b) }, 'Start a formal offer')),
    sec('Suggested by', 'person-card.suggested', null,
      suggestedBy(b),
      h('p', { class: 'note' }, 'One person record. Several sources. No duplicate profiles.')),
    h('p', { class: 'note pc-foot' }, 'Formal dates and earlier tries, once there are any, live in Shidduchim with their own history. This card only shows a short status.'),
  ];
}

// Short status of the one formal offer (one couple = one record); opens the Shidduchim page.
function formalRow(o, b) {
  const tries = b.tries.filter(t => t.offerId === o.id).sort((a, c) => (a.n || 0) - (c.n || 0));
  const cur = tries[tries.length - 1];
  const m = { o, person: b.p, cur: { t: cur || {} } };
  let text = 'Offer';
  if (cur) {
    const lane = laneOf(cur);
    text = lane === 'ended' ? `Ended by ${endedByName(m, cur)}` + (cur.endedReason ? ' · ' + cur.endedReason : '') : `${laneLabel(lane)} · ${stageWord(cur, [])}`;
    if (tries.length > 1) text += ` · ${tryName(tries.length)}`;
  }
  return h('a', { class: 'row-link', href: `#/shidduchim/${encodeURIComponent(o.id)}`, 'data-id': 'person-card.offer-link' },
    h('div', { class: 'row-main' }, h('div', { class: 'row-title', dir: 'auto' }, text), h('div', { class: 'row-sub' }, `Started ${dateOnly(o.createdAt)} · open in Shidduchim`)),
    ico('chevron'));
}

// Only this explicit step creates a formal offer. The shadchan is optional and can be set later.
async function startOfferSheet(b) {
  const p = b.p;
  const linked = (p.contactIds || []).map(id => b.contactsById.get(id)).filter(Boolean);
  let contactId = p.senderContactId && linked.some(c => c.id === p.senderContactId) ? p.senderContactId : (linked[0]?.id || null);
  const res = await sheet({ title: `Start a formal offer · ${store.personName(p)}`, dataId: 'start-offer-sheet',
    body: [h('p', {}, 'This creates one shidduch record for you and ', h('span', { dir: 'auto' }, store.personName(p)), '. It starts in Offers with both answers waiting; it moves to In Progress only when both sides say Yes.'),
      linked.length ? h('div', { class: 'field' }, h('label', {}, 'Shadchan (optional)'),
        bubbles({ options: linked.map(c => [c.id, store.displayName(c)]), selected: contactId ? [contactId] : [], multi: false, dataId: 'start-offer-sheet.shadchan', onChange: (v) => { contactId = v || null; } }))
        : h('p', { class: 'note' }, 'No shadchan is linked to this person yet. You can set one on the shidduch afterwards.'),
      h('p', { class: 'note' }, 'Your private interest and the reported response above stay as they are; they are separate from the formal answers.')],
    actions: [{ id: 'start', label: 'Start offer', primary: true }] });
  if (res !== 'start') return;
  const o = await startOffer({ personId: p.id, contactId });
  toast('Formal offer started');
  navigate(`/shidduchim/${encodeURIComponent(o.id)}`);
}

function interestView(i, side) {
  return h('div', { class: 'interest', 'data-id': `person-card.${side}-current` },
    h('p', { class: 'interest-value' }, i.value),
    i.reason ? h('p', { class: 'prewrap', dir: 'auto' }, i.reason) : null,
    h('p', { class: 'note' }, side === 'mine' ? `Saved ${dateOnly(i.at)} · only you can see this`
      : `Reported by ${i.reportedBy || 'someone not recorded'} · ${dateOnly(i.at)}`));
}

function history(list, side) {
  if (!list.length) return null;
  return h('details', { class: 'pc-history', 'data-id': `person-card.${side}-history` },
    h('summary', {}, `Earlier · ${list.length}`),
    h('ol', { class: 'timeline' }, list.map(i => h('li', { class: 'tl-item' },
      h('div', { class: 'tl-head' }, h('span', { class: 'via' }, i.value), h('time', {}, dateOnly(i.at))),
      i.reason ? h('p', { dir: 'auto' }, i.reason) : null,
      side === 'theirs' && i.reportedBy ? h('div', { class: 'note' }, 'Reported by ' + i.reportedBy) : null))));
}

function suggestedBy(b) {
  const rows = [];
  const seen = new Set();
  for (const s of b.srcs) {
    rows.push(fact(s.sender ? linkedName(s.sender, s.senderContactId, b) : 'Sender not recorded', dateOnly(s.receivedAt || s.createdAt)));
    if (s.senderContactId) seen.add(s.senderContactId);
  }
  for (const id of b.p.contactIds || []) {
    if (seen.has(id)) continue;
    const c = b.contactsById.get(id); if (!c) continue;
    const role = (b.p.contactCards || []).find(k => k.contactId === id)?.role;
    rows.push(fact(linkedName(store.displayName(c), id, b), role ? store.phoneRoleLabel(role) : 'Linked contact'));
  }
  return rows.length ? h('dl', { class: 'facts' }, rows) : h('p', {}, NR());
}

// Each change is a new dated record; earlier ones stay as history.
async function interestSheet(side) {
  const p = B.p;
  const cur = B.ints.find(i => i.side === side);
  let value = '', reportedByContactId = null;
  const reason = h('textarea', { class: 'input grow', rows: 2, dir: 'auto', 'data-id': 'interest-sheet.reason', placeholder: side === 'mine' ? 'Why? (private)' : 'What exactly was said?' });
  const date = h('input', { class: 'input', type: 'date', value: today(), 'data-id': 'interest-sheet.date' });
  const linked = (p.contactIds || []).map(id => B.contactsById.get(id)).filter(Boolean);
  const by = h('input', { class: 'input', dir: 'auto', value: '', placeholder: 'Who told you?', 'data-id': 'interest-sheet.reported-by', onInput: () => { reportedByContactId = null; } });
  const body = [
    h('div', { class: 'field' }, h('label', {}, side === 'mine' ? 'My interest' : 'Their response'),
      bubbles({ options: (side === 'mine' ? MY_INTEREST : THEIR_RESPONSE).map(v => [v, v]), selected: [], multi: false, dataId: 'interest-sheet.value', onChange: (v) => { value = v; } })),
    h('div', { class: 'field' }, h('label', {}, side === 'mine' ? 'Reason (optional, private)' : 'Details (optional)'), reason),
    side === 'theirs' ? h('div', { class: 'field' }, h('label', {}, 'Reported by'), by,
      linked.length ? bubbles({ options: linked.map(c => [c.id, store.displayName(c)]), selected: [], multi: false, dataId: 'interest-sheet.reporter',
        onChange: (id) => { reportedByContactId = id || null; by.value = id ? store.displayName(B.contactsById.get(id)) : ''; } }) : null) : null,
    h('div', { class: 'field' }, h('label', {}, 'Date'), date),
    h('p', { class: 'note' }, cur ? `Now: ${cur.value}. The earlier answer stays in the history. ` : '', 'This never starts, ends or reopens a formal shidduch.'),
  ];
  await sheet({ title: side === 'mine' ? 'My interest' : `${pron(p).His} response, as reported`, dataId: 'interest-sheet', body,
    actions: [{ id: 'save', label: 'Save', primary: true, run: async () => {
      if (!value) { toast('Choose one answer first'); return false; }
      await store.interests.save({ personId: p.id, side, value, reason: reason.value.trim(), at: atFrom(date.value),
        ...(side === 'theirs' ? { reportedBy: by.value.trim(), reportedByContactId } : {}) });
      toast('Saved — earlier answers stay in the history');
    } }] });
}

// ---------- Notes ----------
function notesTab(b) {
  const { p, evs, fus } = b;
  const linked = (p.contactIds || []).map(id => b.contactsById.get(id)).filter(Boolean);
  const d = drafts[p.id] || (drafts[p.id] = { text: '', type: '_unknown', date: today(), contactIds: [] });
  const text = h('textarea', { class: 'input grow', rows: 3, dir: 'auto', placeholder: 'Write what you learned or want to remember…', 'data-id': 'person-card.note-text',
    onInput: (e) => { d.text = e.target.value; grow(e.target); } }, d.text);
  const open = fus.filter(f => !f.done).sort((a, c) => (a.dueAt || '9').localeCompare(c.dueAt || '9'));
  const done = fus.filter(f => f.done);
  return [
    sec('Private notes and conversations', 'person-card.notes', null,
      evs.length ? h('ol', { class: 'timeline' }, evs.map(e => eventItem(e, b))) : h('p', { class: 'note' }, 'Nothing recorded yet.')),
    sec('Follow-ups', 'person-card.followups', null,
      open.length ? open.map(f => fuRow(f, b)) : h('p', { class: 'note' }, 'No open follow-ups.'),
      done.length ? h('details', { class: 'pc-history' }, h('summary', {}, `Done · ${done.length}`), done.map(f => fuRow(f, b))) : null,
      h('button', { type: 'button', class: 'btn small', 'data-id': 'person-card.add-followup', onClick: () => followUpSheet() }, ico('clock'), 'Add a follow-up')),
    sec('Add private note', 'person-card.composer', null,
      text,
      h('div', { class: 'field' }, h('label', {}, 'How'), bubbles({ options: TYPE_OPTS, selected: [d.type], multi: false, dataId: 'person-card.note-type', onChange: (v) => { d.type = v || '_unknown'; } })),
      linked.length ? h('div', { class: 'field' }, h('label', {}, 'With (also shows on their contact)'),
        bubbles({ options: linked.map(c => [c.id, store.displayName(c)]), selected: d.contactIds, dataId: 'person-card.note-contacts', onChange: (v) => { d.contactIds = v; } })) : null,
      h('div', { class: 'composer-foot' },
        h('input', { class: 'input date', type: 'date', value: d.date, 'aria-label': 'Date', 'data-id': 'person-card.note-date', onChange: (e) => { d.date = e.target.value; } }),
        h('button', { type: 'button', class: 'btn primary', 'data-id': 'person-card.note-save', onClick: async () => {
          if (!d.text.trim()) { toast('Write a few words first'); text.focus(); return; }
          await store.recordEvent({ personIds: [p.id], contactIds: d.contactIds, type: d.type === '_unknown' ? '' : d.type, text: d.text, at: atFrom(d.date) });
          drafts[p.id] = { text: '', type: '_unknown', date: today(), contactIds: [] };
          toast(d.contactIds.length ? 'Saved — also in the contact’s history' : 'Note saved');
        } }, 'Save note')),
      h('p', { class: 'note' }, 'Saved only on this phone. Nothing is sent to anyone.')),
    sec('Source and privacy', 'person-card.privacy', null,
      h('p', {}, 'These notes are separate from anything you send from My Profile. A note linked to a shadchan is one record that shows in both places.')),
  ];
}
function grow(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight + 2, 420) + 'px'; }

function eventItem(e, b) {
  const who = (e.contactIds || []).map(id => b.contactsById.get(id)).filter(Boolean).map(c => store.displayName(c));
  return h('li', { class: 'tl-item', 'data-id': 'person-card.event' },
    h('div', { class: 'tl-head' }, h('span', { class: 'via' }, [store.eventTypeLabel(e.type), ...who].join(' · ')), h('time', { datetime: e.at }, dateOnly(e.at))),
    h('p', { dir: 'auto', class: 'prewrap' }, e.text),
    h('div', { class: 'tl-actions' },
      h('button', { type: 'button', class: 'linkish', 'data-id': 'person-card.event-edit', onClick: () => eventSheet(e, b) }, 'Edit'),
      h('button', { type: 'button', class: 'linkish danger-text', 'data-id': 'person-card.event-delete', onClick: async () => {
        if (await confirmDialog({ title: 'Delete this entry?', text: 'It disappears from every place it is linked to.', ok: 'Delete', danger: true, dataId: 'person-card.event-delete-dialog' })) { await store.events.remove(e.id); toast('Deleted'); }
      } }, 'Delete')));
}

async function eventSheet(e, b) {
  let type = e.type || '_unknown', contactIds = [...(e.contactIds || [])];
  const ids = [...new Set([...(b.p.contactIds || []), ...contactIds])];
  const text = h('textarea', { class: 'input grow', rows: 4, dir: 'auto', 'data-id': 'person-card.event-sheet.text', onInput: (ev) => grow(ev.target) }, e.text || '');
  const date = h('input', { class: 'input', type: 'date', value: (e.at || '').slice(0, 10), 'data-id': 'person-card.event-sheet.date' });
  setTimeout(() => grow(text), 30);
  await sheet({ title: 'Edit entry', dataId: 'person-card.event-sheet',
    body: [h('div', { class: 'field' }, h('label', {}, 'How'), bubbles({ options: TYPE_OPTS, selected: [type], multi: false, onChange: (v) => { type = v || '_unknown'; } })),
      h('div', { class: 'field' }, h('label', {}, 'What was said'), text),
      ids.length ? h('div', { class: 'field' }, h('label', {}, 'Linked contacts'), bubbles({ options: ids.map(id => [id, b.contactsById.get(id) ? store.displayName(b.contactsById.get(id)) : 'Deleted contact']), selected: contactIds, onChange: (v) => { contactIds = v; } })) : null,
      h('div', { class: 'field' }, h('label', {}, 'Date'), date)],
    actions: [{ id: 'save', label: 'Save', primary: true, run: async () => {
      if (!text.value.trim()) { toast('The entry cannot be empty — delete it instead'); return false; }
      await store.recordEvent({ ...e, contactIds, type: type === '_unknown' ? '' : type, text: text.value, at: atFrom(date.value, e.at) });
      toast('Updated everywhere it appears');
    } }] });
}

function fuRow(f, b) {
  const c = f.contactId && b.contactsById.get(f.contactId);
  return h('div', { class: 'fu-row' + (f.done ? ' done' : ''), 'data-id': 'person-card.followup' },
    h('input', { type: 'checkbox', checked: f.done || null, 'aria-label': 'Done', onChange: async (e) => { await store.followUps.save({ ...f, done: e.target.checked }); toast(e.target.checked ? 'Marked done' : 'Reopened'); } }),
    h('button', { type: 'button', class: 'fu-main', onClick: () => followUpSheet(f) },
      h('span', { dir: 'auto' }, f.text),
      h('span', { class: 'note' }, [f.dueAt ? dateOnly(f.dueAt) : 'No date', c ? store.displayName(c) : ''].filter(Boolean).join(' · '))));
}

async function followUpSheet(f = null) {
  const p = B.p;
  let contactId = f?.contactId || null;
  const text = h('input', { class: 'input', dir: 'auto', value: f?.text || '', placeholder: 'e.g. Ask for a reference', 'data-id': 'followup-sheet.text' });
  const due = h('input', { class: 'input', type: 'date', value: f?.dueAt || '', 'data-id': 'followup-sheet.due' });
  const linked = (p.contactIds || []).map(id => B.contactsById.get(id)).filter(Boolean);
  const acts = [{ id: 'save', label: 'Save', primary: true, run: async () => {
    await store.followUps.save({ ...(f || {}), personId: p.id, contactId, text: text.value.trim() || 'Follow up', dueAt: due.value || null, done: f?.done || false });
    toast(contactId ? 'Follow-up saved — also on the contact' : 'Follow-up saved');
  } }];
  if (f) acts.unshift({ id: 'delete', label: 'Delete', danger: true, run: async () => { await store.followUps.remove(f.id); toast('Follow-up deleted'); } });
  setTimeout(() => text.focus(), 50);
  await sheet({ title: f ? 'Edit follow-up' : `Follow-up · ${store.personName(p)}`, dataId: 'followup-sheet', actions: acts,
    body: [h('div', { class: 'field' }, h('label', {}, 'What to do'), text),
      h('div', { class: 'field' }, h('label', {}, 'When (optional)'), due),
      linked.length ? h('div', { class: 'field' }, h('label', {}, 'With (optional)'), bubbles({ options: linked.map(c => [c.id, store.displayName(c)]), selected: contactId ? [contactId] : [], multi: false, dataId: 'followup-sheet.contact', onChange: (v) => { contactId = v || null; } })) : null] });
}
