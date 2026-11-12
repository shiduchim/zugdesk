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
- Guys / Girls (S2): search "lakewood" narrows the list; a word only in a pasted original still finds the single and shows the words around it; Working on / All counts are right; an age filter lists "Age not recorded" apart; each tag's "remove" and Clear filters work; with 3,000 singles rows keep loading while scrolling.
- Single's card (S2): Status, Working on, ages from–to, Talk to and "Still looking — today" save at once; choosing Busy with a date makes a follow-up. Single Mode's card has none of these.
- Shidduchim (S3), with the demo loaded: the four lanes show their counts and nothing reads "null"; tap a bubble → five choices; Asked moves an idea to Offers and Undo brings it back (nothing lands in Recently deleted); his side Yes with her side Not asked shows "Your move"; "Mark her side asked" shows the days waiting.
- Shidduch page (S3): arranging a date marks both sides Yes, moves it to In Progress and makes both singles Busy; an answer after a past date marks the date Happened; No opens the End sheet with a tick for the side that still has to be told; after ending, both singles are Available again and "Your move: tell …" shows until "was told" is tapped; Try Again keeps the old bar; Engaged marks both singles Engaged and Undo puts back Busy.
- New idea (S3): choosing a couple that already has a record shows "These two were already put together" and saves nothing.
- Deleting (S3): a single in Offers or In Progress cannot be deleted; a single with only ideas or finished shidduchim is one line in Recently deleted and Restore brings the shidduchim back; a deleted shidduch is named by its couple.
- Home (S4), with the demo loaded: blocks show To do, At a glance, Notes; “Your move” rows match the Shidduchim cards; “Mark … asked” moves a row from Your move to Waiting; Got an answer → Yes takes it off Waiting and offers Undo; Remind shows the message and WhatsApp/Copy; Edit Home show/hide and Up/Down change Home at once, all hidden shows “Your Home is empty”, Back to the first layout restores it; Settings → Home → Edit Home opens the same sheet; backup reminder shows until Back up now; search “stern” lists Shidduchim. Single Mode Home still has its three tabs.
- Export holds both modes; Reset empties both; Import brings both back; a backup made before Shadchan Mode still loads and leaves Shadchan Mode alone.

## Manual (I check on my phone)
- [ ] Close and reopen the app: it loads, Home shows
- [ ] Settings → Show labels shows names on buttons
- [ ] Ideas: Active / Open / Closed tabs show the right people
- [ ] Shidduchim: Offers / In Progress / Ended lanes work
- [ ] Add a person and a shadchan; they appear in the lists
- [ ] Shadchan Mode → Guys: type a city in search, open Filters and set an age; tap a single, change Status and the star
- [ ] Shadchan Mode → Shidduchim: tap a bubble and choose an answer; open a card and arrange a date; end one and tick who was told
- [ ] Settings → Mode → Shadchan: the bottom bar changes; Guys → Try the demo shows 30 guys; Settings → Mode → Single brings my own things back

## Regression (add one line per fixed bug or approved feature)
- Ending a shidduch moves the person out of Ideas → Active into Closed ("Shidduch ended"); Reopen puts them back in Open.
- Ideas → Open rows have "I'm not interested" and "She/He is not interested" buttons; the person card shows the same choice.
- Shadchan Mode Home at 360 px: the mode name sits under the gear, so the tab row does not push the page sideways.
- In Shadchan Mode, Add Person offers both Guy and Girl even when My Profile in Single Mode says who I am.
- Shadchan Mode Shidduchim: an opened card (arrow) still shows the floating answer choices above its quick-action buttons.
- Shadchan Mode: Home → History names a shidduch by both singles ("Yehuda Stern – Chana Levy"), never "Shidduch · ?".

