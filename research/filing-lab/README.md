# ZivugMatch filing lab

A small test bench, not an app. Type what happened ("Rivka told me Leah agreed to go out") and see
what three engines understand, and where ZivugMatch would file it:

| | Engine | What it is | Size on disk |
|---|---|---|---|
| **A** | GLiNER2.5 Small (74M) | a tiny extraction model (encoder). Only marks words of the note or picks labels; cannot invent text | ≈ 0.3 GB (+ PyTorch) |
| **B** | Qwen3 1.7B, via llama.cpp | a small language model that writes the interpretation as JSON, forced to a fixed format | ≈ 1.1 GB |
| **C** | no AI | word lists + sentence rules + your saved contacts; runs in the page itself | 0 |

Everything uses **made-up people only** (`web/world.json`): two Mrs. Cohens, two Rivkas, a few shidduchim.
Nothing is saved; the lab only shows what *would* happen.

## Windows (first test)

Needs Windows 10 or 11 (64-bit), about **5 GB** free disk, **8 GB RAM** recommended. No admin rights.

1. Unzip the folder anywhere (e.g. `Documents\zivugmatch-filing-lab`).
   If Windows says "Windows protected your PC" for a `.bat` file: **More info → Run anyway**
   (or right-click the zip → Properties → **Unblock** before unzipping).
2. Double-click **`INSTALL-WINDOWS.bat`** — once, with internet (10–20 minutes).
   It installs, inside this folder only:
   - Python 3.12 and the libraries (PyTorch CPU, GLiNER2) via [uv](https://docs.astral.sh/uv/)
   - `llama-server.exe` from the official [llama.cpp releases](https://github.com/ggml-org/llama.cpp/releases)
   - the two models from Hugging Face (`fastino/gliner2.5-small-v1`, Qwen3-1.7B GGUF)

   Options: `INSTALL-WINDOWS.bat -AllModels` also downloads the comparison models (Qwen3 0.6B / 4B,
   Qwen3.5 0.8B / 2B, GLiNER2.5 Base / Multi, NuExtract 2.0 2B, LFM2 1.2B Extract, Gemma 3 270M — several GB).
   `-Gpu` uses the Vulkan (graphics card) build of llama.cpp; then start with `set LAB_GPU_LAYERS=99`.
3. **Test offline:** turn Wi-Fi off (or unplug the cable).
4. Double-click **`START-WINDOWS.bat`**. Your browser opens `http://127.0.0.1:8765`.
   The header should say **Offline mode · 0 outside connections**.
5. Type anything in **What happened?**, pick **Engine A / B / C** or **Compare**, press **Analyze**.
   The first Analyze of A or B loads the model (a few seconds).

To stop: close the black window.

### What you see for each engine

- **In the note** — the words the engine picked out.
- **What it understood** — its interpretation in plain lines.
- **People and who they are** — each name, the role the engine gave it, and which saved contact the
  filing step matched (and why).
- **Where it goes**, in four groups:
  **Saved with one tap** (history, clear reminders, waiting, profile sent) ·
  **Needs a choice** (which Mrs. Cohen? which day? is this the Sarah you met?) ·
  **Needs your OK** (someone's answer, the shidduch's stage, a new contact) ·
  **Just so you know** (not recorded: "not yet", already known…).
- **What the model actually returned** — the raw output, unedited. Failures are shown as failures.

### Benchmark tab

- **Show saved results** — the numbers measured when the lab was built (see `REPORT.md`).
- **Run now on this computer** — runs every test note through A, B and C here and scores them.
  Choose the **Holdout set** for the honest score (notes no engine was tuned on).

From a command line, the same with timing and memory saved to `bench/results/`:

```
.venv\Scripts\python lab\run_bench.py A gliner2.5-small
.venv\Scripts\python lab\run_bench.py B qwen3-1.7b --cases holdout.json
```

Then open the Benchmark tab → **Show saved results**.

## Linux / macOS

`./start.sh` (needs `curl`; on macOS it installs llama.cpp with Homebrew).

## Privacy

- The server listens on `127.0.0.1` only; other devices cannot reach it.
- The page is only allowed to talk to that local server (a Content-Security-Policy header the browser enforces).
- The model libraries run with `HF_HUB_OFFLINE=1` / `TRANSFORMERS_OFFLINE=1`; llama.cpp has no network code
  in its inference path. Internet is needed only for INSTALL (programs and model files; no notes).
- The header counts network connections from the lab to anything outside this computer.

## Files

```
INSTALL-WINDOWS.bat / START-WINDOWS.bat   one-time setup / start
lab/server.py                              local server (Python standard library)
lab/engines/gliner_engine.py               Engine A: the GLiNER schema and the output renaming
lab/engines/llm_engine.py                  Engine B: prompt, JSON schema, llama-server control
lab/models.json, lab/download_models.py    which models, and downloading them
lab/run_bench.py                           benchmark runner for A and B
web/index.html, web/js/app.js              the lab page
web/js/engine_c.js                         Engine C (no AI)
web/js/planner.js                          the filing step, shared by all engines
web/js/names.js, web/js/dates.js           name matching and date rules
web/js/score.js                            scoring
web/world.json                             the made-up contacts and shidduchim
web/cases.json, web/holdout.json           the test notes with their correct answers
tools/*.mjs                                the same scoring from the command line (Node.js)
```
