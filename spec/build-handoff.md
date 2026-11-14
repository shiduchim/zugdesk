# V11 — Claude Code build handoff for Single Mode

Status: implementation instructions and acceptance contract. This chapter complements the approved design history above; when old exploratory language conflicts with this section, use the latest explicitly approved behavior and this implementation scope.

## A. Non-negotiable source and scope rules

Target: a single locally testable Single Mode app with actual navigation, editing and persistent shared data. Create it in an isolated development folder or branch. Do not overwrite a live Stable deployment. Inspect the real repository before choosing a framework or storage architecture; keep existing technology wherever reasonable.

The user-supplied Claude My Profile.html, its desktop and short-version artboards, and support.js and vendor files are immutable visual source references. Never replace or restyle these source files. Build working components from them; do not claim that the static export itself implements editing.

For the first coherent implementation, all new pages should match Claude’s minimalist style and reading rhythm. User-approved Home v8, Shidduchim v7 and Add Person v3.0 remain behavioral and structure references; their original HTML must remain unchanged.

Only Single Mode is included. The single user may organize shadchanim, suggested people, offers and their own shidduch history. The separate professional Shadchan Mode, including multi-client matching operations, is a future project.

Build no second visual system now. Preserve a clear future note: all pages should eventually support two complete visual designs, Claude minimalist and warmer ChatGPT/ZivugMatch, with Compact, Standard and Roomy spacing. Game and Neon are only screenshot references, not requested implementations in this phase.

## B. Page and navigation inventory

| Area                      | Implementation contract                                                                                                                                                                                                                    |
|---------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Home                      | Use Home_v8_APPROVED.html. Real note intake, inline note editing, history, follow-up tasks, note links, and shortcuts into the same contact and person records.                                                                            |
| Contacts / Shadchanim     | Desktop Outlook-style navigator and mobile selectable views. View selection, search, sort, multiple filters, pinned group, optional folders, conversation log, linked people and profile sharing must work.                                |
| People and Ideas / Offers | Use Profile card visual structure from the original Claude My Profile, but populate from Add Person. Profile, Offers, Notes tabs. Preserve private interest and reported response separately. A saved idea is not a formal shidduch offer. |
| Shidduchim                | Use Shidduchim_v7_APPROVED.html. Offers, In Progress and Ended lanes; 11 milestone positions; Overview, Dates, History and People. Date status and repeated tries remain separate.                                                         |
| My Profile                | Retain original Claude appearance: Profile, Short versions, Notes. Editable facts and sections, safe sharing, language selection and protected private notes.                                                                              |
| Add Person                | Use Add_Person_v3_APPROVED.html. Paste, Basic Info and Detailed Info, preserving source text, contacts, references, custom attributes and attachments.                                                                                     |
| Add Shadchan              | Use the approved Add Shadchan one-screen flow, linked to the Contacts entity rather than a duplicate contact.                                                                                                                              |
| Settings                  | Expose Contacts layout picker, sorting defaults and navigation comparison where appropriate; defer second appearance system to future notes.                                                                                               |

Navigation is still being compared: either Home / Contacts / Shidduchim with People and Ideas inside Shidduchim, or Home / Contacts / People and Ideas / Shidduchim. Prototype may offer a user-selectable navigation arrangement, without changing data.

## C. Single source of truth: records and relationships

A shared person record must be the canonical source for person profiles; a shared contact record must be the canonical source for shadchanim and references. A contact may hold more than one role. Do not copy contacts or person profiles into page-specific lists.

Recommended conceptual entities: UserProfile, Person, Contact, ContactRole, ContactGroup, Folder, ContactFolderMembership, Pin, Note, ConversationEvent, FollowUp, SuggestionSource, PreliminaryInterest, FormalOffer, ShidduchTry, StageEvent, DateEvent, ProfileVersion, ShareSnapshot and Attachment. Exact storage schema may follow the existing app conventions.

One recorded conversation or note may link to several people and may appear from Home, the relevant shadchan contact and a suggested person profile. It remains one record with one identifier, not separately copied rows. Edits propagate to every linked view; links and provenance remain visible.

Record exact stated facts with source, timestamp, and owner where known. Separate a shadchan’s personal background from the communities the shadchan works with. Unknown is unknown. Do not infer identities, status, dates, contact history or religious background from a name or city.

A person can be a saved idea with no offer. Only the explicit offer process creates a formal offer. It advances to In Progress only after both parties have affirmatively responded Yes. A recorded date becomes completed only if it actually happened. An ended try remains preserved; a new attempt creates a separate try with its own 11-stage bar.

## D. End-to-end workflow acceptance requirements

- Create a shadchan from the Add Shadchan screen; find the same contact in Contacts; set city, spoken languages, groups served and last contact; pin it and place it in an optional folder. The contact appears once everywhere.

- Browse at least 200 realistic fictional shadchan contacts. Sort by name, city, last recorded interaction, language and community. Filter by city, languages, groups served, Waiting, Follow-up, active status, and folders. Filters may combine and are resettable.

