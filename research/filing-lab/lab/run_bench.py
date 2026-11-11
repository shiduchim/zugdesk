"""Run one AI engine over a test file and save its raw results (scoring happens separately).

  python lab/run_bench.py A gliner2.5-small            # web/cases.json
  python lab/run_bench.py B qwen3-1.7b --cases holdout.json

Writes bench/results/<engine>-<model>[-holdout].jsonl with, per sentence: the model's own output,
the interpretation, the time it took and the memory in use. Runs offline.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "lab"))

import server  # noqa: E402  (reuses the same engine loading as the lab page)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("engine", choices=["A", "B"])
    ap.add_argument("model")
    ap.add_argument("--cases", default="cases.json")
    ap.add_argument("--threads", type=int, default=None)
    a = ap.parse_args()
    data = json.loads((ROOT / "web" / a.cases).read_text(encoding="utf-8"))
    m, eng, _ = server.get_engine(a.engine, a.model)
    if a.threads:
        eng.threads = a.threads
    t0 = time.time()
    eng.start()
    load = round(time.time() - t0, 2)
    pid = eng.pid() if hasattr(eng, "pid") else None
    suffix = "" if a.cases == "cases.json" else "-" + Path(a.cases).stem
    out = ROOT / "bench" / "results" / f"{a.engine}-{m['id']}{suffix}.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)
    peak = 0
    lines = []
    for i, c in enumerate(data["cases"], 1):
        try:
            r = eng.analyze(c["text"])
        except Exception as e:  # noqa: BLE001 — a crash is a result too
            r = {"ir": None, "raw": None, "ms": None, "error": f"{type(e).__name__}: {e}"}
        ram = server.rss_mb(pid) if pid else server.rss_mb()
        peak = max(peak, ram or 0)
        rec = {"id": c["id"], "engine": a.engine, "model": m["id"], "ms": r.get("ms"), "ram_mb": ram,
               "ir": r.get("ir"), "raw": r.get("raw") if isinstance(r.get("raw"), str) else json.loads(json.dumps(r.get("raw"), default=str)),
               "error": r.get("error"), "tokens_out": r.get("tokens_out"), "gen_tps": r.get("gen_tps")}
        lines.append(json.dumps(rec, ensure_ascii=False))
        print(f"{i:3}/{len(data['cases'])} {c['id']:5} {r.get('ms') or 0:8.0f} ms  {'ERROR ' + r['error'] if r.get('error') else ''}", flush=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    meta = {"engine": a.engine, "model": m["id"], "label": m["label"], "load_seconds": load, "peak_ram_mb": peak,
            "cases": a.cases, "threads": getattr(eng, "threads", None), "when": time.strftime("%Y-%m-%d %H:%M"),
            "cpu_count": os.cpu_count()}
    (out.with_suffix(".meta.json")).write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print(json.dumps(meta))
    if hasattr(eng, "stop"):
        eng.stop()


if __name__ == "__main__":
    main()
