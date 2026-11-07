# ZugDesk roadmap

Start each stage in a **new chat** with the model shown, and paste:

> Read CLAUDE.md and ROADMAP.md. Do Stage N.

Tweaks can be sent in any chat, all in one message:

> contacts.add-btn bigger · home.notes move to top · remove offers.export

| Stage | What | Model | Status |
|---|---|---|---|
| 0 | Setup: folders, split doc, publishing, these notes | Opus 5.5 | ✅ done |
| 1 | Foundation: app shell, bottom navigation, shared styles, data store, 200 fictional contacts, export/import/reset, Settings with "Show labels", install on phone | **Fable 5.1** | ✅ done |
| 2 | Contacts + Add Shadchan: phone views, search, sort, filters, pin, folders, desktop 3-area view | Opus 5.5 | ☐ |
| 3 | Add Person: Paste / Basic / Detailed, categories & choices, attachments, source kept | Opus 5.5 | ☐ |
| 4 | People & Ideas / Offers cards: Profile-style card, Profile / Offers / Notes tabs, interest vs. reported response | Opus 5.5 | ☐ |
| 5 | Shidduchim: Offers / In Progress / Ended, 11-step bar, Overview, Dates, History, tries | **Fable 5.1** | ☐ |
| 6 | Home: notes, pin & colour, link to contacts/people, follow-ups, history | Opus 5.5 | ☐ |
| 7 | My Profile: Profile, Short versions, private Notes, safe sharing | Opus 5.5 | ☐ |
| 8 | Check everything together: acceptance walkthroughs, phone sizes, PASS/FAIL list, fixes | Opus 5.5 | ☐ |
| — | Tweak batches between stages | Sonnet 5.5 | any time |
| Later | Second warm visual design, Compact/Standard/Roomy spacing, Make Match | — | not now |

## Stage notes
(Claude adds a 2–3 line summary here at the end of each stage: what was built, what's left, known problems.)

- **Stage 0:** Files moved to `source/`. Doc split into `spec/`. Auto-publishing set up from `app/`.
- **Stage 1:** App shell with hash router, top bar + bottom navigation (3- or 4-destination arrangement chosen in Settings), design tokens in `app/css/tokens.css`, IndexedDB store (`app/js/store.js`, schema v1 with all record types from the handoff), 20 fictional starter contacts, Settings with Show labels, Load 200 demo contacts, Remove all demo data, Export / Import / Reset, PWA manifest + service worker (offline, installable). Contacts has a plain list + record view with Pin and a small edit form to prove save → reload; Home / People / Shidduchim / Profile are honest placeholders.
  Left for later stages: real Contacts views, search, sort, filters, folders (Stage 2); everything else per the table. Known: Google Fonts need one online load before they are cached for offline use.
