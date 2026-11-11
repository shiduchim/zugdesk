---
description: Consolidate a long-running project so I can /clear and continue from a clean state
---
Goal: after this I will /clear. Keep everything important; drop clutter. Do NOT change how the app works.
1. /checkpoint first (commit + push).
2. Collect important findings and decisions from this chat, spec/build-handoff.md (section "Session handoff") and old notes. Put permanent ones in CLAUDE.md as short bullets added BELOW the existing rules (architecture, design decisions, "tried and rejected", known gotchas); never change or remove existing rules. Put unfinished work in the "Session handoff" section at the bottom of spec/build-handoff.md.
3. Delete files that are clearly old/unused (old copies, backups, "_old"/"Copy" files, abandoned experiments, outdated notes) without asking. NEVER delete or edit anything in source/ or spec/ (except the Session handoff section), and never touch app/. Only ask me about files you're not sure about. At the end, list what you deleted (one line each) so I can restore any from Git.
4. Run /check to prove the app still works.
5. Commit + push, then tell me: "Safe to /clear. After clearing, type: Continue from the Session handoff in spec/build-handoff.md".