- Switch among Contacts mobile layouts without losing the selected contact, current search or filters, and when practical the contact directory scroll position. The top-left directory and top-right quick-info layout, narrow-sidebar view, top/bottom independent-scroll view, horizontal tabs and inbox variants remain selectable.

- Record a call or message once, link it to a shadchan and a suggested person, and see that same record in both histories and Home. Editing it anywhere updates all linked views.

- Enter a suggested person through Add Person Paste / Basic / Detailed. Keep original pasted profile, claimed source, language, phone ownership, custom fields, attachments, and the earliest version. Show that person in Offers using the Claude Profile look, not an Outlook CRM card.

- Record my private interest and the other person’s reported response separately, including the reason, who reported it and when. Changing an interest does not automatically start, end or reopen a formal shidduch.

- Convert a genuine offer into In Progress only after explicit Yes from both sides; record stage transitions, date outcomes and private feedback. End it with reason and attribution. Try again opens a new numbered try and preserves all older history.

- Edit My Profile facts, About Me, What I am looking for, inquiries and references. Switch its Profile, Short versions and Notes tabs. A short version can be copied, edited or saved with a timestamp. Private notes never enter outgoing content.

- Prepare a shareable My Profile snapshot, preview exactly what is shared, copy or open an external channel with explicit user action, then record sent status only after user confirmation. A share log must not imply delivery or read confirmation.

- Reload and reopen the prototype: edits, notes, contacts, folders, pinned state, layout choice and histories remain. Export and import local demo data or give a well-documented reset path.

## E. Architecture, persistence, validation and privacy

Inspect the app’s actual source, package manager, routing and deployment before choosing implementation details. Maintain a consistent component tree with a shared record store, centralized actions and validation. Do not create isolated mini-apps that only look connected.

For a standalone local prototype, implement durable browser persistence using an appropriate existing store or IndexedDB; store small presentation preferences separately if useful. Version the data shape and provide a safe migration strategy. Use seeded fictional people only. Do not substitute real user records without an explicit import decision.

Use stable opaque identifiers and explicit relationship tables. Keep display strings, status and language separate from keys. Offer duplicate detection before creating a new person, and provide undo for merges or ending an offer when possible.

Sharing must be allowlisted: include only expressly approved profile fields and selected attachments. Never leak conversation notes, private impressions, reference notes, another person’s data or shadchan history into outgoing content. Do not claim that a WhatsApp or email was delivered unless a supported source confirms it.

All buttons in the prototype must either perform their named action or clearly state that the feature is deferred; no silent placeholders. Handle empty data, source conflicts, long text, Hebrew and right-to-left content. Touch targets, focus, keyboard controls and color contrast require basic accessibility checks.

## F. Practical build stages for Claude Code

| Area                        | Implementation contract                                                                                                                                                                         |
|-----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Stage 0 — inspect           | Read the references and real repository, inventory existing features, establish a safe branch and local build. Report conflicts and preserve approved source files.                             |
| Stage 1 — data foundation   | Define canonical records, relationships, events and persistence. Add fictional seed data and working save, edit, reload, export and import.                                                     |
| Stage 2 — core page wiring  | Integrate Home, My Profile, Contacts, People and Ideas, Shidduchim and Add Person into one navigation system. Connect actions to the same records.                                              |
| Stage 3 — full workflows    | Make add, edit, filter, pin, folder, follow-up, note, share, interest, offer, date and ending/retry actions work end to end.                                                                    |
| Stage 4 — verify            | Run automated checks and practical phone / desktop walkthroughs. Fix regressions and deliver a build with instructions and a known-gaps list.                                                   |
| Later — not in this handoff | Develop second warm ChatGPT/ZivugMatch app-wide design alongside Claude minimalist, then user-selectable density modes. Keep Game and Neon as screenshot-only references for later exploration. |

## G. Verification and completion gates

Test 320, 360, 390 and 430 pixel phone widths plus desktop. Check no horizontal page overflow; independent scrolling in Contacts; sticky and safe-height behaviors; visible actions and readable facts; keyboard tab navigation; Hebrew/right-to-left text; long names and conversations; a 200-contact directory; persistent state after refresh; and share-content privacy.

A page is not finished because a screenshot looks good. The prototype is complete only when the navigation works, data is shared, records persist, and acceptance workflows pass without fake confirmations. Maintain a PASS / FAIL matrix and a short list of defects and deferred work.

Do not deploy to the live site without explicit instruction. Deliver a buildable local project with README, clear run commands, test commands, screenshots of validated pages, and concise change notes. Preserve the original Claude Profile HTML artifacts unchanged in the references directory.

## H. Future visual system — notes only, not current implementation

