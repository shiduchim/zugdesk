# ZivugMatch filing engine — findings (Oct 2026)

All data in this work is made up. Nothing was taken from, or written to, your GitHub repositories.

## The short version

1. **The hard part is filing, not reading.** Once a note is understood correctly, ordinary app logic
   files it right every time: **130 of 130** test notes, including both Mrs. Cohens, both Rivkas,
   "the Sarah I met last year" and "Leah's reference". This filing step is shared by every engine, so the
   choice of engine only affects understanding.
2. **No AI (Engine C) is stronger than expected.** On 35 English notes it had never seen, it filed
   **89%** right with **zero invented facts**, in under 1 ms, with nothing to download. It works on any phone
   today, NetSpark included. Its misses are unusual phrasings of reminders ("gotta call rabbi stein back tmrw",
   "will do it tomorrow").
3. **The two AI engines are built and wired up, but their accuracy is not measured yet.** This cloud
   sandbox's network policy blocks huggingface.co, where the model files are. Both code paths were run
   end to end with random-weight stand-in models, which proves the plumbing works; it says nothing about
   accuracy. **On your Windows PC the installer downloads the real models**, and the lab's Benchmark tab
   produces the numbers below for A and B in a few minutes. If you allow huggingface.co in this
   environment, I can run them here instead.
4. **Recommendation so far:** build ZivugMatch's filing on the no-AI design (context-first entry + name chips
   + the shared filing step), and treat AI as an optional "smart reading" add-on. Adopt the add-on only if it
   beats Engine C on the **holdout** set (rule in Part D).

---

## Part A — Model comparison

Checked to exist as of Oct 2026 (the PyPI package, model cards and release notes). RAM and speed figures
are estimates for a normal 4–8 core laptop, **not measurements**.

| Candidate | Kind | Size (download) | Hebrew / Russian | License | Phone path | Verdict |
|---|---|---|---|---|---|---|
| **GLiNER2.5 Small** (`fastino/gliner2.5-small-v1`, Aug 2026, 74M) | extraction encoder: people, labels, records, relations, attributes in one pass | ≈ 300 MB fp32, ≈ 80–100 MB int8 | no (English) | Apache-2.0 | ONNX in the browser, but needs a JS port of its pre/post-processing | **Engine A** |
| GLiNER2.5 Base (194M) / **Multi** (287M, mDeBERTa) | same, larger / multilingual | 0.8 / 1.1 GB | Multi: yes | Apache-2.0 | heavier | variants in the lab |
| GLiNER multi v2.1, GLiNER-X | names only (NER) | 0.2–0.8 GB | yes | Apache-2.0 | yes | can't do roles or answers alone |
| NuExtract-tiny 1.5 (0.5B) · **NuExtract 2.0 2B** | generative extractor with templates | 0.4 · ≈ 1.2 GB | yes | MIT | heavy | in the lab as a B variant |
| **LFM2-1.2B-Extract** (Liquid AI) | generative extractor | ≈ 0.7 GB | not listed | LFM Open License (free under $10M revenue) | WebGPU/ONNX exists | B variant; weak on Hebrew |
| Gemma 3 270M | tiny general model | ≈ 0.3 GB | some | Gemma Terms | yes | needs fine-tuning first; B variant |
| Qwen3 0.6B / **1.7B** / 4B-Instruct-2507 | small general models + JSON grammar | 0.6 / **1.1** / 2.5 GB | yes (119 languages) | Apache-2.0 | 0.6B borderline, 1.7B too big for many phones | **Engine B** (1.7B default) |
| Qwen3.5 0.8B / 2B (Mar 2026) | newer small multimodal | 0.6 / 1.3 GB | yes | Apache-2.0 | as above | B variants; the 2B scores below Qwen3 1.7B on instruction-following (IFEval 61 vs 68) |
| Gemma 4 E2B | small general model | ≈ 3 GB | yes | Apache-2.0 | too big | not included |

**Why these two.** They are the two genuinely different ways to do this offline:

- **A: a tiny specialised extractor (GLiNER2.5).** One fast pass; it can only point at words in the note
  or choose from labels we give it, so it **cannot invent** a name or date. It is fine-tunable with small
  LoRA adapters. Risk: telling "who reported whose answer" apart may be beyond a 74M model without training.
- **B: a small general language model forced into JSON (Qwen3 1.7B on llama.cpp).** It understands phrasing
  best and covers Hebrew and Russian, but it can hallucinate. The JSON grammar fixes the format, not the
  facts. It is ~15× bigger and needs seconds per note on a CPU.

The lab can switch B to 0.6B (tiny) or 4B (larger) to answer "is tiny enough or is bigger meaningfully
better", and A to Base or Multi.

## Part B — The prototype

See `README.md`. One local page; Engines A, B, C or **Compare**; 14 fictional contacts and 5 shidduchim;
"typing from" a person's page; the real model output under every card. Windows: `INSTALL-WINDOWS.bat`
once, then `START-WINDOWS.bat`. Offline after install. The header counts outside network connections.

