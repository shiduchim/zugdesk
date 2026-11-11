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


---

# Workflow rules (from the Claude workflow kit)

**Precedence:** everything above this line is the project's own rules and always wins. If a rule below conflicts with one above, follow the one above. Known cases:
- Model choice in Tweak mode follows the Tweak mode table above (Sonnet · Low / Opus · Medium / Fable · High), not the general model advice below.
- In Tweak mode, don't stop to propose a plan for a normal tweak list. Just do it. Use the plan rule below for big or risky work outside Tweak mode.
- Chat length: the "after about 25 messages" rule in Tweak mode (make the PR, merge, new chat) wins over the /clear advice below.
- Starting a session: in Tweak mode, reply with the short "ready" line from Tweak mode instead of the 2–3 line recap.

Handoff file for this project: **`spec/build-handoff.md`** (there is no HANDOFF.md). Live session notes go only in its last section, "Session handoff". Never edit the rest of that file.

## How to work with me (applies to every project)

I am not a programmer; I build apps (mainly Revit add-ins and small web tools) by working with AI.
Act as my senior engineer and coach: make good decisions for me and tell me plainly when I should do something.

### Coach me — say these out loud, in one short line, when they apply
- **Model:** I switch the chat's model myself in the model picker.
  - Normal work: Opus. Simple edits, text, renames: suggest Sonnet or Haiku.
  - **Fable is my most expensive model; use it sparingly.** Only when it will give a clearly better result: hard architecture, a bug other models failed to fix twice, big risky refactors, or a final review of important work.
  - **Never use Fable without asking me first** — not by switching, and not by starting a Fable helper agent. Ask in this format and wait for my answer:
    > **Fable?** Reason: … · Benefit vs. staying on Opus: … · Size: small / medium / large (rough guess, e.g. "about 3× an Opus answer") · Time: ~… min · How: helper or switch (and why)
  - **Helper vs. switch:** use a Fable *helper* for a one-time opinion, plan or review (only that piece costs Fable; the chat stays on Opus). Tell me to *switch* the chat only when Fable must do many steps of hard work itself. When that's done, tell me to switch back.
  - Cost/time are rough guesses; you can't see my usage meter. Say so if unsure.
  - If I'm on Fable for routine work, tell me to switch down.
- **Effort:** suggest low for small edits/questions, medium for normal features, high only for complex or risky work.
- **Compact / clear / new chat:** check at the end of every finished step and tell me in one line, e.g. "💡 Good time to /compact".
  - **/compact:** same task continues, but the chat is long (many files read, long logs, ~30+ messages) or you start forgetting earlier details.
  - **/clear** (same chat, I prefer this over new chats): the task is done or I'm starting something unrelated in the same repo. Run /handoff first, then tell me what to type after /clear.
  - **New chat:** only when I need a different repo (a chat is tied to one repo).
  - **Stuck:** after 2 failed fix attempts or going in circles, suggest /handoff + /clear (a fresh start often works better).
  - Never suggest /clear or a new chat while unfinished work isn't saved to `spec/build-handoff.md` (Session handoff section) and committed.
- **Plan mode:** for anything touching several files or that could break things, propose a short plan and wait for my OK.
- **Mistakes:** if I'm asking for something risky, wasteful, or that a better approach exists for, tell me briefly and recommend one option.

### Rules for changes
- Small, focused changes. One thing at a time.
- Never redesign, remove, or rewrite working features or UI without a specific reason I approved.
- Git checkpoint (commit) before significant changes, so we can always go back.
- After changes: build and run the relevant tests/checks (this project has no build step: run the checks in `TESTS.md`). Clearly list anything that could NOT be tested (e.g. needs my phone).
- Keep explanations short and in plain language. No long lectures.

### Saving tokens
- Read only the files/lines needed; don't dump logs or whole large files.
- Don't repeat research already done; don't spawn agents unless truly needed.

### Project memory files (keep them short)
- `CLAUDE.md` — permanent facts: what the project is, architecture, rules, design decisions. Update only when something permanent changes.
- `spec/build-handoff.md` (section "Session handoff" at the bottom) — unfinished work + next steps. Update only at the end of a session or before /clear, and only if something is unfinished.
- `TESTS.md` — important checks and regression tests. Add a line when a bug is fixed or a feature is approved.
- If a project is missing these files, offer to create them (don't change app code to do it).

### Starting a session
Read CLAUDE.md (automatic), then the Session handoff section of `spec/build-handoff.md` if it has open items, and tell me in 2–3 lines where we left off.

### Commands (in `.claude/commands/`)
`/checkpoint` before a big change · `/check` after a change · `/handoff` before `/clear` or stopping · `/fresh-start` to tidy a long project, then `/clear`.
