# Shadchan Mode — build notes (for whoever builds S2 to S7)

Read this before any Shadchan Mode stage. It says how S1 was built and what the later stages
must keep to. The owner-facing design is `design.md`; this file is for the code.

## 1. How the two modes live together

- `app/js/mode.js` — `MODE`, `isShadchan`, `switchMode()`. The mode is a device setting
  (`mode` in `zugdesk.prefs`). **Switching reloads the app**, so the mode never changes while a page
  is open. Every module may read `isShadchan` as a constant.
- `app/js/db.js` — two IndexedDB databases: `zugdesk` (Single Mode, untouched) and
  `zugdesk-shadchan`. Same store names in both, so shared pages work on either.
- `app/js/store.js` — binds every collection to the database of the current mode. Pages keep
  importing `store` as before. Only `exportAll`, `importAll` and `resetAll` touch both databases.
- `app/js/app.js` — bottom bar, page titles and routes per mode.
- Shared pages (Home, Contacts, Add Person, person card, Settings) are **one file for both modes**.
  Where they must differ they branch on `isShadchan`, in as few lines as possible.
  A Single Mode file is changed only to make it shareable, never to change what Single Mode does.

Shadchan-only files: `pages/singles.js` (Guys and Girls), `pages/singles-data.js`,
`pages/singles.css` (all Shadchan Mode page CSS), `pages/sh-shidduchim.js` (placeholder until S3),
`pages/deleted.js`, `js/seed-shadchan.js`.

Routes in Shadchan Mode: `/home`, `/guys`, `/girls`, `/shidduchim`, `/contacts…`, `/settings`,
`/deleted`, and the shared `/people/new…`, `/people/:id…` (Add Person and the single's card).
`/people` alone redirects to Guys or Girls. `/profile` does not exist.

## 2. Records

A **single** is a `people` record: exactly what Add Person saves, plus these fields
(all optional; the form keeps unknown fields when it saves, so nothing is lost):

| Field | Meaning |
|---|---|
| `kind` | `'guy'` or `'girl'` (indexed) |
| `status` | `available` · `busy` · `engaged` · `paused` · `not-relevant`. Missing = available. Words live in `singles-data.js` |
| `busyUntil` | date, when Busy was set by hand ("check again on …") |
| `starred` | `true` = "Working on" |
| `minAge`, `maxAge` | "looking for" age range as text. `maxAge` already existed ("Up to age") |
| `talkTo` | id of one of the single's `contactCards` (parent, the single, or another shadchan) |
| `confirmedAt` | date the single last confirmed they are still looking |

**Contacts**: same record as Single Mode. Default roles here: parent, shadchan, reference, rav, other.

**Shidduch (to build in S3)**: `offers` has indexes `guyId`, `girlId`, `status` (and `tries` has `offerId`).
Proposed shape, to be settled in S3:
`offers { guyId, girlId, status: 'idea'|'offer'|'progress'|'ended', … }`,
`tries { offerId, n, sides: { guy: { answer, askedAt, answeredAt, toldBy }, girl: { … } }, toldOtherSide, … }`.
Do not reuse `pages/shidduch-data.js` for the records: it assumes "me and one person".
Its look (bar, lanes, bubbles) can be copied.

## 3. Recently deleted (nothing is hard-deleted)

In Shadchan Mode `store.<collection>.remove(id)` only marks the record (`deletedAt`, `deletedBatch`).
`list / get / byIndex / count` never return marked records, so pages need no special code.

- Deleting one thing with its parts: wrap it in `store.asOne(async () => { … })`. It then shows as
  one line in Recently deleted and is restored whole.
- Taking a link off a record that stays (a conversation shared with someone else):
  `store.unlink(collection, record, field, id)`. Restore puts the link back.
- `store.listDeleted()`, `restoreDeleted(batch)`, `eraseDeleted(batch)`; `purgeExpired()` runs when
  the app opens (30 days, `KEEP_DELETED_DAYS`).
- Never call `idb` directly from a page. Never read a whole store just to count or to find deleted
  things: every store has `deletedAt` and `unlinkedIn` indexes for that.
- **S3 must** stop a single being deleted while a shidduch points at them, or delete the shidduch
  in the same `asOne` (the Single Mode guard in `person-card.js` looks at `personId`, which is not
  used here).

## 4. Backup

One file: `{ app, schemaVersion, prefs, data: <Single Mode>, shadchan: { schemaVersion, data } }`.
A backup from before Shadchan Mode has no `shadchan` part: importing it leaves Shadchan Mode alone.
The mode itself is never taken from a backup. `store.lastBackupAt()` / `noteBackupMade()` are ready
for the backup reminder (S4). Attachments are still inside the same file: splitting them out and
locking the file with a password is S6.

## 5. Rules that came out of S1

- No outside services. Fonts are in `app/fonts` (`css/fonts.css`). The service worker ignores
  anything that is not from the app's own address.
- New page: add it to `SHELL` in `sw.js` and bump `CACHE`.
- New pages keep their words in one `T = { … }` object at the top of the file.
- Scale target is 3,000 singles. `singles.js` draws 60 rows and has "Show more"; S2 replaces that
  with loading on scroll and one in-memory search index. Avoid `store.attachments.list()` (it reads
  every file into memory); use `byIndex('personId', id)`.
- The person card hides Single Mode's "Short versions" tab and the interest buttons in Shadchan Mode.
  `p.shortVersions` still exists on the record; S5 (Send) can offer it as the short profile text.
- Home's "Review X's answer" suggestion is off in Shadchan Mode (`home-data.js`); S3/S4 bring the
  two-sided version.
- Checks: `TESTS.md`, section "Shadchan Mode".

## 6. What S2 added (for S3 onwards)

- `singles-data.js` → `singlesIndex()`: one in-memory index of all singles (fields, answers, contact
  cards, pasted originals, open-shidduch flag). It rebuilds by itself when `people`, `sources` or
  `offers` change. Find a match (S5) should reuse it with `applyFilters()` instead of reading the store.
- The open-shidduch dot (`singles.row-open`) reads `offers` with `status !== 'ended'` and `guyId` / `girlId`.
  S3 only has to save offers in that shape for the dot to appear.
- `pages/single-panel.js`: the Shadchan panel on the card's Profile tab. Busy by hand sets `busyUntil`
  and makes a follow-up. S3 sets Busy by itself while dating; keep `busyUntil` empty in that case.
- Add Person in Shadchan Mode asks "Looking for ages from … to …" (`minAge`, `maxAge`).
