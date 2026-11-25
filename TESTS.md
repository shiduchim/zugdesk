# Tests & checks

## Automatic (Claude runs these; no build step, no npm)
- Syntax of every module: `for f in app/js/*.js app/pages/*.js; do node --input-type=module --check < $f || echo FAIL $f; done` (prints nothing but FAIL lines on error)
- No raw colours or numeric corners/shadows in page code: `grep -rnE '#[0-9a-fA-F]{3,6}\b|rgba?\(|border-radius: ?[0-9]|box-shadow: ?[0-9]' app/pages app/js` (tokens.css is allowed to define them)
- No visible plus signs: `grep -rn '"+ \|>+ \|+ Add' app/pages app/js`
- Pages load with no console errors at 360 px and 390 px wide (Playwright, as in CLAUDE.md)
- Every new button or section has a `data-id` label, and labels are unique

## Shadchan Mode (automatic; `spec/shadchan/build-notes.md`)
- Run every check above in **both** modes (Settings → Mode). Single Mode must behave exactly as before.
- Switching to Shadchan Mode: bottom bar is Home · Guys · Girls · Shidduchim · Contacts, the Home switch shows Shadchan, and none of Single Mode's records show. Switching back shows Single Mode exactly as it was.
- No request leaves the app's own address (fonts come from `app/fonts`).
- Delete a single in Shadchan Mode: one line in Settings → Recently deleted; Restore brings back the single with originals, follow-ups and conversation links. Delete forever really erases. Things older than 30 days are erased when the app opens.
- Deleting in Single Mode still erases at once.
- Guys / Girls (S2): search "lakewood" narrows the list; a word only in a pasted original still finds the single and shows the words around it; Working on / All counts are right; an age filter lists "Age not recorded" apart; each tag's "remove" and Clear filters work; with 3,000 singles rows keep loading while scrolling.
- Single's card (S2): Status, Working on, ages from–to, Talk to and "Still looking — today" save at once; choosing Busy with a date makes a follow-up. Single Mode's card has none of these.
- Shidduchim (S3), with the demo loaded: the four lanes show their counts and nothing reads "null"; tap a bubble → five choices; Asked moves an idea to Offers and Undo brings it back (nothing lands in Recently deleted); his side Yes with her side Not asked shows "Your move"; "Mark her side asked" shows the days waiting.
- Shidduch page (S3): arranging a date marks both sides Yes, moves it to In Progress and makes both singles Busy; an answer after a past date marks the date Happened; No opens the End sheet with a tick for the side that still has to be told; after ending, both singles are Available again and "Your move: tell …" shows until "was told" is tapped; Try Again keeps the old bar; Engaged marks both singles Engaged and Undo puts back Busy.
- In Progress cards (both modes), with the demo: every card shows the date line, both answers, and a next-step line under the bar; a coming date says “Nothing to do until the date” (Shadchan Mode shows the answers that led to that date, not tappable).
- Cards stay put (both modes): changing an answer on a Shidduchim card leaves every card in the same place and the answer bubbles keep their width; only a card that moves to another tab leaves. Reopening the page sorts by latest change again.
- Both sides Yes (both modes): the second Yes opens the Dates tab with the "Who told you?" box. Dates tab has no explanation lines (owner: less clutter).
- New idea (S3): choosing a couple that already has a record shows "These two were already put together" and saves nothing.
- Deleting (S3): a single in Offers or In Progress cannot be deleted; a single with only ideas or finished shidduchim is one line in Recently deleted and Restore brings the shidduchim back; a deleted shidduch is named by its couple.
- Home (S4), with the demo loaded: blocks show To do, At a glance, Notes; “Your move” rows match the Shidduchim cards; “Mark … asked” moves a row from Your move to Waiting; Got an answer → Yes takes it off Waiting and offers Undo; Remind shows the message and WhatsApp/Copy; Edit Home show/hide and Up/Down change Home at once, all hidden shows “Your Home is empty”, Back to the first layout restores it; Settings → Home → Edit Home opens the same sheet; backup reminder shows until Back up now; search “stern” lists Shidduchim. Single Mode Home still has its three tabs.
- Find a match (S5): from a single's card, the list starts with their age wish and Available as tags; rows say Idea / Offer / Ended for pairs already tried and sink them under Already tried; an age mismatch shows as a note; Save as idea makes one idea (Shidduchim → Ideas); Not a fit moves the row under Not a fit, Undo and Take off Not a fit work; Guys / Girls order does not change. Home → No open shidduch opens Find a match.
- Send (S5): Suggest to her side on an idea opens Send; ticks change the preview; Copy then “Not sent” records nothing; “Yes, I sent it” marks her side Asked, adds “Sent … profile to …” to History, puts it in Waiting on Home, and remembers the ticks. Undo puts it back.
- Locked backup (S6): Settings → Export backup opens “Make a backup” with the lock on; under 6 characters or two different passwords are refused; the file is unreadable (no names inside); Import asks the password, a wrong one says so and stays open, the right one restores every record. Lock off makes a plain file. “Include attached files” off: importing it keeps the files on the device. Home's “Back up now” opens the same sheet.
- Every page of both modes at 320 / 360 / 390 / 430 / 768 / 1280 px with the demo: no sideways scroll, no “null”, no console errors.
- Export holds both modes; Reset empties both; Import brings both back; a backup made before Shadchan Mode still loads and leaves Shadchan Mode alone.

