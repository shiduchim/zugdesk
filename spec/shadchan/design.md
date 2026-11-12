# Shadchan Mode — design proposal (draft 1)

Status: **proposal, waiting for the owner's answers** (section 12). Nothing is built.
Based on `spec/shadchan/research.md` (26 survey answers) and three checks done on 12 Nov 2026:
what already exists for shadchanim, how to keep phone and computer in step, and internet filters.
Screen sketches: `spec/shadchan/screens.html`.

M1–M9 and N1–N8 below are the must-haves and nice-to-haves from the research file.

## 1. The idea in one paragraph

A private desk for one shadchan. Profiles come in by paste, not typing. Every suggestion has one
card that shows both sides' answers. The list of whom to chase writes itself from those cards.
Everything stays on the shadchan's own devices; there is no account and no server that can read it.

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
- NetFree opens sites one address at a time after a human check. A shared address like `github.io` is the risky kind; **an own address is safer**.
- Every outside service is one more thing a filter can block: Google Fonts, script libraries from other sites, Google or Dropbox sign-in.
- Phones with no browser (calls only, or WhatsApp only) cannot open any web app. Those shadchanim would use a computer.
- Most filter details are unconfirmed (NetFree's own pages could not be opened). A test with one NetFree user and one TAG user is needed before promising anything.

## 3. Design rules

1. **Tracking is a by-product.** The shadchan never fills in a tracker. Sending a profile from the app records that the side was asked; tapping an answer moves the card. (M2, M3, M8)
2. **Paste, don't type.** A profile is saved in seconds as it arrived. Fields can be filled later, or never; every word of the original is still searchable. (M1, M5)
3. **The app narrows, the shadchan decides.** Filters and warnings, no scores, no automatic matches. (M4, N5)
4. **Unknown is unknown.** A single with no age recorded is shown apart as "age not recorded", never hidden and never guessed. (Same rule as Single Mode.)
5. **Private by construction.** No account, no server of ours with readable data. Sharing is always a deliberate step with an exact preview. (M7)
6. **Nothing is lost.** Deleted things wait 30 days in "Recently deleted"; the app reminds about backups. (M9)
7. **Phone and computer are equals.** Every page is designed for both from the start. (M6)
8. **One address, no outside services.** Fonts and scripts are served by the app itself. (N7)

## 4. Words on the screen

| Word | Meaning |
|---|---|
| **Single** | A person with a profile: Guy or Girl (same record as "person" in Single Mode) |
| **My singles** | The singles I am actively working for (a star). The rest are "on file". |
| **Contact** | Anyone I talk to: a parent, a reference, another shadchan, a rav |
| **Speaks for** | The person I actually talk to about a single: the single, a parent, or another shadchan |
| **Suggestion** | One guy and one girl, with everything that happened between them |
| **Idea** | A suggestion only I know about. Nobody was asked yet. |
| **To file** | Profiles saved as they arrived, not yet opened |

## 5. The four places (bottom bar)

### 5.1 Today
The answer to "what should I do now?". All of it is worked out from the suggestion cards.

- **Your move**
  - One side said Yes, the other was not asked yet: "Suggest Yehuda to Chana's side".
  - Both said Yes: "Arrange Date 1".
  - A date's time has passed: "Ask how Date 2 went".
  - One side said No and the other side has not been told: "Tell Mrs. Stern". (Singles complain most about the No that never arrives.)
  - Follow-ups the shadchan set by hand.
- **Waiting for them**: who was asked and has not answered, oldest first, with the number of days. Two buttons: *Remind* (opens WhatsApp or copies a short message) and *Got an answer*.
- **No open suggestion**: my singles for whom nothing is moving right now. Tap one to open Find a match. (For "I am behind".)
- **Quick note**: the note box from Single Mode's Home, with its smart suggestions.
- Search at the top finds anything from anywhere: singles, contacts, suggestions, notes, the words inside pasted profiles. (M1)
- A quiet line when the last backup is older than two weeks.

### 5.2 Singles
- Guys / Girls tabs, My singles / Everyone switch, count.
- Search by any word. Filters: age from–to, city, background, languages, status. Filters show as removable tags, as in Contacts. (M1, M4)
- Row: name, age, city, one line, status, and a small mark if a suggestion is open.
- **Add**: paste text, or attach a PDF / Word file / photo. On an Android phone with the app installed, WhatsApp's own Share button can send a profile straight into the app (to be confirmed at build time; iPhone: copy, then tap Paste).
- **To file (n)**: the pile of saved-as-arrived profiles. Open one and the original sits beside the form, as in Add Person today.
- If the same person arrives again: Open existing / Add as updated version / Save as new (exists today).

**A single's card** (the person card from Single Mode)
- Tabs: Profile · Suggestions · Notes.
- Status: Available · Busy · Engaged · Paused · Not relevant. Busy is set by itself while a suggestion is in Dating; it can also be set by hand ("busy elsewhere, check again on …", which makes a follow-up).
- "Looking for" gets two plain fields the filters can use: age from–to. Everything else stays free text.
- **Speaks for**: the single, a parent, or another shadchan, chosen from the single's contact cards. Today and Send use it.
- "Last confirmed looking: 3 months ago" in small text, so stale profiles are visible.
- Button: **Find a match**.

### 5.3 Find a match (the "Make Match" that Single Mode left open)
- Top: the single in three lines, with what they are looking for.
- Below: singles of the other kind, already narrowed by what is recorded (age range, Available). Filters can be changed with chips.
- Each row says what already happened between these two: nothing, **Idea**, or **"Suggested Mar 2026 · her side said No"**. Already-tried pairs sink to the bottom under "Already tried (3)". (N1, comes free)
- A short note where a stated wish does not fit, shown and not hidden: "He is 31 · she asked up to 30".
- "Age not recorded (12)" is a separate group.
- Tap a row: both profiles side by side (stacked on a phone), then **Save as idea** or **Not a fit** (remembered, with an optional reason, so the pair is not looked at twice).

### 5.4 Suggestions
- Lanes: **Ideas · Open · Dating · Closed**, with counts. Compact / Expanded cards as in Shidduchim today.
- Card: "Yehuda Stern – Chana Levy", two answer bubbles (his side, her side), the progress bar, and days waiting.
- An answer bubble opens the floating panel: **Not asked · Asked · Thinking · Yes · No**. Every change offers Undo. No asks who said it and, optionally, why.
- Search and filter by single, by contact, by lane.

**A suggestion's page** (the shidduch details page from Single Mode)
- Progress bar: Suggested · Checked · Date 1–8 · Engaged.
- **Overview**: a "your move" line; two side cards (the single, who speaks for them, the answer and its date, who told me); references; recent history; Add note.
- **Dates**: when, where, status. After each date the same two bubbles come back: his answer, her answer, each with private feedback. This is how "waiting for her answer after Date 2" reaches Today without typing.
- **History**: one shared record, as today. Try Again after Closed keeps the old try.
- **Suggest to his side / her side**: opens the Send sheet (5.5).
- Closing: who ended it, optional reason, and a tick for "the other side was told".

### 5.5 Send (the share sheet from My Profile)
- Chooses the recipient from "speaks for", the text (short version of the profile) and the attached resume file.
- Shows the exact message before anything leaves. Copy / WhatsApp / Email / More.
- After "Yes, I sent it": the side becomes **Asked · today**, the line goes into History, and the wait starts counting on Today. It never claims the message was delivered or read.

### 5.6 Contacts
The Contacts page from Single Mode, almost unchanged. Roles: Parent, Reference, Shadchan, Rav, Other.
A contact's page lists the singles they speak for and the suggestions they are part of.

## 6. Privacy and safety, as the shadchan will read it

- "Everything you write stays on this device. There is no account and no server, so nobody else can see it, including us."
- Optional lock when the app opens (a screen lock for shared family computers; described as that, not as encryption).
- The backup file is locked with a password the shadchan chooses. The app says clearly: a forgotten password cannot be recovered.
- Deleted items wait 30 days in Recently deleted.
- The app asks the browser to keep its storage permanently (today it does not ask; some phones clear data of unused sites).
- Demo data is fictional and marked, as today.

## 7. How it is built on Single Mode

**Shape:** one codebase. Shadchan Mode gets **its own link, its own home-screen icon and its own database**; the shared pieces are used by both. Single Mode is not turned into a switch, and its behaviour does not change.

| Piece | Plan |
|---|---|
| App shell, tokens, labels, Settings, backup, demo loader | Shared as they are |
| Contacts, Add Shadchan / Edit contact, folders | Shared as they are; role names extended |
| Add Person: Paste / Basic / Detailed, categories and choices, originals, duplicate check | Shared as they are; two new fields (age from–to) |
| Person card | Shared; "Offers" tab becomes "Suggestions"; status and "speaks for" added |
| Notes, conversation records, follow-ups, smart suggestions | Shared; phrases extended for two-sided answers |
| Share sheet | Shared; sends a single's profile instead of mine |
| Shidduchim list and details | Same look and parts (bar, lanes, bubbles, dates, history). **New data module**, because here a suggestion is guy + girl; in Single Mode it is me + one person |
| My Profile | Not used in Shadchan Mode |
| **New** | Today's lists, Singles at scale with filters, Find a match, Asked state, "other side was told", Recently deleted, backup reminder, locked backup |

**Rules for the build**
- A Single Mode file is changed only to make a piece shareable, never to change what it does. The `TESTS.md` checks run after every such change.
- Data: `offers` in the shadchan database hold `guyId` and `girlId`; each try holds an answer per side with the date it was asked and answered. Everything else keeps today's record shapes.
- **Ready for sync from day one:** nothing is hard-deleted (a deleted mark and date instead), every record keeps its "last changed" time (already true), ids are random (already true), attachments are stored and backed up apart from the records (today they sit inside one backup file, which gets too large with hundreds of resumes).
- **Scale:** lists draw the first 60 rows and add more on scroll; search runs over one in-memory text index. Target: 3,000 singles without a visible wait on a mid-range phone.
- Fonts move into the app (today they come from Google Fonts).
- New pages keep their words in one place per page, so Hebrew and Russian can be added later without touching the code. (N6)
- Every new element gets a `data-id` label; no plus signs; all colours and sizes from tokens. (CLAUDE.md rules.)

## 8. Address

Real data lives in the browser under the app's address. **Changing the address later means every user has to move their data by backup file.** So the address must be settled before the first real shadchan types real data. Recommended: an own address (about 10–15 dollars a year), also because of filters. The owner's own Single Mode data would move once, by backup file.

## 9. What Shadchan Mode will not do (first version)

- No accounts, no shared database between shadchanim, no singles logging in. (0 of 26 asked for working together.)
- No automatic matching or scoring.
- No reading of text inside PDFs and photos. The file is kept and shown; searchable words come from pasted text and typed fields. (Worth its own experiment later, like the filing lab.)
- No reminders while the app is closed. A follow-up can be added to the phone's calendar instead (exists today).
- No fee tracking, no chat.

## 10. Stages (to go into ROADMAP.md after approval)

| Stage | What | Model |
|---|---|---|
| S0 | Owner: five conversations (questions in research.md, plus "which filter?" and "do you have Dropbox or Google Drive?"), answers to section 12, the address | — |
| S1 | Foundation: own link, icon and database; shared pieces wired; fonts inside the app; permanent storage; Recently deleted; 60 fictional singles; Settings | Fable |
| S2 | Singles: list at scale, search everything, filters, Add and To file, single's card with status and speaks-for | Opus |
| S3 | Suggestions: Idea to Closed, answers per side, lanes, details, dates with both sides' answers, history, already-tried warning | Fable |
| S4 | Today: Your move, Waiting for them, No open suggestion, quick note, backup reminder | Opus |
| S5 | Find a match and Send | Opus |
| S6 | Check everything together at phone and computer sizes; locked backup file; test round with 3–5 shadchanim on one device each | Opus |
| S7 | Phone and computer in step (Dropbox or own locked mailbox, chosen from S6) | Fable |
| Later | Early-checks checklist (N2), reading PDFs and photos, Hebrew and Russian screens, bringing in Excel files (N3) | — |

## 11. Risks

- **One device only until S7.** 15 of 25 use phone and computer equally. Testers must pick one device for the test round, or move the backup file by hand.
- **Filters are mostly unverified.** One real test each on NetFree and TAG before inviting those users.
- **iPhone** has the weakest support for installed web apps (sharing into the app, cloud sign-in). Needs the owner's phone or a tester's at S2 and S7.
- **Thin research.** 26 answers, 12 short texts. The five conversations in S0 are cheap insurance before S3, the largest stage.
- **Losing a device loses the data** until backups are a habit. Hence the reminder and the locked file in the first test round.

## 12. Questions for the owner

1. **Sending a profile:** by default, does the first message to a side include the full resume with references and phone numbers, or a short version with details held back until both say Yes? (Customs differ; the default should match your circles. Either way the shadchan can change it per send.)
2. **Who is asked first:** should the app assume nothing (recommended), or suggest "his side first"?
3. **The address:** agree to an own address before real users? If yes, which name?
4. **One link or two:** recommended is a separate link and icon for shadchanim. Or do you want one link that asks "single or shadchan" on first open?
5. **Words:** Singles / Suggestions / Today / Speaks for / My singles. Any you would say differently?
6. **Status list:** Available · Busy · Engaged · Paused · Not relevant. Missing or wrong?
7. **Test round:** do you have 3–5 shadchanim who would try it for two weeks on one device?
