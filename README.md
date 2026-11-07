# ZugDesk

Working prototype of **ZivugMatch Single Mode** — a phone-first app to organize shadchanim,
suggested people, offers, dates and notes. Plain HTML/CSS/JS, no build step.

- `app/` — the app (published automatically to GitHub Pages from the `app/` folder)
- `spec/` — design spec, one file per area · `source/` — original designs (read-only)
- `ROADMAP.md` — stages and status · `CLAUDE.md` — notes for Claude

## Run locally

```bash
python3 -m http.server 8123
```

Then open <http://localhost:8123/app/index.html>.

## Check on phone widths

Playwright is used for walkthroughs at 320 / 360 / 390 px (see Stage notes in `ROADMAP.md`).
All data lives in the browser (IndexedDB). Settings → Export backup saves it to a file.
