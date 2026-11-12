# Tests & checks

## Automatic (Claude runs these; no build step, no npm)
- Syntax of every module: `for f in app/js/*.js app/pages/*.js; do node --input-type=module --check < $f || echo FAIL $f; done` (prints nothing but FAIL lines on error)
- No raw colours or numeric corners/shadows in page code: `grep -rnE '#[0-9a-fA-F]{3,6}\b|rgba?\(|border-radius: ?[0-9]|box-shadow: ?[0-9]' app/pages app/js` (tokens.css is allowed to define them)
- No visible plus signs: `grep -rn '"+ \|>+ \|+ Add' app/pages app/js`
- Pages load with no console errors at 360 px and 390 px wide (Playwright, as in CLAUDE.md)
- Every new button or section has a `data-id` label, and labels are unique

## Shadchan Mode (automatic; `spec/shadchan/build-notes.md`)
- Run every check above in **both** modes (Settings → Mode). Single Mode must behave exactly as before.
- Switching to Shadchan Mode: bottom bar is Home · Guys · Girls · Shidduchim · Contacts, Home says "Shadchan" under the gear, and none of Single Mode's records show. Switching back shows Single Mode exactly as it was.
- No request leaves the app's own address (fonts come from `app/fonts`).
- Delete a single in Shadchan Mode: one line in Settings → Recently deleted; Restore brings back the single with originals, follow-ups and conversation links. Delete forever really erases. Things older than 30 days are erased when the app opens.
- Deleting in Single Mode still erases at once.
- Export holds both modes; Reset empties both; Import brings both back; a backup made before Shadchan Mode still loads and leaves Shadchan Mode alone.

## Manual (I check on my phone)
- [ ] Close and reopen the app: it loads, Home shows
- [ ] Settings → Show labels shows names on buttons
- [ ] Ideas: Active / Open / Closed tabs show the right people
- [ ] Shidduchim: Offers / In Progress / Ended lanes work
- [ ] Add a person and a shadchan; they appear in the lists
- [ ] Settings → Mode → Shadchan: the bottom bar changes; Guys → Try the demo shows 30 guys; Settings → Mode → Single brings my own things back

## Regression (add one line per fixed bug or approved feature)
- Ending a shidduch moves the person out of Ideas → Active into Closed ("Shidduch ended"); Reopen puts them back in Open.
- Ideas → Open rows have "I'm not interested" and "She/He is not interested" buttons; the person card shows the same choice.
- Shadchan Mode Home at 360 px: the mode name sits under the gear, so the tab row does not push the page sideways.
- In Shadchan Mode, Add Person offers both Guy and Girl even when My Profile in Single Mode says who I am.
