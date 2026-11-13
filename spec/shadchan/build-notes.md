# Shadchan Mode — build notes (for whoever builds S4 to S7)

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
`pages/singles.css` (all Shadchan Mode page CSS), `pages/sh-shidduchim.js` (the list),
`pages/sh-shidduch-detail.js` (one shidduch), `pages/sh-shidduch-data.js` (records and every change),
`pages/sh-shidduch-parts.js` (bar, End sheet, New idea sheet, the card's Shidduchim tab),
`pages/deleted.js`, `js/seed-shadchan.js`.

Routes in Shadchan Mode: `/home`, `/guys`, `/girls`, `/shidduchim`, `/shidduchim/:id(/dates|/history)`, `/contacts…`, `/settings`,
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
| `statusBy` | id of the shidduch that set Busy / Engaged by itself (S3). Empty = the shadchan chose the status by hand |

**Contacts**: same record as Single Mode. Default roles here: parent, shadchan, reference, rav, other.

**Shidduch**: built in S3; the shapes are in section 7. `pages/shidduch-data.js` (Single Mode: "me and one
person") is not used for these records; only its look (bar, lanes, bubbles, `shidduchim.css`) is shared.

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
for the backup reminder (S4). Since S6 the file can leave attachments out (`noFiles: true`; importing it never touches the
device's files) and is locked with a password by default (section 10).

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
- The open-shidduch dot (`singles.row-open`) reads `offers` through `isOpenShidduch()`: status `offer` or
  `progress`. An idea, an ended and an engaged shidduch do not count as open (S3).
- `pages/single-panel.js`: the Shadchan panel on the card's Profile tab. Busy by hand sets `busyUntil`
  and makes a follow-up. S3 sets Busy by itself while dating; keep `busyUntil` empty in that case.
- Add Person in Shadchan Mode asks "Looking for ages from … to …" (`minAge`, `maxAge`).

## 7. What S3 added (Shidduchim with two sides)

**Records** (all written only by `pages/sh-shidduch-data.js`):

| Store | Shape |
|---|---|
| `offers` | one per couple, ever: `{ guyId, girlId, guyName, girlName, status }`. `status` is `idea` · `offer` · `progress` · `engaged` · `ended`, rewritten on every change from the current try |
| `tries` | `{ offerId, guyId, girlId, n, phase, sides: { guy, girl }, refsChecked, endedBy, saidNo, endedReason, endedAt, told: { guy, girl }, engagedAt, startedAt }`. `phase` is `open` · `dating` · `engaged` · `ended` |
| a side | `{ answer, askedAt, answeredAt, toldBy }`; `answer` is `''` (not asked) · `asked` · `thinking` · `yes` · `no` |
| `dateEvents` | `{ tryId, offerId, n, when, where, status, sides: { guy, girl } }`; a side here also keeps `feedback` (private) |
| `stageEvents` | one history line: `{ tryId, offerId, text, source, eventAt, kind, at }` |

**Rules the code keeps**

- The lane is never typed. `laneOf(try)`: ended or engaged → Ended; dating → In Progress; any side asked → Offers;
  otherwise Ideas. Try Again starts a new try that is an idea again.
- The answers that matter now are those of the **round**: the offer, or the latest date that was not cancelled
  (`roundOf`). While that date is still ahead, nobody is asked anything and the bubbles are hidden.
- `nextStep(m)` gives the one "your move" / "waiting N days" of a shidduch. **S4 must build Home's "Your move" and
  "Waiting for them" from `loadAll()` + `m.step`**, not work it out again. An idea has no move (design rule 5).
- Tracking is a by-product: an answer after a date marks that date Happened; saving a new date marks both sides
  Yes, moves the shidduch to In Progress and sets both singles Busy (`statusBy`). Ending frees them again.
- No is never set directly: it goes through `endDialog` → `endTry`, which asks who already knows. Sides that were
  part of it and were not told give "Your move: tell …" (`needTelling`).
- Every change returns `{ undo }` (a snapshot of the offer, try, dates and the two singles' status). Undo erases
  what the change added with `store.discard()`, so it never lands in Recently deleted.
- Deleting: a single with a shidduch in Offers or In Progress cannot be deleted (`person-card.js`). Ideas and
  finished shidduchim are removed with the single in the same `asOne`. A shidduch can be deleted alone
  (`removeShidduch`); Restore calls `reapplyStatus` so a dating couple is Busy again.
- `createIdea(guyId, girlId)` and `pairOf` / `pairDetail` are ready for **Find a match (S5)**: one record per couple,
  and the text for "Already tried". "Not a fit" is not built yet (S5).
- **Send (S5)** replaces the "Mark his / her side asked" button: after "Yes, I sent it" call
  `setAnswer(m, side, 'asked')`.
- Lists never read history lines: `loadAll()` reads offers, tries and dates; `loadOne(id)` reads the rest by index.
- `singlesIndex()` now also returns `people` (a Map by id) and refreshes only the open-shidduch dots when `offers`
  change, so tapping an answer does not rebuild the search text of 3,000 singles.
- `Element.append(null)` writes the word "null" on the page. Use `h()` (it skips empty children) or `''`.

## 8. What S4 added (Home from blocks)

- `pages/sh-home.js`, loaded by `home.js` only in Shadchan Mode (top-level `await import`). home.js still draws Notes, Follow Ups and History;
  sh-home.js puts them, with To do / At a glance / My singles, into `home.blocks` in the saved order (`shHomeBlocks` pref, `layout()`).
  Block wrappers are made once and only re-ordered when the layout changes, so typing in a note never loses focus.
- To do = `m.step` from `loadAll()`: `move` rows (ask / date / tell buttons) and `wait` rows (Remind, Got an answer). No rules are repeated.
- Got an answer calls `setAnswer`; No goes through `endDialog`. Remind never records anything.
- `searchShidduchim(SH, has)` feeds Home search. `editHome()` is also used by Settings.
- S5: “No open shidduch” rows should open Find a match instead of the card; Send replaces “Mark … asked” in Your move too.

## 9. What S5 added (Find a match and Send)

- `pages/sh-match.js`, route `/match/:id`. Reads `loadAll()` (pairs) + `singlesIndex()` + `applyFilters()`; filters per single in memory,
  starting from `minAge`/`maxAge` and Available. Groups: fresh, Age not recorded, Already tried (an `offers` record exists), Not a fit.
- **Not a fit** is kept on both singles: `notFit: { [otherId]: { reason, at } }` (`singles-data.js` `notFitOf`, `setNotFit(a, b, reason | null)`).
  Saved with `saveMany` so `updatedAt` is kept and Guys / Girls order does not change. `ageNotes(a, b)` gives the age-mismatch notes.
- `pages/sh-send.js` `sendSheet(m, side)`: `side` is the side being asked; the profile sent is the other single's. Ticks are the
  `shSendTicks` pref. After “Yes, I sent it” it calls `setAnswer(m, side, 'asked', { note })`; `note` is a history line (`kind: 'sent'`)
  written before the Asked line, and Undo removes both. Send buttons replace Mark asked only in the offer round; after a date, Mark asked stays.
- `suggestedFor(p)` moved from `person-card.js` to `people-data.js` (shared by Single Mode's Short versions and Send). No change in Single Mode.

## 10. What S6 added (locked backup, size check)

- `js/backup.js`: `makeBackup({ password, files })`, `lock()`, `unlock()`, `isLocked()`. Locked file =
  `{ app, locked: 1, exportedAt, noFiles?, kdf: PBKDF2-SHA-256 310 000 rounds + salt, cipher: AES-GCM + iv, zip: 'gzip' | '', data }`
  (base64). The inside is the normal backup JSON, so `validateBackup` / `importAll` are unchanged. Nothing about the password is stored.
- `pages/backup-sheet.js`: `exportSheet()` (lock on by default, password twice, include files tick) and `importBackup(file)`
  (asks the password, then the old Replace / Merge questions). Used by Settings and by Home's backup reminder. Styles in `base.css`.
- `store.exportAll({ files })`, `store.fileCount()`. Locking needs `crypto.subtle`, i.e. the https address (or localhost).
- S6 size check: every page of both modes at 320 / 360 / 390 / 430 / 768 / 1280 px with the demo: no sideways scroll, no "null",
  no errors, no request outside the app's address.
- Address and the test round: `test-round.md` (owner decisions). S7 sync must read and write the same backup JSON (locked) as its unit.

## 11. What S7 added (phone and computer in step, by file)

- Owner decision: **nothing online for now** (no Dropbox, no mailbox). Devices stay in step by moving the backup file.
- `store.importAll(json, 'merge')` now keeps, for each record on both sides, the copy with the later `updatedAt` (the backup's copy wins on a tie
  or when neither has one). Returns `{ total, keptHere }`. Shadchan Mode deletes are marks with a newer `updatedAt`, so they carry over;
  Single Mode still erases at once, so its deletes do not carry over. `setMeta` now stamps `updatedAt` so choices and categories merge the same way.
- Settings → Backup has the how-to (`settings.in-step`). Merge texts in `backup-sheet.js` say "changed last wins".
- Known limits: something erased for good (Delete forever, 30-day clean-up, Undo of a new record) can come back from an older file of the other device,
  as a deleted item. Settings (prefs) still come from the file. A later online way only has to move the same file and call Merge.