## Claude paste import (automatic; fixtures in `app/pages/claude-import.js` → `parseBlock`)
- Block found inside a code box, without one, and with chatter before/after; stops at END or the closing ```.
- Bullets (`- * • >`), `**bold**`, full-width colon, Hebrew labels (שם / מין / גיל / עיר) and RTL marks are read; בחורה = Girl, בחור = Guy.
- Missing fields stay empty; a new single with no Kind cannot be saved until Guy or Girl is tapped.
- Unknown labels land in About (single) or Note (shadchan), never dropped; Unclear lines show at the top of the preview.
- `ZUGDESK 0` still imports and shows “Your Claude text is old” with Copy.
- Same paste twice: every card says “Already have …”; Update fills empty fields only and adds a second original; no second person or contact.
- A shadchan named only on a single becomes one contact, linked to every single that names them.
- Undo after Add: nothing from the paste is left (not in Recently deleted either) and the New Note text comes back.
- Phone `+1 …` is saved as `001…`; no plus sign shows anywhere.
- [To do] (step 2): `When: 2026-11-17 14:30 (next Tuesday)` fills Date and Time and shows “You wrote: next Tuesday”; a When with no YYYY-MM-DD leaves Date empty and says “Claude wrote …”. After Add it is a Follow Up on Home (time added as “· at 14:30”), linked to the full names in its text (this paste first, then saved people / contacts) and to the whole-paste note; Undo removes it.
- Shadchan tap (FORMAT_VERSION 3): every single card has "Who is the shadchan?" with suggestions (shadchanim in this paste first, then shadchanim added or changed in the last 14 days, "added yesterday"), Change, and No shadchan. Picking one links the single to that contact after Add (no new contact for a saved one). A shadchan card made only because Claude named them disappears when no single names them any more, and the "Add N things" count drops.
- Only one [Shadchan] in a paste: every single with no Shadchan line is pre-linked to her ("Shadchan: Larisa (only shadchan in this paste)"), Change still works. Two shadchanim: nothing pre-filled.
- [Update] / [Date] (step 3, FORMAT_VERSION 2 adds `Who:` / `Answer:`), in **both** modes: a Pair that names one shidduch preselects it ("Is this the shidduch?"); `Who: Moshe` + `Answer: Yes` preselects that side and Yes; Add writes "From Claude: …" to its History, records the answer (No ends it) and a [Date] becomes Date N (Arranged, or Happened if the time passed; in Shadchan Mode it marks both Yes). Unknown names say "No shidduch found" and stay a note; "Only a note" keeps it out of the shidduch. Undo puts the shidduch back exactly (answers, dates, History, singles' status).

## Manual (I check on my phone)
- [ ] Close and reopen the app: it loads, Home shows
- [ ] In Claude (phone app): tap Copy on the ZugDesk code box, then Home → Paste from AI: the preview opens (if the phone blocks the clipboard: long-press in New Note → Paste → Add … from this note)
- [ ] Settings → Show labels shows names on buttons
- [ ] Ideas: Active / Open / Closed tabs show the right people
- [ ] Shidduchim: Offers / In Progress / Ended lanes work
- [ ] Add a person and a shadchan; they appear in the lists
- [ ] Shadchan Mode → Guys: type a city in search, open Filters and set an age; tap a single, change Status and the star
- [ ] Shadchan Mode → Shidduchim: tap a bubble and choose an answer; open a card and arrange a date; end one and tick who was told
- [ ] Settings → Backup → Export backup with a password; then Import that file and type the password (on the phone, check where the file was saved)
- [ ] Settings → Mode → Shadchan: the bottom bar changes; Guys → Try the demo shows 30 guys; Settings → Mode → Single brings my own things back

## Regression (add one line per fixed bug or approved feature)
- Ending a shidduch moves the person out of Ideas → Active into Closed ("Shidduch ended"); Reopen puts them back in Open.
- Ideas → Open rows have "I'm not interested" and "She/He is not interested" buttons; the person card shows the same choice.
- Shadchan Mode Home at 360 px: search · switch · gear fit on one row, nothing pushes the page sideways; no mode name under the gear.
- In Shadchan Mode, Add Person offers both Guy and Girl even when My Profile in Single Mode says who I am.
- Shadchan Mode Shidduchim: an opened card (arrow) still shows the floating answer choices above its quick-action buttons.
- Shadchan Mode: Home → History names a shidduch by both singles ("Yehuda Stern – Chana Levy"), never "Shidduch · ?".
- Phone and computer in step (S7): two devices start from the same backup; A changes one single, B later changes another; A's backup imported on B with Merge keeps both changes and says "kept 1 that were newer on this device"; a single deleted on A (Shadchan Mode) is deleted on B too. Replace still wipes first.
- Home: tiny Single / Shadchan switch on the search row (Shadchan Mode: search · switch · gear in one row); tapping it switches mode like Settings → Mode, no sideways scroll at 320 px.
- Home, both modes: top row search · switch · gear; tabs Notes / To Do List / History underneath (phone). Shadchan phone tabs: Notes = New Note + Edit Home blocks, To Do List = To do block (Your move + follow-ups, count includes Your move), History = History block, even if hidden in Edit Home; swipe moves between them. Wide screen: tabs hidden, Edit Home blocks show.
- Home → New Note: “Paste from AI” sits in the header between New Note and Pin, on one line at 320 / 360 / 390 px.
- Add from Claude preview: cards have a gap between them, a coloured left strip (Single blue, Shadchan green, To do yellow) and a top band “1 of 3 · Single · Name”; no “null” under Guy / Girl.
- Contact card has a red Delete link (`contact.delete-btn`, next to Edit / Move to folder) in both modes; it asks first, then deletes exactly like the Edit page Delete.
- Contact facts edit in place: tap Speaks → tap Russian saves at once (editor stays open, Done closes); tap Email label → type → Save. Phone/Email links still call/mail when the link itself is tapped. Languages show on the small contact row.
- Voice notes step 4: date feedback has a mic (Single `shidduch.date-feedback-mic`, the date row says "· voice note", the edit form plays it; Shadchan feedback sheet has one mic per side, chips under each side's feedback). Undo after a voice update and deleting a shidduch also remove its recordings. Backup toggle says "Include files and voice notes (N)".
- Voice notes step 3: shidduch "Add note" (`shidduch.note-mic`) and the list's quick update (`shidduchim.update-mic`) in both modes; a recording alone saves as "Voice note"; History shows a play chip (`shidduch.history-voice-chip`).
- Voice notes step 2: Home New Note and "Write an update" have a mic (`home.new-note.mic`, `home.note-editor.mic`); a recording alone can be saved (title "Voice note"); the note shows a play chip; deleting the note deletes its recordings.
- Voice notes step 1 (Playwright with a fake mic: --use-fake-device-for-media-stream): contact composer has a mic in the box corner (`contact.composer.mic`); tap → red dot + timer + Cancel / Stop; Stop → chip under the box; Save with empty text saves "Voice note" with a play chip in the history; deleting the entry deletes its recording; voice recordings don't show in the contact's Files. Stops by itself at 3 minutes. Mic hidden on browsers without MediaRecorder.
- Home "Paste" (`home.paste-claude`): plain copied text goes into New Note; a ZUGDESK block opens "Add from paste". Pasting a block straight into New Note (long-press → Paste) opens the sheet by itself.
- Dates (both modes): Status is three one-tap buttons; When and Where are optional (a date with no time says "Time not set", history says "Date 3 arranged."); the When box is big and centred.
- Shadchan Mode while dating: one "After Date N" box (`shidduch.round`) at the top of Overview and Dates with one-tap answers per side (`shidduch.answer-guy.yes` …); side cards show no answers then; date cards show tags only. Tapping an In Progress couple in the list opens its Dates tab. "End shidduch" is red (detail foot and list actions). Watch out: `.sh-answers` and `.shs-round` are list-card classes with pointer-events:none, don't reuse them.
- Shidduch cleanup (Fable review, owner approved): no Arrange button on an Idea or while a date is ahead; an upcoming date shows once, with "Date happened"; Dates tab has only the dock's Arrange; "Add note" link only when the dock is hidden; ended shidduch shows plain answers; Single Mode uses one-tap answers, asks "Who told you?" only for their side, has "End shidduch", and dating couples open on Dates; list has no page lead, Shadchan list shows "null" nowhere.
- My Profile: in Edit facts, changing two choice lists keeps both; after "Add fact" the next fact can be typed straight away; a cancelled New short version leaves nothing behind; leaving the page with Add a fact open and coming back does not undo newer changes.
- Person card: Cancel on Edit facts with no change does not change "updated"; while a section is open the other pencils (and, in Shadchan Mode, the Status panel) hide; tabs do not swipe while editing.
- Single Mode: Reopen on a person whose shidduch ended shows New; both yes again starts a new try on the same shidduch.
- Profile pages, wording: Facts say "Marital status" and "Work / learning" on all three pages; the sender shows once ("Sent by · date"); no About text under the name; GUY/GIRL tag only in Shadchan Mode, beside the name.
- Profile pages, structure: "Photos and docs" adds and removes files right on the page on all three; an empty person shows "Add: About · What she's looking for · Inquiries and references · How I know her" and each opens its form in place; Shadchan card has Find a match in the bottom bar and a "Matching" heading; Notes tab starts with the writing box; My Profile on a computer has no left section menu, one Share button (bottom), and the same column as a person's card.
- Shadchan Mode: a single's card has Short versions (the pasted original "Original as received" word for word, Suggested, own texts); Send → Short profile text offers each of them; the outgoing phone list names the single, not "Their phone".
- Profile pages, editing: tapping a fact on a person's card opens Edit facts with that row ready; My Profile's Edit facts also lists the usual facts that are still empty (I am a, Marital status, Religious level …); short versions on a person's card have the same heading and outlined Suggested as My Profile, and Delete offers Undo; at 320 px the chosen tab stays in view.
