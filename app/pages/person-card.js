// Person card — Profile · Offers · Notes (spec/offers-cards.md). Same reading layout as
// My Profile (source/Shadchanim Offers.html). Reads the one shared person record; editing
// opens the Add Person form. Interest never creates, ends or reopens a formal offer.
import * as store from '../js/store.js';
import { h, icon, toast, sheet, bubbles, confirmDialog, telLink, mailLink, dock, swipeTabs } from '../js/ui.js';
import { navigate } from '../js/router.js';
import { isShadchan, peopleListPath, peopleListName, rememberList } from '../js/mode.js';
import { suggestedFor, loadPerson, pron, kindLabel, dateOnly, LISTS, listType, GIRLS_ONLY, KNOW_CONTACT, KNOW_FLAGS, EXCLUSIVE } from './people-data.js';
import { copy } from './profile-share.js';
import { ideaStatus, latestByPerson, recordInterest, reopen } from './idea-flow.js';
import { singlePanel } from './single-panel.js';
import { startOffer, laneOf, laneLabel, stageWord, tryName, endedByName } from './shidduch-data.js';
import { forSingle, removeShidduch, fullName as shName, other as shOther } from './sh-shidduch-data.js';
import { singleShidduchim } from './sh-shidduch-parts.js';

const ico = (n) => h('span', { html: icon(n) }).firstChild;
const NR = () => h('span', { class: 'muted' }, 'Not recorded');
// Shadchan Mode (spec/shadchan/design.md 6.2): Profile · Shidduchim · Notes. The tab key stays 'offers' so links keep working.
const TABS = isShadchan ? [['profile', 'Profile'], ['offers', 'Shidduchim'], ['notes', 'Notes']]
  : [['profile', 'Profile'], ['short', 'Short versions'], ['offers', 'Offers'], ['notes', 'Notes']];
export const MY_INTEREST = ['Interested', 'Want to learn more', 'Not sure yet', 'Not interested'];
export const THEIR_RESPONSE = ['Yes, interested', 'Checking availability', 'Thinking about it', 'Not available now', 'No', 'Not asked yet'];
const TYPE_OPTS = store.EVENT_TYPES.map(([v, l]) => [v || '_unknown', l]);
const today = () => new Date().toISOString().slice(0, 10);
const atFrom = (d, prev) => (!d ? store.now() : prev && prev.slice(0, 10) === d ? prev : d === today() ? store.now() : new Date(d + 'T12:00:00').toISOString());

let root = null, gen = 0, unsub = null, timer = 0, B = null, tab = 'profile';
const drafts = {}; // personId → unsent note text
export function destroy() { if (root) swipeTabs(root, null); EDITF = false; SEC = null; root = null; gen++; unsub && unsub(); unsub = null; clearTimeout(timer); }

export async function render(container, params) {
  root = container;
  root.classList.add('person-card-page');
  swipeTabs(root, { keys: () => TABS.map(t => t[0]), current: () => tab, go: (k) => setTab(k) });
  tab = TABS.some(t => t[0] === params.tab) ? params.tab : 'profile';
  unsub && unsub();
  unsub = store.subscribe((ch) => { if (EDITF || SEC) return; if (ch.store !== 'prefs' && ch.store !== 'meta') { clearTimeout(timer); timer = setTimeout(() => draw(params.id, true), 80); } });
  await draw(params.id);
}

