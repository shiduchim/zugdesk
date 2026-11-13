# Shadchan Mode — address and test round (S6)

Two things only the owner can do. Both must happen **before a real shadchan types real data**.

## 1. The address (design.md section 9)

Real data lives in the browser *under the app's address*. If the address changes later, every
user must move their data with a backup file. So pick it once, now.

Today the app is at `shiduchim.github.io/zugdesk` (GitHub Pages).

| Option | Cost | Filters (NetFree / TAG) | Work for the owner |
|---|---|---|---|
| A. Keep `…github.io` | free | Risky: a shared address; NetFree may refuse or open it slowly | none |
| B. **Own name, e.g. `zugdesk.app`, pointing at the same GitHub Pages** | about 10–20 dollars a year | Better: one address that belongs only to this app; ask NetFree to open it once | buy the name, then about 15 minutes of setup with Claude |
| C. Own name on another host (Cloudflare Pages, Netlify) | name only | same as B | more setup; no gain now |

**Recommendation: B.** Same app, same publishing, only the address changes. Do it before the test round.

Steps for B (plain language; Claude does the repo part):
1. Choose a short name and buy it at any seller (Namecheap, Porkbun, Cloudflare). `.app` or `.com`.
2. Tell Claude the name. Claude adds a `CNAME` file in `app/` and tells you the two DNS lines to type at the seller.
3. On github.com: the repo → Settings → Pages → Custom domain → type the name → Save → tick "Enforce HTTPS" when it appears (can take up to a day).
4. Open the new address on your phone, install it on the home screen again. Your own records on the old address stay there:
   on the old address make a backup (Settings → Backup), then on the new address Import it.
5. Ask one NetFree user to open the new address. If it is blocked, they request it through NetFree once.

If the owner chooses A, nothing changes, and the risk with filters stays.

## 2. Test round (3–5 shadchanim, one device each, about two weeks)

**Who:** ideally one mostly-phone, one mostly-computer, one with more than 50 singles, one behind NetFree or TAG.

**Message to send them** (copy, change the link):

> Hi! I'm testing a free app for shadchanim to keep track of singles and suggestions. Everything stays on your own phone or computer; there is no account and nobody else can see it.
> 1. Open: LINK
> 2. Settings (gear on Home) → Mode → Shadchan.
> 3. To look around first: Guys → Try the demo. These are made-up people. Settings → Remove all demo data when you're done.
> 4. Then add a few real singles you work with (Guys / Girls → Add), and use it for your next suggestions.
> 5. Please use **one device only** for now. Phone and computer together comes later.
> 6. Once a week: Settings → Backup → Make backup (pick a password you will remember; a lost password cannot be recovered).
> In two weeks I'll ask you 5 short questions. Thanks!

**What the owner checks with each tester after the first day:** it opened; Mode switch worked; they could add one single; the backup file was made and saved somewhere.

**Questions after two weeks** (short call or voice note):
1. What did you use it for this week? What did you go back to paper / WhatsApp / Excel for?
2. Was anything confusing or missing words? (A screenshot with Settings → Show labels on helps.)
3. Phone, computer or both: would you need them in step? Which cloud account do you already have (Dropbox, Google)? (This decides S7.)
4. Did your filter block anything?
5. Would you keep using it? What one change would make it a yes?

Also ask the five open questions at the end of `research.md` (section 9) if there is time.

**Write the answers** (no names, no singles' details) in a new section 3 of this file. S7 is chosen from question 3.
