---
description: Consolidate a long-running project so I can /clear and continue from a clean state
---
Goal: after this I will /clear. Keep everything important; drop clutter. Do NOT change how the app works.
The handoff file in this repo is the "## Session handoff" section at the top of `spec/build-handoff.md`.
1. /checkpoint first (commit + push).
2. Collect important findings and decisions from this chat, the Session handoff section and old notes. Put permanent ones in CLAUDE.md (short bullets: architecture, design decisions, "tried and rejected", known gotchas). Put unfinished work in the Session handoff section of spec/build-handoff.md (never rewrite the spec text below it).
3. Delete files that are clearly old/unused (old copies, backups, "_old"/"Copy" files, abandoned experiments, outdated notes) without asking. Only ask me about files you're not sure about. Never delete working code or anything the app uses. **Never delete or edit anything in `source/` or `spec/`.** At the end, list what you deleted (one line each) so I can restore any from Git.
4. Run /check to prove the app still works.
5. Commit + push, then tell me: "Safe to /clear. After clearing, type: Continue from spec/build-handoff.md".