async function draw(id, keepScroll = false) {
  const token = ++gen;
  const [b, ch] = await Promise.all([loadPerson(id), store.getChoices()]);
  if (b && isShadchan) b.sh = await forSingle(b.p); // every shidduch this single is part of (stage S3)
  if (token !== gen || !root) return;
  CH = ch;
  if (B && B.p.id !== id) { EDITF = false; SEC = null; }
  const y = window.scrollY;
  root.innerHTML = '';
  if (!b) { root.append(h('p', { class: 'empty' }, 'This person is no longer saved.'), h('a', { class: 'btn', href: '#/people' }, isShadchan ? 'Back to the list' : 'Back to Ideas')); return; }
  B = b;
  const p = b.p;
  rememberList(p.kind); // Shadchan Mode: the bottom bar lights up Guys or Girls
  const enc = encodeURIComponent(p.id);
  root.append(
    h('div', { class: 'pc-namebar', 'data-id': 'person-card.namebar' },
      h('a', { class: 'icon-btn', href: '#' + peopleListPath(p.kind), 'aria-label': 'Back to ' + peopleListName(p.kind), 'data-id': 'person-card.back', html: icon('back') }),
      h('h1', { dir: 'auto' }, store.personName(p)),
      p.kind ? h('span', { class: 'pc-kind' }, kindLabel(p.kind)) : null,
      h('span', { class: 'spacer' }),
      h('a', { class: 'icon-btn bordered', href: `#/people/${enc}/edit`, 'aria-label': 'Edit person', title: 'Edit person', 'data-id': 'person-card.edit', html: icon('edit') })),
    h('div', { class: 'pc-actions', 'data-id': 'person-card.actions' },
      h('button', { type: 'button', class: 'btn small', 'data-id': 'person-card.add-note', onClick: () => { setTab('notes'); setTimeout(() => root?.querySelector('[data-id="person-card.note-text"]')?.focus(), 120); } }, ico('message'), 'Add note'),
      h('button', { type: 'button', class: 'btn small', 'data-id': 'person-card.follow-up', onClick: () => followUpSheet() }, ico('clock'), 'Follow-up')),
    h('div', { class: 'pc-tabs', role: 'tablist', 'data-id': 'person-card.tabs' },
      TABS.map(([k, l]) => h('button', { type: 'button', role: 'tab', 'aria-selected': tab === k ? 'true' : 'false', 'data-id': 'person-card.tab-' + k, onClick: () => setTab(k) }, l,
        isShadchan && k === 'offers' && b.sh.length ? h('span', { class: 'pc-tab-n' }, b.sh.length) : null))),
    h('div', { class: 'pc-body', 'data-id': 'person-card.' + tab }, tab === 'profile' ? profileTab(b) : tab === 'short' ? shortTab(b) : tab === 'offers' ? (isShadchan ? singleShidduchim(b.p, b.sh, { refresh: redraw }) : offersTab(b)) : notesTab(b)),
    // Status buttons stay on screen at the bottom (owner request); hidden while a section is being edited.
    // (Single Mode's interest buttons. In Shadchan Mode, Status and Talk to sit at the top of the Profile tab.)
    EDITF || SEC || isShadchan ? '' : dock('person-card.dock', statusStrip(b)));
  if (keepScroll) window.scrollTo(0, y);
}

function setTab(k) {
  const path = `/people/${encodeURIComponent(B.p.id)}${k === 'profile' ? '' : '/' + k}`;
  navigate(path, { replace: true });
}

// Every pencil edits its section right here (owner request, tweak mode). Facts save as you go
// (one Done); the other sections are a small Cancel / Save form. The top pencil opens the full form.
let CH = {}, EDITF = false, SEC = null, SNAPF = null; // SNAPF: person as it was when Editing facts began (Cancel puts it back)
const pencil = (label, dataId, onClick) => h('button', { type: 'button', class: 'icon-btn', 'aria-label': label, 'data-id': dataId, html: icon('edit'), onClick });
const redraw = () => draw(B.p.id, true);
const openSec = (key) => { SEC = key; EDITF = false; redraw(); };
function sec(title, dataId, key, ...kids) {
  const facts = key === 'facts', editing = facts ? EDITF : key && SEC === key;
  return h('section', { class: 'pc-sec' + (editing ? ' mp-editing' : ''), 'data-id': dataId },
    h('div', { class: 'pc-sec-head' }, h('h2', { class: 'eyebrow', dir: 'auto' }, title),
      facts && EDITF ? h('div', { class: 'mp-inline-actions mp-form-bar', 'data-id': dataId + '-bar' }, h('span', { class: 'mp-form-bar-label' }, 'Editing facts'),
        h('button', { type: 'button', class: 'btn small', 'data-id': dataId + '-cancel', onClick: async () => { document.activeElement?.blur(); EDITF = false; if (SNAPF) { B.p = await store.people.save(SNAPF); toast('Changes undone'); } SNAPF = null; redraw(); } }, 'Cancel'),
        h('button', { type: 'button', class: 'btn small primary', 'data-id': dataId + '-done', onClick: () => { document.activeElement?.blur(); EDITF = false; SNAPF = null; setTimeout(redraw, 120); } }, 'Save'))
      : facts ? pencil('Edit facts here', dataId + '-edit', () => { EDITF = true; SEC = null; SNAPF = structuredClone(B.p); redraw(); })
      : key && !editing ? pencil('Edit ' + title.toLowerCase() + ' here', dataId + '-edit', () => openSec(key)) : null),
    ...(editing && !facts ? [secForm(key, dataId)] : kids));
}
// Empty answers are left out of the profile screen (owner request): no "Not recorded" rows.
const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);
const fact = (k, v, dataId) => isEmpty(v) ? null : h('div', { class: 'fact', 'data-id': dataId }, h('dt', {}, k), h('dd', { dir: 'auto' }, Array.isArray(v) ? v.join(', ') : v));
const firstName = (p) => (p.name || '').trim().split(/\s+/)[0] || pron(p).him;

