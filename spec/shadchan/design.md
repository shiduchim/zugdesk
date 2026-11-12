# Shadchan Mode — design proposal (draft 2)

Status: **proposal, revised after the owner's answers on 12 Nov 2026** (section 11). Nothing is built.
Based on `spec/shadchan/research.md` (26 survey answers) and three checks done on 12 Nov 2026:
what already exists for shadchanim, how to keep phone and computer in step, and internet filters.
Screen sketches: `spec/shadchan/screens.html`.

M1–M9 and N1–N8 below are the must-haves and nice-to-haves from the research file.

## 1. The idea in one paragraph

Shadchan Mode is a second mode inside the same ZugDesk app, switched on in Settings. It has the
same dark, compact look and keeps Home's notes, follow-ups and history. On top of that it adds
what a shadchan needs: Guys and Girls lists that take a profile by paste, one card per shidduch
showing both sides' answers, and an automatic list of whom to chase. Everything stays on the
user's own devices; there is no account and no server that can read it.

## 2. What the checks found (and what it changes)

**What already exists** (from search results only; the product sites could not be opened from here)
- Tools for shadchanim exist and are **free**: Shadchan Pro, Strike The Match, an Airtable template, and shadchan logins on sites such as SawYouAtSinai and ChabadMatch.
- They are mostly **databases of singles**: list, tags, search, stored resume, notes. All keep the data on their own servers.
- **Nobody covers well:** one shadchan's own pipeline (who was suggested to whom, each side's answer, who is waiting), follow-up reminders, getting a resume in with little typing, and data that stays on the shadchan's own device.
- Those four gaps are the same four things the survey put on top. That is where this app should be clearly better; a plain list of singles is not enough to make anyone switch.
- Price: a paid app would be compared with free ones. Plan for free.

