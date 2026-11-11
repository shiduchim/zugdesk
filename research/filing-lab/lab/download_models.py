"""Download the lab's models once. After this, everything runs offline.

  python lab/download_models.py                 # the default Engine A and Engine B models
  python lab/download_models.py --all           # every model in lab/models.json
  python lab/download_models.py qwen3-4b-2507   # one model by id

Files go to models/<id>/. Only model files are downloaded; your notes never leave the computer.
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODELS = json.loads((ROOT / "lab" / "models.json").read_text(encoding="utf-8"))


def all_models():
    for eng in ("A", "B"):
        for m in MODELS[eng]:
            yield eng, m


def local_path(m) -> Path | None:
    d = ROOT / "models" / m["id"]
    if m["kind"] == "gliner":
        return d if (d / "config.json").exists() else None
    ggufs = sorted(d.glob("*.gguf")) if d.exists() else []
    ggufs = [g for g in ggufs if "mmproj" not in g.name.lower()]
    return ggufs[0] if ggufs else None


def download(m) -> Path:
    from huggingface_hub import HfApi, hf_hub_download, snapshot_download
    api = HfApi()
    dest = ROOT / "models" / m["id"]
    dest.mkdir(parents=True, exist_ok=True)
    last = None
    for repo in m["repos"]:
        try:
            files = api.list_repo_files(repo)
        except Exception as e:  # noqa: BLE001
            last = e
            print(f"  {repo}: not available ({type(e).__name__})")
            continue
        if m["kind"] == "gliner":
            snapshot_download(repo, local_dir=str(dest), allow_patterns=["*.json", "*.safetensors", "*.model", "*.txt", "*.md", "*.bin"])
            return dest
        for pat in [m.get("file"), m.get("fallback_file")]:
            if not pat:
                continue
            hits = [f for f in files if f.lower().endswith(".gguf") and fnmatch.fnmatch(f.lower(), f"*{pat.lower()}*")
                    and "mmproj" not in f.lower()]
            if hits:
                hits.sort(key=len)
                print(f"  {repo}: {hits[0]}")
                p = hf_hub_download(repo, hits[0], local_dir=str(dest))
                return Path(p)
        last = RuntimeError(f"no file like *{m.get('file')}*.gguf in {repo}")
        print(f"  {repo}: {last}")
    raise RuntimeError(f"could not download {m['id']}: {last}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    chosen = [(e, m) for e, m in all_models() if (a.all or (m["id"] in a.ids) or (not a.ids and m.get("default")))]
    if not chosen:
        print("No model matches. Ids:", ", ".join(m["id"] for _, m in all_models()))
        return 1
    bad = 0
    for eng, m in chosen:
        have = local_path(m)
        if have:
            print(f"[{eng}] {m['label']}: already here ({have.relative_to(ROOT)})")
            continue
        print(f"[{eng}] downloading {m['label']} …")
        try:
            p = download(m)
            print(f"      saved to {p.relative_to(ROOT)}")
        except Exception as e:  # noqa: BLE001
            bad += 1
            print(f"      FAILED: {e}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
