# Tests & checks

ZugDesk is a static website (plain HTML/CSS/JS in `app/`). There is **no build step**.

## Automatic (Claude runs these with /check)
- Serve: `python3 -m http.server 8123` from the repo root, open `http://localhost:8123/app/index.html`.
- Playwright (pre-installed; write a throwaway script in the scratchpad, don't add it to the repo):
  - Every page (`#/home`, `#/contacts`, `#/people`, `#/shidduchim`, `#/profile`, `#/settings`, plus one open record of each) at **320, 360, 390, 430 px and 1280 px**:
    no horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`), no JavaScript errors in the console.
  - No visible plus signs: page text has no `+` (Settings → Load demo data first).
  - Data survives reload: edit a contact field, reload, value is still there.
- Token rule: `grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(' app/pages app/js` finds no raw colours (only `app/css/tokens.css` may have them).
- Labels: every new button/section/field has a unique `data-id`.

## Manual (owner checks on the phone)
- [ ] Close and reopen the app after an update (it may say "ZugDesk updated").
- [ ] Home: write a note, link a contact, add a follow up; it appears on the contact too.
- [ ] Contacts: search, filters, View switcher, Pin.
- [ ] Ideas → Add Person: paste a profile, save, reopen.
- [ ] Shidduchim: answer bubbles, both Yes → In Progress, swipe between Overview / Dates / History.
- [ ] My Profile: edit a fact, Share preview shows no private notes.
- [ ] Settings: Appearance (Light / Dark / Match my phone), Show labels, Export backup.

## Regression (one line per fixed bug or approved feature)
- All ten workflows in `spec/build-handoff.md` section D passed in Stage 8 (phone 360 px with touch, desktop 1280 px).
- No `+` anywhere visible; phone country codes use 00.
- Pasted `+` country codes in Add Person become 00.
- Dating needs Yes from both sides; Thinking after dating keeps the match In Progress; Try Again only after Ended.
- A person moves to Offers only when both sides say yes.
- One record per note/conversation: editing it on Home, contact or person card changes it everywhere.
- Share sends only ticked fields; private notes never included; "sent" only after "Yes, I sent it".
- Pop-ups close when the phone's Back button is pressed.
- Settings never draws over another page after a save.
- App starts empty with a demo-data button; Remove all demo data keeps the owner's own records.
- Dark is the default appearance; Light / Dark / Match my phone all readable.
- Editing bars (Cancel / Save) stay at the visible top while the phone keyboard is open; Cancel undoes changes.
- Shidduch details: swipe left/right switches Overview / Dates / History.
- Ideas rows: no overlap, no sideways scroll; long lines end with "…".