// ---------- Profile ----------
function profileTab(b) {
  const { p, srcs, atts } = b;
  const P = pron(p), enc = encodeURIComponent(p.id), A = p.answers || {};
  const edit = (s) => `#/people/${enc}/edit/${s}`;
  const summary = [p.age, p.city, p.occupation].filter(Boolean).join(' · ');
  const first = srcs[0];
  const cards = p.contactCards || [];
  const ownCards = cards.filter(c => c.role === 'person' && (c.number || c.email));
  const others = cards.filter(c => c.role !== 'person');
  return [
    SEC === 'summary' ? h('div', { class: 'pc-summary mp-editing', 'data-id': 'person-card.summary' }, secForm('summary', 'person-card.summary')) :
    h('div', { class: 'pc-summary', 'data-id': 'person-card.summary' },
      h('div', { class: 'avatar lg' }, store.initials(p)),
      h('div', { class: 'pc-summary-text' },
        h('div', { class: 'pc-summary-line', dir: 'auto' }, summary || ''),
        // Their own phone and email live only here, under the name (owner request).
        ownCards.length ? h('div', { class: 'reach', 'data-id': 'person-card.phone' }, ownCards.map(c => [c.number ? telLink(c.number) : null, c.email ? mailLink(c.email) : null])) : null,
        p.about ? h('div', { class: 'note clamp', dir: 'auto' }, p.about) : null),
      pencil('Edit basic info here', 'person-card.summary-edit', () => openSec('summary'))),
    // Shadchan Mode: Status, Working on, ages, Talk to, Last confirmed, Find a match (stage S2).
    isShadchan ? singlePanel(p, savePerson) : null,
    sec('Facts', 'person-card.facts', 'facts',
      h('dl', { class: 'facts' },
        ...factList(p).map(f => EDITF && f.ed ? editRow(f) : fact(f.label, f.value, f.dataId)),
        EDITF ? null : fact('Profile source', first ? [first.sender || 'Sender not recorded', dateOnly(first.receivedAt || first.createdAt)].join(' · ') : (p.sender || ''), 'person-card.fact-source')),
      h('a', { class: 'pc-add', href: edit('about'), 'data-id': 'person-card.add-fact' }, 'Add a fact…')),
    !p.about ? null : sec(`About ${firstName(p)}`, 'person-card.about', 'about',
      h('p', { class: 'prewrap', dir: 'auto' }, p.about)),
    !p.looking ? null : sec(`What ${P.he}${p.kind ? '’s' : '’re'} looking for`, 'person-card.looking', 'looking',
      h('p', { class: 'prewrap', dir: 'auto' }, p.looking)),
    !(others.length || p.sender) ? null : sec('Contacts and source', 'person-card.contacts', 'contacts',
      others.length || p.sender ? h('dl', { class: 'facts' },
        ...others.map(c => contactFact(c, b)),
        p.sender ? h('div', { class: 'fact' }, h('dt', {}, 'Sent by'), h('dd', { dir: 'auto' }, linkedName(p.sender, p.senderContactId, b)), h('span', { class: 'priv' }, 'private')) : null)
        : h('p', {}, NR()),
      h('p', { class: 'note' }, 'A number given for a mother, father, reference or shadchan is never shown as their own number.')),
    !((p.know || []).length || p.yearsKnown || p.howKnow) ? null : sec(`How I know ${P.him}`, 'person-card.known', 'known',
      (p.know || []).length || p.yearsKnown || p.howKnow ? h('dl', { class: 'facts' },
        fact('Contact', p.know, 'person-card.fact-know'),
        p.yearsKnown ? fact('Years known', p.yearsKnown) : null,
        p.howKnow ? fact('How', p.howKnow) : null) : h('p', {}, NR()),
      h('p', { class: 'note' }, 'Internal only. Never part of anything you share.')),
    sec('Also yours to keep', 'person-card.keep', null,
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
      c.number || c.email ? h('div', { class: 'reach' }, c.number ? telLink(c.number) : null, c.email ? mailLink(c.email) : null) : h('div', { class: 'small' }, 'Phone not recorded')),
    h('span', { class: 'priv' }, 'private'));
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
  // Shadchan Mode: a single with an open shidduch (Offers or In Progress) cannot be deleted; end it first.
  // Ideas and finished shidduchim go with the single, as one deletion that Restore brings back whole.
  const sh = b.sh || [], openSh = sh.find(m => m.lane === 'offers' || m.lane === 'progress');
  if (openSh) {
    toast(`${store.personName(p)} has an open shidduch with ${shName(openSh, shOther(p.kind))}. End it first, or set the status to Not relevant.`, 6000,
      { label: 'Open', run: () => navigate(`/shidduchim/${encodeURIComponent(openSh.o.id)}`) });
    return;
  }
  if (!(await confirmDialog({ title: `Delete ${store.personName(p)}?`, text: 'Removes the person, their originals, attachments, interest records and follow-ups from this phone. Conversation entries also linked to a contact stay with that contact. ' + (sh.length ? `Also removes ${sh.length === 1 ? '1 idea or finished shidduch' : sh.length + ' ideas and finished shidduchim'} with ${pron(p).him}. ` : '') + (store.SOFT_DELETE ? 'You can put it back for 30 days from Settings → Recently deleted.' : 'This cannot be undone.'), ok: 'Delete', danger: true, dataId: 'person-card.delete-dialog' }))) return;
  await store.asOne(async () => { // one deletion: Shadchan Mode can restore it whole from Recently deleted
    for (const m of sh) await removeShidduch(m);
    for (const s of b.srcs) await store.sources.remove(s.id);
    for (const a of b.atts) await store.attachments.remove(a.id);
    for (const i of b.ints) await store.interests.remove(i.id);
    for (const f of b.fus) await store.followUps.remove(f.id);
    for (const e of b.evs) {
      const rest = (e.personIds || []).filter(x => x !== p.id);
      if (rest.length || (e.contactIds || []).length) await store.unlink(store.events, e, 'personIds', p.id); else await store.events.remove(e.id);
    }
    await store.people.remove(p.id);
  });
  toast(store.SOFT_DELETE ? 'Deleted. It waits 30 days in Settings → Recently deleted' : 'Deleted', store.SOFT_DELETE ? 5000 : undefined); navigate(peopleListPath(p.kind));
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
    body: [h('p', {}, 'This creates one shidduch record for you and ', h('span', { dir: 'auto' }, store.personName(p)), '. Normally this happens by itself when you both say yes. It starts in Offers and moves to In Progress when the first date is set up.'),
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
      const o = await recordInterest(p.id, { side, value, reason: reason.value.trim(), at: atFrom(date.value),
        ...(side === 'theirs' ? { reportedBy: by.value.trim(), reportedByContactId } : {}) });
      if (o) movedToast(o); else toast('Saved — earlier answers stay in the history');
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
      e.noteId ? h('a', { class: 'linkish', href: `#/home/note/${encodeURIComponent(e.noteId)}`, 'data-id': 'person-card.event-home-note' }, 'Open Home note') : null,
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

// ---------- Short versions (owner request, tweak mode) ----------
// Like My Profile › Short versions. A pasted profile shows here word for word ("Pasted profile");
// editing it saves an editable copy on the person (shortVersions) — the original itself never changes.
// Suggested is built from the person's fields and is always up to date.
function shortCard({ title, sub, text, dataId, edit, remove }) {
  return h('article', { class: 'mp-card', 'data-id': dataId },
    h('div', { class: 'mp-card-head' },
      h('div', { class: 'mp-card-title' }, h('strong', { dir: 'auto' }, title), h('span', { class: 'stamp' }, sub)),
      h('button', { type: 'button', class: 'btn small', 'data-id': dataId + '.copy', onClick: async () => { if (await copy(text)) toast('Copied'); } }, 'Copy'),
      edit ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Edit ' + title, 'data-id': dataId + '.edit', html: icon('edit'), onClick: edit }) : null,
      remove ? h('button', { type: 'button', class: 'linkish danger-text', 'data-id': dataId + '.remove', onClick: remove }, 'Delete') : null),
    h('pre', { class: 'mp-text', dir: 'auto' }, text || '(empty)'));
}
function shortTab(b) {
  const p = b.p, list = p.shortVersions || [];
  const edited = new Set(list.map(x => x.fromSourceId).filter(Boolean));
  const pasted = b.srcs.filter(s => (s.text || '').trim() && !edited.has(s.id));
  const saveList = async (next) => { await store.people.save({ ...p, shortVersions: next }); };
  return [
    ...list.map(x => shortCard({ title: x.title || 'Short version', sub: (x.fromSourceId ? 'pasted, edited · ' : 'saved · ') + dateOnly(x.savedAt), text: x.text, dataId: 'person-card.short-version',
      edit: () => shortSheet(p, x), remove: async () => {
        if (!(await confirmDialog({ title: 'Delete this short version?', text: x.fromSourceId ? 'The pasted original stays in Original profiles.' : '', ok: 'Delete', danger: true, dataId: 'person-card.short-delete' }))) return;
        await saveList(list.filter(y => y.id !== x.id)); toast('Deleted');
      } })),
    ...pasted.map(s => shortCard({ title: 'Pasted profile', sub: [s.sender, dateOnly(s.receivedAt || s.createdAt)].filter(Boolean).join(' · '), text: s.text, dataId: 'person-card.short-pasted',
      edit: () => shortSheet(p, { id: store.newId('sv'), title: 'Pasted profile', text: s.text, fromSourceId: s.id }) })),
    shortCard({ title: 'Suggested', sub: 'auto · always up to date', text: suggestedFor(p), dataId: 'person-card.short-suggested' }),
    h('button', { type: 'button', class: 'btn', 'data-id': 'person-card.short-new', onClick: () => shortSheet(p, { id: store.newId('sv'), title: '', text: '' }) }, 'New short version'),
  ];
}
async function shortSheet(p, x) {
  const title = h('input', { class: 'input', dir: 'auto', value: x.title || '', placeholder: 'Name (optional)', 'data-id': 'person-card.short-sheet.title' });
  const text = h('textarea', { class: 'input mono', rows: 12, dir: 'auto', 'data-id': 'person-card.short-sheet.text' }); text.value = x.text || '';
  setTimeout(() => (x.text ? text : title).focus(), 50);
  await sheet({ title: x.text ? 'Edit short version' : 'New short version', dataId: 'person-card.short-sheet', className: 'tall',
    body: [h('div', { class: 'field' }, h('label', {}, 'Name'), title), h('div', { class: 'field' }, h('label', {}, 'Text'), text)],
    actions: [{ id: 'save', label: 'Save', primary: true, run: async () => {
      if (!text.value.trim()) { toast('Write some text first'); return false; }
      const rec = { ...x, title: title.value.trim() || x.title || 'Short version', text: text.value, savedAt: store.now() };
      const list = p.shortVersions || [];
      await store.people.save({ ...p, shortVersions: list.some(y => y.id === x.id) ? list.map(y => y.id === x.id ? rec : y) : [...list, rec] });
      toast('Saved');
    } }] });
}

// ---------- Facts: edit in place ----------
function factList(p) {
  const A = p.answers || {};
  const t = (label, field, dataId) => ({ label, value: p[field], dataId, ed: { type: 'text', get: () => p[field], set: (x) => ({ [field]: x }) } });
  const c = (label, key, dataId) => ({ label, value: key === 'languages' ? p.languages : A[key], dataId, ed: { type: 'choice', key } });
  const custom = Object.entries(A).filter(([k, v]) => !LISTS[k] && (Array.isArray(v) ? v.length : v)).map(([k]) => c((p.answerLabels || {})[k] || k, k, 'person-card.fact-custom'));
  return [t('Age', 'age', 'person-card.fact-age'), t('City', 'city', 'person-card.fact-city'), t('Occupation', 'occupation', 'person-card.fact-occupation'),
    c('Languages', 'languages', 'person-card.fact-languages'), c('Status', 'pStatus', 'person-card.fact-status'), c('Religious level', 'pLevel', 'person-card.fact-level'),
    c('Tzniut', 'pTzniut', 'person-card.fact-tzniut'), c('Religious background', 'pBackground', 'person-card.fact-background'),
    c('Religious', 'pReligious', 'person-card.fact-religious'), t('Other religious details', 'religiousOther', 'person-card.fact-religious-other'),
    c('Character & lifestyle', 'pTraits', 'person-card.fact-traits'), c('Body type', 'pBody', 'person-card.fact-body'),
    isShadchan ? null : t('Looking up to age', 'maxAge', 'person-card.fact-max-age'), ...custom].filter(Boolean);
}
async function savePerson(patch, quiet) {
  const p = { ...B.p, ...patch };
  if (patch.contactCards) p.contactIds = [...new Set([...p.contactCards.map(c => c.contactId), p.senderContactId].filter(Boolean))];
  B.p = await store.people.save(p);
  toast('Saved', quiet ? 1200 : 2600);
}
function editRow(f) {
  const p = B.p, box = h('div', { class: 'mp-inline' });
  if (f.ed.type === 'text') {
    const inp = h('input', { class: 'input', dir: 'auto', value: f.ed.get() || '', 'aria-label': f.label, 'data-id': 'person-card.inline-text' });
    inp.addEventListener('change', () => savePerson(f.ed.set(inp.value.trim()), true));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    box.append(inp);
  } else {
    const key = f.ed.key, A = p.answers || {};
    const type = key === 'languages' ? 'multi' : listType(key), multi = type !== 'single';
    const girl = p.kind === 'girl', only = GIRLS_ONLY[key] || [];
    const opts = (CH[key] || []).filter(o => !o.hidden && (girl || !only.includes(o.v))).map(o => [o.v, o.v]);
    let cur = [].concat((key === 'languages' ? p.languages : A[key]) ?? []).filter(Boolean);
    for (const v of cur) if (!opts.some(o => o[0] === v)) opts.push([v, v]); // keep answers no longer in the list
    const put = (val) => savePerson(key === 'languages' ? { languages: val } : { answers: { ...(B.p.answers || {}), [key]: multi ? val : (val[0] || '') } }, true);
    const wrap = h('div', {});
    const paint = () => { wrap.innerHTML = ''; wrap.append(bubbles({ options: opts, selected: cur, multi, dataId: 'person-card.inline-choice', onChange: (v) => {
      let next = multi ? v : (v ? [v] : []);
      for (const group of EXCLUSIVE[key] || []) { const added = next.find(x => group.includes(x) && !cur.includes(x)); if (added) next = next.filter(x => !group.includes(x) || x === added); }
      const changed = next.length !== v.length; cur = next; put(next); if (changed) paint();
    } })); };
    paint(); box.append(wrap);
  }
  return h('div', { class: 'fact mp-edit-row', 'data-id': f.dataId }, h('dt', { dir: 'auto' }, f.label), h('dd', {}, box));
}

// ---------- Section forms ----------
function secForm(key, dataId) {
  const p = B.p, id = dataId + '-form', t = (x) => (x || '').trim();
  const row = (label, el) => h('label', { class: 'mp-frow' }, h('span', { class: 'mp-flabel' }, label), el);
  const tin = (val, name, extra = {}) => h('input', { class: 'input', dir: 'auto', value: val || '', 'data-id': id + '.' + name, ...extra });
  const tarea = (val, name, rows = 5) => { const a = h('textarea', { class: 'input mp-farea', dir: 'auto', rows, 'data-id': id + '.' + name }); a.value = val || ''; return a; };
  const cards = (p.contactCards || []).map(c => ({ ...c }));
  let body = [], collect;
  if (key === 'summary') {
    const own = cards.find(c => c.role === 'person');
    const f = { name: tin(p.name, 'name'), age: tin(p.age, 'age', { inputmode: 'numeric' }), city: tin(p.city, 'city'), occupation: tin(p.occupation, 'occupation'),
      phone: tin(own?.number, 'phone', { type: 'tel' }), email: tin(own?.email, 'email', { type: 'email' }) };
    body = [row('Name', f.name), h('div', { class: 'mp-fgrid' }, row('Age', f.age), row('City', f.city)), row('Occupation', f.occupation),
      h('div', { class: 'mp-fgrid' }, row('Their phone', f.phone), row('Their email', f.email))];
    collect = () => {
      const number = store.cleanPhone(t(f.phone.value)), email = t(f.email.value);
      let next = cards;
      if (own) next = cards.map(c => c === own ? { ...c, number, email } : c).filter(c => c.role !== 'person' || c.number || c.email || c.name || c.contactId);
      else if (number || email) next = [{ id: store.newId('k'), role: 'person', name: '', number, email, contactId: null }, ...cards];
      return { name: t(f.name.value).replace(/\s+/g, ' '), age: t(f.age.value), city: t(f.city.value), occupation: t(f.occupation.value), contactCards: next };
    };
  } else if (key === 'about' || key === 'looking') {
    const a = tarea(p[key], key, 6); body = [a]; collect = () => ({ [key]: a.value.trim() });
  } else if (key === 'contacts') {
    const list = h('div', { class: 'mp-frefs' });
    const others = cards.filter(c => c.role !== 'person');
    const roles = store.PHONE_ROLES.filter(r => r[0] !== 'person');
    const paint = () => {
      list.innerHTML = '';
      others.forEach((c, i) => {
        const role = h('select', { class: 'input', 'aria-label': 'Whose number', 'data-id': id + '.role', onChange: (e) => { c.role = e.target.value; } },
          roles.map(([v, l]) => h('option', { value: v, selected: v === c.role || null }, l)));
        list.append(h('div', { class: 'mp-fref', 'data-id': id + '.contact' },
          h('div', { class: 'mp-fgrid' }, role, tin(c.name, 'name', { placeholder: 'Name', 'aria-label': 'Name', onInput: (e) => { c.name = e.target.value; } })),
          h('div', { class: 'mp-fgrid' }, tin(c.number, 'number', { type: 'tel', placeholder: 'Phone', 'aria-label': 'Phone', onInput: (e) => { c.number = e.target.value; } }),
            tin(c.email, 'email', { type: 'email', placeholder: 'Email', 'aria-label': 'Email', onInput: (e) => { c.email = e.target.value; } })),
          h('button', { type: 'button', class: 'linkish danger-text', 'data-id': id + '.remove', onClick: () => { others.splice(i, 1); paint(); } }, 'Remove')));
      });
    };
    paint();
    body = [list, h('button', { type: 'button', class: 'btn small', 'data-id': id + '.add', onClick: () => { others.push({ id: store.newId('k'), role: 'shadchan', name: '', number: '', email: '', contactId: null }); paint(); list.querySelector('.mp-fref:last-child input')?.focus(); } }, 'Add a number'),
      h('p', { class: 'note' }, 'Their own phone and email are changed with the pencil next to the name.')];
    collect = () => ({ contactCards: [...cards.filter(c => c.role === 'person'),
      ...others.filter(c => t(c.number) || t(c.name) || t(c.email) || c.contactId).map(c => ({ ...c, name: t(c.name), number: store.cleanPhone(t(c.number)), email: t(c.email) }))] });
  } else if (key === 'known') {
    let know = [...(p.know || [])];
    const wrap = h('div', {});
    const paint = () => { wrap.innerHTML = ''; wrap.append(bubbles({ options: [...KNOW_CONTACT, ...KNOW_FLAGS].map(v => [v, v]), selected: know, multi: true, dataId: id + '.know', onChange: (v) => {
      const added = v.find(x => KNOW_CONTACT.includes(x) && !know.includes(x)); // only one of Never spoke / Talked / Met
      know = added ? v.filter(x => !KNOW_CONTACT.includes(x) || x === added) : v; if (added) paint();
    } })); };
    paint();
    const years = tin(p.yearsKnown, 'years', { type: 'number', min: 0, max: 99, inputmode: 'numeric' }), how = tarea(p.howKnow, 'how', 3);
    body = [wrap, row('Years known', years), row('How do you know them?', how)];
    collect = () => ({ know, yearsKnown: t(years.value), howKnow: how.value.trim() });
  }
  const close = () => { SEC = null; redraw(); };
  const form = h('div', { class: 'mp-form', 'data-id': id },
    h('div', { class: 'mp-inline-actions mp-form-bar', 'data-id': id + '.bar' }, h('span', { class: 'mp-form-bar-label' }, 'Editing'),
      h('button', { type: 'button', class: 'btn small', 'data-id': id + '.cancel', onClick: close }, 'Cancel'),
      h('button', { type: 'button', class: 'btn small primary', 'data-id': id + '.save', onClick: async () => {
        const patch = collect();
        if (key === 'summary' && !patch.name && !(patch.contactCards || []).some(c => c.role === 'person' && c.number)) { toast('Write a name or their own phone number first'); return; }
        await savePerson(patch); close();
      } }, 'Save')),
    ...body);
  setTimeout(() => form.querySelector('input,textarea,select')?.focus({ preventScroll: true }), 30);
  return form;
}

// ---------- Ideas status strip (owner request): one tap per step; both yes → Shidduchim ----------
function movedToast(o) {
  toast('Both said yes. Moved to Shidduchim → Offers', 5000, { label: 'Open', run: () => navigate(`/shidduchim/${encodeURIComponent(o.id)}`) });
}
function statusStrip(b) {
  const p = b.p, P = pron(p), l = latestByPerson(b.ints).get(p.id) || {};
  const live = b.offers.filter(o => o.status !== 'ended'), endedOnly = !live.length && b.offers.length > 0;
  const st = ideaStatus(p, l, live.length > 0, endedOnly);
  const quick = (label, dataId, rec, primary) => h('button', { type: 'button', class: 'btn small' + (primary ? ' primary' : ''), 'data-id': dataId, onClick: async () => {
    const o = await recordInterest(p.id, rec);
    if (o) movedToast(o); else toast('Saved');
  } }, label);
  const strip = (...kids) => h('div', { class: 'pc-status pc-status-' + st.key, 'data-id': 'person-card.status' }, ...kids);
  const label = h('span', { class: 'pc-status-label' }, st.label);
  if (st.key === 'shidduch') {
    const o = live[0];
    return strip(h('a', { class: 'pc-status-link', href: `#/shidduchim/${encodeURIComponent(o.id)}`, 'data-id': 'person-card.status-open' }, label, h('span', { class: 'note' }, 'Open'), ico('chevron')));
  }
  if (st.key === 'closed') return strip(label, h('button', { type: 'button', class: 'btn small', 'data-id': 'person-card.status-reopen', onClick: async () => { await reopen(p.id, l, endedOnly); toast('Reopened'); } }, 'Reopen'));
  if (st.key === 'waiting') return strip(label, h('div', { class: 'pc-status-btns' },
    quick(`${P.He} said yes`, 'person-card.status-yes', { side: 'theirs', value: 'Yes, interested' }, true),
    quick(`${P.He} said no`, 'person-card.status-no', { side: 'theirs', value: 'No' }),
    quick('Not for me', 'person-card.status-pass', { side: 'mine', value: 'Not interested' })));
  return strip(label, h('div', { class: 'pc-status-btns' },
    quick('I’m interested', 'person-card.status-interested', { side: 'mine', value: 'Interested' }, true),
    quick(`${P.He} is not interested`, 'person-card.status-no', { side: 'theirs', value: 'No' }),
    quick('Not for me', 'person-card.status-pass', { side: 'mine', value: 'Not interested' })));
}
