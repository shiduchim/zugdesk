# ZugDesk — notes for Claude

ZugDesk is a working prototype of **ZivugMatch Single Mode**: a phone-first app for one user
to organize shadchanim (contacts), suggested people, offers, dates and notes.
The owner is not a programmer and tests on a phone. They send short change requests.

## Where things are

| Path | What it is | Rules |
|---|---|---|
| `app/` | The real app; this folder is published to the phone link | All coding happens here |
| `spec/` | The design doc, split into one file per area (+ `spec/img/` pictures) | Read **only** the file for the current task |
| `source/` | The owner's original HTML designs and the full .docx | **Never edit.** Open only to copy look/structure for the page being built |
| `ROADMAP.md` | Stages and checkboxes | Update the checkboxes when a stage step is done |

Spec files: `00-overview` · `build-handoff` (architecture + acceptance rules — read for every build stage) ·
`home` · `contacts` · `add-person` (also Add Shadchan) · `offers-cards` · `shidduchim` · `my-profile` ·
`appearance` (future only) · `final-checklist`.

Matching source designs: Home → `ZivugMatch_Single_Mode_Home_Final_v8 .html` · Contacts → `Contacts layouts (1).html` ·
Add Person → `ZivugMatch_Add_Person_Prototype_v3_0.html` · Shidduchim → `ZivugMatch_Shidduchim_Floating_Answer_Choices_v7 EXPANDED.html` ·
Offers/People cards → `Shadchanim Offers.html` · My Profile → `My Profile.html`, `my profile short tab.html`.
These files are large: use grep / read in parts, never read a whole file unless needed.

## How the app is built (keep it this way)

- Plain HTML + CSS + JavaScript ES modules. **No build step, no npm, no framework.**
- `app/index.html` is the single app shell with a hash router (`#/home`, `#/contacts/…`).
- One JS module + one CSS file per page in `app/pages/` (e.g. `contacts.js`, `contacts.css`).
- Shared styles and **all sizes/colours as CSS variables** in `app/css/tokens.css`
  (e.g. `--btn-height`, `--font-base`, `--gap`). "Make all buttons bigger" = change one variable.
- One shared data store in `app/js/store.js` (IndexedDB, versioned schema, export/import/reset).
  Pages never keep their own copies of records — see `spec/build-handoff.md` section C.
- Installable on the phone (manifest + service worker).
- Visual style: Claude minimalist look from `source/My Profile.html` (Inter / JetBrains Mono, warm light).
- **Every colour, corner, shadow and font is a token in `app/css/tokens.css`.** Page CSS and JS never write raw colours
  (no `#hex`, `rgb()`, numeric `border-radius` or `box-shadow`). A future warm theme = one file that redefines the tokens.

## Element labels (important for cheap edits)

Every button, section and field gets `data-id="page.element"` (e.g. `contacts.add-btn`, `home.followups`).
Settings → "Show labels" overlays these names so the owner can tap something on the phone and tell you its name.
When the owner says "contacts.add-btn bigger", find it with: `grep -rn 'contacts.add-btn' app/`.
Keep labels unique and stable; give every new element one.

## Working rules

- Small tweak request → grep for the label, edit only that spot, don't re-read whole pages.
- Fictional seed data only. Real data the owner types stays on their device (IndexedDB), never in the repo.
- Every button must work or clearly say "coming later" — no silent placeholders.
- Check at 360 and 390 px widths (Playwright is available) before saying a page is done.
- Commit with a clear message and push to the session's branch; pushes publish automatically.
- **No plus signs (+) anywhere visible** in the app: no + icons, no "+ Add" labels, no + in phone numbers (use 00 for country codes). Use words like "Add" or "New".
- End of every stage: update ROADMAP.md, commit, push, and create the PR without being asked.
- The owner prefers step-by-step, plain-language instructions for anything they must do themselves.

## Tweak mode (after Stage 8)

When the owner starts a chat with "Tweak mode":

1. Reply in one or two lines: ready, and remind them to send changes as a list (labels or screenshots).
2. For **each** list they send, first say which model fits, in one line, then work:
   - **Sonnet 5.5 · Low**: sizes, moving, removing, wording, colours, small fixes.
   - **Opus 5.5 · Medium**: new features, changing how something works, restyling a whole page, data changes.
   - **Fable 5.1 · High**: a bug still broken after 2 tries.
   If the current model is weaker than needed, say "Switch to X first, then send the list again" and stop.
   If it is stronger than needed, just mention a cheaper model would do and carry on.
   You cannot see which model you are running on from this file; if unsure, ask the owner in one line.
3. After each list: commit and push (that publishes to the phone link), then say "Pushed. Close and reopen the app in about a minute."
4. Do **not** make the PR until the owner says "make the PR".
5. After about 25 messages, or if the chat is getting slow, suggest: make the PR, merge, start a new chat with "Read CLAUDE.md. Tweak mode."
6. If a request is unclear, ask one short question instead of guessing.
