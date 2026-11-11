# Tests & checks

## Automatic (Claude runs these; no build step, no npm)
- Syntax of every module: `for f in app/js/*.js app/pages/*.js; do node --input-type=module --check < $f || echo FAIL $f; done` (prints nothing but FAIL lines on error)
- No raw colours or numeric corners/shadows in page code: `grep -rnE '#[0-9a-fA-F]{3,6}\b|rgba?\(|border-radius: ?[0-9]|box-shadow: ?[0-9]' app/pages app/js` (tokens.css is allowed to define them)
- No visible plus signs: `grep -rn '"+ \|>+ \|+ Add' app/pages app/js`
- Pages load with no console errors at 360 px and 390 px wide (Playwright, as in CLAUDE.md)
- Every new button or section has a `data-id` label, and labels are unique

## Manual (I check on my phone)
- [ ] Close and reopen the app: it loads, Home shows
- [ ] Settings → Show labels shows names on buttons
- [ ] Ideas: Active / Open / Closed tabs show the right people
- [ ] Shidduchim: Offers / In Progress / Ended lanes work
- [ ] Add a person and a shadchan; they appear in the lists

## Regression (add one line per fixed bug or approved feature)
- Ending a shidduch moves the person out of Ideas → Active into Closed ("Shidduch ended"); Reopen puts them back in Open.
- Ideas → Open rows have "I'm not interested" and "She/He is not interested" buttons; the person card shows the same choice.