Future requirement as requested: ALL pages must eventually offer at least TWO coherent design systems: (1) the original Claude minimalist visual style, grounded in the exact user-supplied My Profile files, and (2) the warmer ChatGPT/ZivugMatch visual style grounded in the approved Home v8, Shidduchim v7 and Add Person v3.0 prototypes. This is a product-design note, NOT an instruction to build the second design in this phase.

At that later stage, ensure My Profile also has a warmer variant while the original Claude version remains untouched as its visual baseline. Keep theme choice separate from spacing choices Compact, Standard and Roomy; presentational changes must never mutate records, navigation history or drafts. The Game and Neon examples and original appearance-menu screenshot are illustrative references only. Do not create speculative theme recreations now.

Status: recorded for future phase. No second app-wide skin, no Game/Neon recreated screens, and no theme picker are requested for the current Single Mode working prototype.


---

## Session handoff
_Live notes for /handoff. Everything above this section is the fixed spec: do not edit it._

_Last updated: 2026-11-14 (Claude paste import planned, not built)_

### In progress
- Shadchan Mode S1–S7 built (earlier PR). This session (branch `claude/pensive-shannon-tqoklr`): Find a match button moved to bottom of the single panel, full width, 38px (`--sp-find-height`). No PR yet.

### Next: build "Claude paste import" (owner approved the plan; Opus · Medium; checkpoint first)
Start a new chat with: "Read CLAUDE.md. Build the Claude paste import from Session handoff".
Goal: owner writes call notes on PC → Claude (a "ZugDesk" Claude Project) replies with ONE block in a code box → owner copies it in the Claude phone app → pastes in ZugDesk Home → preview → Save → Undo.
Rejected (researched with Opus + Fable): links (iPhone PWA storage separate from Safari), Gmail sync, Google Sheet, in-app AI, instructions fetched from GitHub (Claude fetch unreliable/cached), Claude Skills.
Format (labelled lines, never pipes; one field per line; unknown labels → about/note):
```
ZUGDESK 1
[Single]
Name: / Kind: Guy|Girl / Age: / City: / Job: / Shadchan: <name> / About:
[Shadchan]
Name: / Phone: <digits, 0 or 00> / City: / Note:
[To do]  Text: / When: YYYY-MM-DD HH:MM (+ original words)
[Update] Pair: A and B / Text:
[Date]   Pair: A and B / When: / Where:
Unclear: <anything doubtful>
END
```
Step 1 to build:
- New `app/pages/claude-import.js` (+ css, tokens only, add to service worker cache). Find `ZUGDESK n` anywhere, stop at END/fence/end. Clean lines: code fences, leading `- * • >`, `**`, bidi marks, NBSP, full-width colon. Split on FIRST colon only. Take label words from `extract()` in people-data.js (Hebrew too) but not its logic (first match only; `-` separator misfires).
- Home: "Paste from Claude" button (clipboard pattern from `pasteClipboard()` in person-form.js incl. long-press fallback) and detect the header when pasted into the notepad → chip "Add N things from this note".
- Preview sheet (`sheet()` in js/ui.js), cards scrolled up/down: Include switch, tap to edit name/age/city/job, Guy|Girl buttons required before Save, New / "Already have X" (Update fills empty only / Save as new / Skip). People dup: lift find+merge from `save()` in person-form.js (~634–660) into people-data.js helpers. Contact dup: move `findDuplicate` from contact-form.js to contacts-data.js; phone = last 9 digits. Same shadchan in several items → one contact; link Single.Shadchan by name inside the block. New contact shape like `addToContacts()` in person-form.js.
- Each person keeps its own block as an original (`store.sources.save`); whole paste saved as one note linked to all (`createNote`). To do / Update / Date / unknown sections: for now saved as notes linked to the names (later steps make them real follow-ups / shidduch answers / dates).
- One Save "Add N things", toast Undo 8s: one batch id, reuse batch erase/restore in store.js; restore updated people.
- Settings → "Claude instructions": one constant with FORMAT_VERSION and the full instruction text (keep names as typed, never invent, doubts under Unclear, put block in a code box, digits-only phones, Kind line), Copy button. Old version in a paste → still import, then "Your Claude text is old, tap to copy the new one".
- data-id on everything (`home.paste-claude`, `bulk.*`, `settings.claude-text`), no visible plus signs, check 360/390 px, add TESTS.md fixtures (fenced, unfenced, chatter before, Hebrew, missing fields, bullets, old version, duplicate, undo).
- Owner then: create Claude Project "ZugDesk", paste the copied instructions into its instructions box; tell owner Settings → Privacy → turn off "help improve Claude".
Later steps: (2) To do → follow-ups, (3) Update/Date → match existing shidduch, confirm.
Owner phone type (iPhone/Android) still unknown; if Android, Share Target is an optional extra.

### Notes / blockers
- Not testable from here: where each phone saves a downloaded file, opening it from WhatsApp/email, iPhone storage, real NetFree / TAG filters, clipboard on the owner's phone.
- Optional screen lock (design.md section 7) is not built; nobody asked for it yet.