**Phone and computer in step**
- No option is both automatic and free of outside accounts. The choices, simplest first:
  1. **A locked backup file** the shadchan moves between devices. Works everywhere, costs nothing, nothing to run. Manual each time.
  2. **Dropbox** (the shadchan's own): connects once and then stays in step by itself. Needs a Dropbox account.
  3. **Google Drive** (the shadchan's own): works, but asks to approve again about every hour. Unconfirmed on iPhone.
  4. **A small locked mailbox of our own**: holds only scrambled data, pairs devices with a code, no account. It is a server: small, but someone must look after it.
- Decision: build 1 first (it is also the disaster backup). Choose between 2 and 4 after the test round, when we know which filters and which cloud accounts real testers have.

**Internet filters**
- NetFree opens sites one address at a time after a human check. A shared address like `github.io` is the risky kind; an own address is safer.
- Every outside service is one more thing a filter can block: Google Fonts, script libraries from other sites, Google or Dropbox sign-in.
- Phones with no browser (calls only, or WhatsApp only) cannot open any web app. Those shadchanim would use a computer.
- Most filter details are unconfirmed (NetFree's own pages could not be opened). A test with one NetFree user and one TAG user is needed before promising anything.

## 3. Design rules

1. **Tracking is a by-product.** The shadchan never fills in a tracker. Sending a profile from the app records that the side was asked; tapping an answer moves the card. (M2, M3, M8)
2. **Paste, don't type.** A profile is saved in seconds as it arrived. Fields can be filled later, or never; every word of the original is still searchable. (M1, M5)
3. **The app narrows, the shadchan decides.** Filters and warnings, no scores, no automatic matches. (M4, N5)
4. **Unknown is unknown.** A single with no age recorded is shown apart as "age not recorded", never hidden and never guessed. (Same rule as Single Mode.)
5. **Assume nothing about order or custom.** The app never suggests which side to ask first, and never decides what goes into a message. (Owner's answers 1 and 2.)
6. **Private by construction.** No account, no server of ours with readable data. Sharing is always a deliberate step with an exact preview. (M7)
7. **Nothing is lost.** Deleted things wait 30 days in "Recently deleted"; the app reminds about backups. (M9)
8. **Phone and computer are equals.** Every page is designed for both from the start. (M6)
9. **Same look as Single Mode.** Same tokens, dark by default, same compact cards, same slim bottom bar. No new theme.
10. **One address, no outside services.** Fonts and scripts are served by the app itself. (N7)

## 4. Words on the screen

These are the names on buttons and titles. They follow Single Mode where a word already exists.

| Word | Meaning |
|---|---|
| **Guys / Girls** | The singles, one list each (each a bottom-bar tab) |
| **Working on** | The singles I am actively working for (a star). The rest are "on file". The filter chips are "Working on" and "All". |
| **Shidduchim** | One guy and one girl, with everything that happened between them (same word as in Single Mode) |
| **Idea** | A shidduch only I know about. Nobody was asked yet. |
| **Talk to** | The person I actually talk to about a single: the single, a parent, or another shadchan |
| **Contacts** | Everyone I talk to who is not a single: parents, other shadchanim, references, rabbanim |
| **To file** | Profiles saved as they arrived, not yet opened |
| **Engaged** | The couple agreed to marry (vort / l'chaim). The wedding comes later; "Married" can be added after it. |

## 5. The two modes

- **One app, one link, one icon.** Settings has a new row: **Mode: Single · Shadchan**. One tap switches; the app remembers the choice and opens in it next time.
- **Each mode keeps its own data.** A shadchan's hundreds of singles never show up in Single Mode's Ideas, and Single Mode's notes never show up in Shadchan Mode. Switching back shows everything exactly as it was.
- **One backup file holds both modes.** Settings → Export saves everything; Import puts both back.
- **The bottom bar changes with the mode:**
  - Single Mode (as today): Home · Contacts · Ideas · Shidduchim · My Profile
  - Shadchan Mode: **Home · Guys · Girls · Shidduchim · Contacts**
  - Both have five places, so the bar looks the same. Guys and Girls get a small word under the icon, because two person icons are hard to tell apart.
- A small mode name sits next to the gear on Home ("Shadchan"), so it is always clear which mode is open.

## 6. The five places (Shadchan Mode)

### 6.1 Home (Single Mode's Home, with automatic follow-ups)
Same page as in Single Mode: search, New Note with smart suggestions, and the three tabs.

- **Notes**: exactly as today. Pinned and other notes, colours, links to singles and contacts, dated updates.
- **Follow Ups**: today's hand-made follow-ups, with two automatic groups above them, worked out from the shidduch cards:
  - **Your move**:
    - One side said Yes and the other was not asked yet: "Suggest Yehuda to Chana's side".
    - Both said Yes: "Arrange Date 1".
    - A date's time has passed: "Ask how Date 2 went".
    - One side said No and the other side has not been told: "Tell Mrs. Stern". (Singles complain most about the No that never arrives.)
  - **Waiting for them**: who was asked and has not answered, oldest first, with the number of days. Two buttons: *Remind* (opens WhatsApp or copies a short message) and *Got an answer*.
  - **My follow-ups**: the hand-made ones, exactly as today (circle to complete, Undo, add to the phone's calendar).
- **History**: exactly as today; every answer, send and date shows here.
- Two lines that are new on this page:
  - **No open shidduch**: my starred singles for whom nothing is moving right now. Tap one to open Find a match. (For "I am behind".)
  - **Backup reminder**: a quiet line when the last backup is older than two weeks.
- Search at the top finds anything: singles, contacts, shidduchim, notes, and the words inside pasted profiles. (M1)

### 6.2 Guys and 6.3 Girls (the same page, one per tab)
- Count, **Working on / All** chips, search by any word. Filters: age from–to, city, background, languages, status. Filters show as removable tags, as in Contacts. (M1, M4)
- Row: name, age, city, one line, status, and a small mark if a shidduch is open.
- **Add**: paste text, or attach a PDF / Word file / photo. On an Android phone with the app installed, WhatsApp's own Share button can send a profile straight into the app (to be confirmed at build time). On iPhone: copy, then tap Paste.
- **To file (n)**: the pile of saved-as-arrived profiles. Open one and the original sits beside the form, as in Add Person today.
- If the same person arrives again: Open existing / Add as updated version / Save as new (exists today).

**A single's card** (the person card from Single Mode)
- Tabs: Profile · Shidduchim · Notes.
- **Status**: Available · Busy · Engaged · Paused · Not relevant. The list can be changed later.
  - Busy is set by itself while a shidduch is dating.
  - Busy can also be set by hand ("busy elsewhere, check again on …"), which makes a follow-up.
- "Looking for" gets two plain fields the filters can use: age from–to. Everything else stays free text.
- **Talk to**: the single, a parent, or another shadchan, chosen from the single's contact cards. Home and Send use it.
- "Last confirmed looking: 3 months ago" in small text, so stale profiles are visible.
- Button: **Find a match**.

**Find a match** (the "Make Match" that Single Mode left open)
- Top: the single in three lines, with what they are looking for.
- Below: singles of the other kind, already narrowed by what is recorded (age range, Available). Filters can be changed with chips.
- Each row says what already happened between these two: nothing, **Idea**, or **"Suggested Mar 2026 · her side said No"**. Already-tried pairs sink to the bottom under "Already tried (3)". (N1, comes free)
- A short note where a stated wish does not fit, shown and not hidden: "He is 31 · she asked up to 30".
- "Age not recorded (12)" is a separate group.
- Tap a row: both profiles side by side (stacked on a phone), then **Save as idea** or **Not a fit** (remembered, with an optional reason, so the pair is not looked at twice).

### 6.4 Shidduchim (Single Mode's Shidduchim, with two sides)
- Lanes: **Ideas · Offers · In Progress · Ended**, with counts. Offers, In Progress and Ended work as in Single Mode; Ideas is new.
- Compact / Expanded cards as today.
- Card: "Yehuda Stern – Chana Levy", two answer bubbles (his side, her side), the progress bar, and days waiting.
- An answer bubble opens the floating panel: **Not asked · Asked · Thinking · Yes · No**. Every change offers Undo. No asks who said it and, optionally, why.
- Search and filter by single, by contact, by lane.

**A shidduch's page** (the details page from Single Mode)
- Progress bar: Offer · References · Date 1–8 · Engaged.
- **Overview**: a "your move" line; two side cards (the single, whom I talk to, the answer and its date, who told me); references; recent history; Add note.
- **Dates**: when, where, status. After each date the same two bubbles come back: his answer, her answer, each with private feedback. This is how "waiting for her answer after Date 2" reaches Home without typing.
- **History**: one shared record, as today. Try Again after Ended keeps the old try.
- **Suggest to his side / her side**: opens the Send sheet (6.6).
- Ending: who ended it, optional reason, and a tick for "the other side was told".

### 6.5 Contacts
- The Contacts page from Single Mode, almost unchanged. Here it holds everyone who is not a single: parents, other shadchanim who send profiles, references, rabbanim.
- Roles: Parent, Shadchan, Reference, Rav, Other.
- A contact's page lists the singles they speak for and the shidduchim they are part of.
- Why it is a bottom tab: profiles often arrive from other shadchanim, and "who sent me this, and what else did they send?" is a daily question.

### 6.6 Send (the share sheet from My Profile)
- **The shadchan chooses what goes in, every time.** The choices:
  - short profile text
  - the resume file
  - references and phone numbers
  - photo, if there is one
- **The default is whatever was ticked last time.** Nothing is ticked on the very first send. (Owner's answer 1: it depends.)
- Recipient: the side's "Talk to" person, changeable.
- Shows the exact message before anything leaves. Copy / WhatsApp / Email / More.
- **After "Yes, I sent it":** the side becomes **Asked · today**, the line goes into History, and the wait starts counting on Home. It never claims the message was delivered or read.

## 7. Privacy and safety, as the shadchan will read it

- "Everything you write stays on this device. There is no account and no server, so nobody else can see it, including us."
- Optional lock when the app opens (a screen lock for shared family computers; described as that, not as encryption).
- The backup file is locked with a password the shadchan chooses. The app says clearly: a forgotten password cannot be recovered.
- Deleted items wait 30 days in Recently deleted.
- The app asks the browser to keep its storage permanently (today it does not ask; some phones clear data of unused sites).
- Demo data is fictional and marked, as today.

## 8. How it is built on Single Mode

**Shape:** one app, one link. A mode setting chooses the bottom bar, the pages and the database. Single Mode's behaviour does not change.

| Piece | Plan |
|---|---|
| App shell, tokens, dark theme, labels, Settings, demo loader | Shared; Settings gains the Mode row |
| Home: notes, smart suggestions, follow-ups, history | Shared; Shadchan Mode adds the automatic groups and two lines |
| Contacts, Add Shadchan / Edit contact, folders | Shared; role names extended |
| Add Person: Paste / Basic / Detailed, categories and choices, originals, duplicate check | Shared; two new fields (age from–to) |
| Person card | Shared; "Offers" tab becomes "Shidduchim"; status and "Talk to" added |
| Share sheet | Shared; sends a single's profile instead of mine |
| Shidduchim list and details | Same look and parts (bar, lanes, bubbles, dates, history). **New data module**, because here a shidduch is guy + girl; in Single Mode it is me + one person |
| Backup (Export / Import) | Shared; one file holds both modes |
| My Profile, Ideas | Single Mode only |
| **New** | Mode switch, Guys and Girls lists at scale with filters, Find a match, Asked state, "other side was told", Recently deleted, backup reminder, locked backup |

**Rules for the build**
- A Single Mode file is changed only to make a piece shareable, never to change what it does. The `TESTS.md` checks run after every such change.
- Data: Shadchan Mode has its own IndexedDB database next to Single Mode's. Its `offers` hold `guyId` and `girlId`; each try holds an answer per side with the date it was asked and answered. Everything else keeps today's record shapes.
- **Ready for sync from day one:**
  - Nothing is hard-deleted: a deleted mark and date instead.
  - Every record keeps its "last changed" time (already true).
  - Ids are random (already true).
  - Attachments are stored and backed up apart from the records. Today they sit inside one backup file, which gets too large with hundreds of resumes.
- **Scale:**
  - Lists draw the first 60 rows and add more on scroll.
  - Search runs over one in-memory text index.
  - Target: 3,000 singles without a visible wait on a mid-range phone.
- Fonts move into the app (today they come from Google Fonts).
- New pages keep their words in one place per page, so Hebrew and Russian can be added later without touching the code. (N6)
- Every new element gets a `data-id` label; no plus signs; all colours and sizes from tokens. (CLAUDE.md rules.)

## 9. Address (left open by the owner)

Real data lives in the browser under the app's address. Changing the address later means every user has to move their data by backup file. This does not block building. **It must be decided before the first real shadchan types real data** (before the test round in S6).

## 10. What Shadchan Mode will not do (first version)

- No accounts, no shared database between shadchanim, no singles logging in. (0 of 26 asked for working together.)
- No automatic matching or scoring.
- No reading of text inside PDFs and photos. The file is kept and shown; searchable words come from pasted text and typed fields. (Worth its own experiment later, like the filing lab.)
- No reminders while the app is closed. A follow-up can be added to the phone's calendar instead (exists today).
- No fee tracking, no chat.

## 11. Owner's answers (12 Nov 2026)

| # | Question | Answer | What changed |
|---|---|---|---|
| 1 | What goes into the first message to a side | Depends; can be either | Send asks every time; remembers the last choice (6.6) |
| 2 | Who is asked first | Assume nothing | Rule 5 |
| 3 | Own address | Skip for now | Left open (section 9) |
| 4 | One link or two | Be able to switch modes | One app with a Mode switch (section 5) |
| 5 | Words | Not clear | Words now follow Single Mode: Shidduchim, Home; "Talk to" instead of "Speaks for" (section 4) |
| 6 | Status list | Can change later; asked what Engaged means | Explained in section 4 |
| 7 | Test round | Maybe | Kept in S6; more important now (see below) |
| — | Notes, reminders and history as in Single Mode | Yes | Home kept whole (6.1) |
| — | Guys and Girls as separate bottom tabs | Yes | Bottom bar (section 5) |
| — | Same dark, compact Claude look | Yes | Rule 9 |

The owner is not a shadchan. So before the largest stage (S3), 2–3 shadchanim should look at
the sketches and say what is wrong. This costs nothing and can save a lot of rework.

## 12. Stages (to go into ROADMAP.md after approval)

| Stage | What | Model |
|---|---|---|
| S0 | Owner: show the sketches to 2–3 shadchanim; five short conversations if possible (questions at the end of research.md) | — |
| S1 | Foundation: Mode switch in Settings, Shadchan Mode's own database and bottom bar, shared pieces wired, fonts inside the app, permanent storage, Recently deleted, 60 fictional singles | Fable |
| S2 | Guys and Girls: lists at scale, search everything, filters, Add and To file, single's card with status and Talk to | Opus |
| S3 | Shidduchim: Ideas to Ended, answers per side, lanes, details, dates with both sides' answers, history, already-tried warning | Fable |
| S4 | Home: automatic follow-ups (Your move, Waiting for them), No open shidduch, backup reminder | Opus |
| S5 | Find a match and Send | Opus |
| S6 | Check everything together at phone and computer sizes; locked backup file; decide the address; test round with 3–5 shadchanim on one device each | Opus |
| S7 | Phone and computer in step (Dropbox or own locked mailbox, chosen from S6) | Fable |
| Later | Early-checks checklist (N2), reading PDFs and photos, Hebrew and Russian screens, bringing in Excel files (N3) | — |

## 13. Risks

- **One device only until S7.** 15 of 25 use phone and computer equally. Testers must pick one device for the test round, or move the backup file by hand.
- **Filters are mostly unverified.** One real test each on NetFree and TAG before inviting those users.
- **iPhone** has the weakest support for installed web apps (sharing into the app, cloud sign-in). Needs the owner's phone or a tester's at S2 and S7.
- **Thin research, and the owner is not a shadchan.** 26 answers, 12 short texts. Shadchanim looking at the sketches (S0) is cheap insurance before S3.
- **Losing a device loses the data** until backups are a habit. Hence the reminder and the locked file in the first test round.
- **The mode switch touches the app shell.** S1 must run every Single Mode check in `TESTS.md` to prove nothing changed there.