## Part C — Benchmark

**Test notes.** 93 development notes: your 12 examples, 47 variations (typos, nicknames, "Mrs Kohen", "call
michael on the 20th"…), 28 unseen kinds (incl. your 8 from §11) and 6 Hebrew/Russian. Then **37 holdout
notes**, written *after* Engine C's rules were frozen (hashes in `bench/frozen-before-holdout.sha256`) and
before any model ran: run-ons, slang ("shayach", "redt", "tmrw"), lower case, "the Cohen lady from Brooklyn",
"her niece Bracha" (not Bracha Gross)…

**Two scores per note.** *Understood fully*: people and roles, activity type, answers with who reported
them, reminders with the right date, waiting-for, and nothing invented, all compared with the correct
answer, with no filing rules involved. *Filed right*: the expected actions happen (right record, right
tier) and none of the forbidden ones (no silent guess between two Cohens, no changing my answer, no
imaginary "three families" contacts).
**Blame.** The filing step is also run on the *correct* interpretation. It got 130/130 right, so every
filing failure below comes from the engine's understanding.

### Engine C — no AI (measured)

| | Development (87, tuned on) | **Holdout (35, unseen)** |
|---|---|---|
| Understood fully | 100% | **63%** |
| Activity type | 100% | 84% |
| People & roles | 100% | 86% |
| Negation / "not yet" | 100% | **100%** |
| Reminders & waiting correct | 100% | **56%** |
| No reminder nobody asked for | 100% | 100% |
| Who reported it | 100% | 50% |
| Notes with invented facts | 0% | **0%** |
| **Filed right** | 100% | **89%** |
| Taps per note (Save + choices + OKs + fixes) | 1.5 | 1.8 |
| Speed | 0.6 ms | 0.9 ms |
| Hebrew/Russian filed right | 6/6 (saved names only) | 1/2 |

The 100% development score is not a real result. I fixed the rules while looking at those notes. The holdout
column is the honest one.

**What it misunderstood (holdout)** — every one is a phrasing the word lists didn't cover:
- "gotta call rabbi stein back tmrw" → logged a call instead of a reminder (doesn't know "gotta")
- "Didn't get to call Mrs. Feld today, will do it tomorrow." → no reminder
- "Tell Michael the Klein idea is off for good" → no reminder ("tell" isn't a to-do verb in its list)
- "she's going to look into the Monsey family and get back to me Thursday" → missed "waiting for Mrs. Levin"
- "Михаил сказал, что Дина согласна." → missed the answer (Russian answers are not in its lists)

When it is wrong, it leaves things out. It never made anything up: no invented people, answers or dates.
Every miss shows up as a missing item, which you fix with one tap. An AI model can be wrong the other way:
confident and specific.

### Engines A and B (not measured yet)

Blocked by this sandbox's network policy (no huggingface.co). On your PC: INSTALL, then Benchmark →
Holdout set → **Run now on this computer** (or `lab\run_bench.py`). The table fills in with the same
columns, plus RAM, model load time and median time per note.

What *was* verified here with random-weight stand-ins: GLiNER2.5's library accepts the full schema
(people + role attribute, activity labels, "not yet" detection, activity/answer/to-do/waiting records)
and the adapter reads its real output format; llama.cpp's server loads, applies the JSON schema, and always
returns valid JSON in the shared format.

## Part 11 — Without AI: the best non-AI design

Engine C's rules are only half of it. Most of the gain comes from **not having to guess**:

1. **Write where it happened.** Typing on Leah's page, or in the "Call ended — what happened?" card that
   PeerMatch already has, gives the destination for free. Proof in the benchmark: "Reference didn't answer,
   call tomorrow." from Home needs a choice ("whose reference?"). The same note on Leah's page files with
   **one tap**, reminder included.
2. **Name chips while typing** (like @-mentions). Names turn into chips bound to a contact as you type.
   Two Mrs. Cohens become two chips to tap, with city and last contact shown. The ambiguity is settled
   while you type, not in a review screen afterwards.
3. **Date chips**, Todoist-style: "in two days" is underlined as **Wed Oct 14** as you type. Vague words
   ("soon", "next week") ask for a day instead of inventing one.
4. **Buttons from the record's state.** Each person or shidduch shows the 3–4 things that can happen next:
   Leah (waiting for her answer): *She said yes · She said no · Still thinking*. Mrs. Cohen (looking for
   me): *Has an idea · Nothing yet · Will call me…*. A reference: *No answer — retry tomorrow · Good ·
   Concerns*. One tap files it, and the typed words go along as the note.
5. **The same filing step** as the AI engines: one tap for routine items, a separate OK for answers,
   stages and new contacts. The original is always kept.

**A fourth approach: open loops instead of categories.** Almost every note in the benchmark is an
update to something already open: waiting for Leah's answer, Mrs. Cohen working on it, references to
call, waiting for Mrs. Levin. If the app's organising unit is the **open loop** (what I'm waiting for and
what I owe, per person), filing a note becomes "which of this person's 1–3 open loops does it advance?".
That is an easy choice for rules, for a tiny model, or for one tap. Closing loops also gives Home its
list: "No answer from Mrs. Levin in 6 days".

**Hybrid.** Run Engine C instantly as you type. Only when it finds no activity or answer, or a phrase it
doesn't know, offer the optional model's reading as chips to accept. The model never decides alone.

### All three compared

| | A · GLiNER2.5 Small | B · Qwen3 1.7B | C · no AI + context |
|---|---|---|---|
| Filed right (holdout) | *run on your PC* | *run on your PC* | 89% |
| Invented facts | can't invent text (only marks words) | possible | 0% measured |
| Speed per note | ≈ 0.1–0.5 s (est.) | ≈ 3–10 s on CPU (est.) | < 1 ms |
| Download | ≈ 0.3 GB + PyTorch (≈ 0.1 GB int8 on a phone) | ≈ 1.1 GB | 0 |
| RAM | ≈ 1 GB on a PC (est.) | ≈ 1.5–2 GB (est.) | negligible |
| Phone today | needs a JS port (weeks) | too heavy for many phones | works now |
| Hebrew / Russian | Multi variant (287M) | yes | saved names + dates only |
| Keeping it working | retrain/adapter per change | prompt changes, re-test | add words; tests catch breaks |
| Privacy | local | local | local |

## Part D — Recommendation

1. **Build the no-AI design first** (Part 11, items 1–5) on top of the shared filing step. It is the
   only option that runs on your phone today, it is instant, and it measured 89% filed right on unseen
   notes with nothing invented. It also needs no model download through NetSpark.
2. **Decide on AI with numbers, not hopes.** Run A and B on the holdout set in the lab. Add an engine as
   the optional "smart reading" pack only if, on the holdout set, it:
   - beats Engine C's 89% filed-right by at least ~5 points,
   - has an invented-facts rate no higher than C's, and
   - fits a phone (≲ 150 MB download, ≲ 1 s per note).

   Only GLiNER2.5 Small can plausibly meet the size limit. A 1.7B model may understand odd phrasing
   better, but at 1.1 GB and several seconds per note it belongs on a PC, or as an opt-in.
3. Whatever wins, **the filing step stays the single owner** of where things go and what needs approval.

## Part 9 — Getting better over time without collecting conversations

Easiest first:

1. **Corrections become personal rules, on the device.** When you fix a result ("Rivky" is Rivka Adler,
   "shayach" means yes), it is saved as a word-list entry in your own data. It is backed up with
   everything else and never sent anywhere.
2. **Synthetic training notes.** Generate thousands of made-up notes from templates plus paraphrases
   (offline, on a developer's PC), labelled in the lab's format. Use them to fine-tune GLiNER2.5 Small with a
   LoRA adapter of a few MB, or a 0.5–0.6B model. A June 2026 study (arXiv 2606.22606) found a fine-tuned
   0.5B model beat zero-shot frontier models on relation extraction. The gain came from task training, not
   model size.
3. **Ship improvements as small downloads** (a new adapter or word list). Every update must pass this
   benchmark before release; an update that scores worse does not ship.
4. **Optional contributions, opt-in, one at a time:** never the text. At most the *pattern* ("‹shadchan›
   told me ‹single› agreed"), with names replaced, which you read before sharing.

## Part E — Fitting it into ZivugBase (browser app, phone)

- `planner.js`, `names.js` and `dates.js` are plain JavaScript with no dependencies. They become one
  TypeScript module (the "understanding layer" owner from PLAN §8.6) that reads Dexie data instead of
  `world.json`. Mapping: history → `Activity` with `linkKeys` (`p:` and `i:`) · reminder → `nextStep` ·
  waiting → `waitingSince` · answer → `Idea.answers` · stage → `Idea.status` · new contact → `Person` with
  name and role only · original note → `Activity.text` / `InboxItem.text`, unchanged.
- Engine C runs on the main thread (< 1 ms). It powers the note bar, the after-call card and Paste/Speak.
- Optional AI on the phone: GLiNER2.5 Small exported to ONNX int8 (≈ 80–100 MB) and run with
  onnxruntime-web in a Web Worker. The files would be **self-hosted on the app's own site**, split into
  pieces under GitHub Pages' 100 MB per-file limit, because NetSpark may block Hugging Face and the repo
  rule is "no CDNs". The JS port of GLiNER2's input and decoding steps is the main work.
  A llama.cpp-in-WASM option (wllama) exists for B but is too heavy for most phones.
- Phone voice typing feeds the same box, so nothing extra is needed for speech.

## Limits of this work

- The A/B accuracy columns are empty because of this environment's network block, not because the
  engines fail. Treat any A/B opinion here as a hypothesis until the lab measures it.
- 130 notes is a small test set, all written by one person (me). Your own real phrasings, anonymised,
  are the most valuable addition (PLAN §8.6).
- Tap counts use a fixed rule (Save + 1 per choice + 1 per OK + 2 per fix), not timed users.
- Nothing here has been tested on your phone.
