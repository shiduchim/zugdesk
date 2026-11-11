# Filing lab — status notes

Research prototype only; not part of `app/`. All data is made up.

## Quick start
- Open `dist/ZivugMatch-Filing-Lab.html` in Chrome or Edge (double-click). No install.
- Engine C (no AI) works instantly. Engines A/B download a model once (WebGPU), then work offline.
- PC kit (GLiNER2.5 + llama.cpp): `INSTALL-WINDOWS.bat`, then `START-WINDOWS.bat`. See README.md.

## Results so far
- Filing step on the correct understanding: 130/130 filed right.
- Engine C (no AI), 35 unseen English notes: 89% filed right, 0 invented facts, under 1 ms.
- Engines A/B: Benchmark tab → Holdout → "Run now". Qwen3 0.6B ran on the owner's PC (~4 s per note).

## Comments from testing
- Fixed: Windows installer broke on PowerShell 5.1 (UTF-8 dashes); script is now ASCII only.
- Fixed: Qwen3 answers start with an empty `<think></think>` marker; it is removed before reading.
- Fixed: loading a 2B model with another model in GPU memory gave "Model not loaded"; now detected,
  other models are freed and it retries once (not yet seen on a real memory failure).
- Not done: A/B benchmark numbers were never recorded. GLiNER2.5 only runs in the PC kit.
- Recommendation: build filing on the no-AI design (context-first entry, name chips, state buttons,
  one shared filing step); add AI only if it beats Engine C on the holdout set. See REPORT.md.
