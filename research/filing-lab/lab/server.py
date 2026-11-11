"""ZivugMatch filing lab — local server.

Serves the lab page and runs the AI engines on this computer. It listens on 127.0.0.1 only
(nothing on your network can reach it) and switches the model libraries to offline mode, so no
note is ever sent anywhere.

  python lab/server.py            → http://127.0.0.1:8765
"""
from __future__ import annotations

import json
import os
import sys
import threading
import time
import traceback
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

# Offline from the start: the model libraries must not try to reach the internet.
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "lab"))

from download_models import MODELS, local_path  # noqa: E402

try:
    import psutil  # noqa: E402
except Exception:  # noqa: BLE001
    psutil = None

PORT = int(os.environ.get("LAB_PORT", "8765"))
_engines: dict[str, object] = {}
_locks: dict[str, threading.Lock] = {}
_lock = threading.Lock()


def model_entry(engine: str, model_id: str | None):
    items = MODELS[engine]
    if model_id:
        for m in items:
            if m["id"] == model_id:
                return m
        raise KeyError(f"unknown model {model_id}")
    present = [m for m in items if local_path(m)]
    for m in present:
        if m.get("default"):
            return m
    return present[0] if present else next(m for m in items if m.get("default"))


def get_engine(engine: str, model_id: str | None):
    m = model_entry(engine, model_id)
    key = f"{engine}:{m['id']}"
    with _lock:
        if key not in _engines:
            path = local_path(m)
            if not path:
                raise RuntimeError(f"{m['label']} is not downloaded yet. Run INSTALL (or: python lab/download_models.py {m['id']}).")
            if m["kind"] == "gliner":
                from engines.gliner_engine import GlinerEngine
                _engines[key] = GlinerEngine(path, label=m["id"])
            else:
                from engines.llm_engine import LlamaServerEngine
                gpu = int(os.environ.get("LAB_GPU_LAYERS", "0"))
                _engines[key] = LlamaServerEngine(ROOT, path, style=m.get("style", "chat"), label=m["id"], gpu_layers=gpu)
            _locks[key] = threading.Lock()
    return m, _engines[key], _locks[key]


def rss_mb(pid=None):
    if not psutil:
        return None
    try:
        return round(psutil.Process(pid or os.getpid()).memory_info().rss / 1e6)
    except Exception:  # noqa: BLE001
        return None


def outside_connections():
    """Network connections from this server or its model process to anything but this computer."""
    if not psutil:
        return None
    pids = [os.getpid()] + [e.pid() for e in _engines.values() if hasattr(e, "pid") and e.pid()]
    n = 0
    for pid in pids:
        try:
            for c in psutil.Process(pid).net_connections(kind="inet"):
                if c.raddr and c.raddr.ip not in ("127.0.0.1", "::1"):
                    n += 1
        except Exception:  # noqa: BLE001
            pass
    return n


def status():
    out = {"engines": {}, "offline": os.environ.get("HF_HUB_OFFLINE") == "1", "python": sys.version.split()[0],
           "server_ram_mb": rss_mb(), "outside_connections": outside_connections(), "cpu_count": os.cpu_count()}
    for eng in ("A", "B"):
        out["engines"][eng] = []
        for m in MODELS[eng]:
            p = local_path(m)
            size = None
            if p:
                size = sum(f.stat().st_size for f in (p.rglob("*") if p.is_dir() else [p]) if f.is_file())
            key = f"{eng}:{m['id']}"
            e = _engines.get(key)
            loaded = bool(e and (getattr(e, "model", None) is not None or getattr(e, "proc", None)))
            out["engines"][eng].append({**{k: m.get(k) for k in ("id", "label", "params", "license", "languages", "default")},
                                        "downloaded": bool(p), "size_mb": round(size / 1e6) if size else None,
                                        "loaded": loaded, "load_seconds": getattr(e, "load_seconds", None) if e else None,
                                        "ram_mb": (rss_mb(e.pid()) if loaded and hasattr(e, "pid") and e.pid() else None)})
    return out


def analyze(body):
    engine = body.get("engine")
    text = (body.get("text") or "").strip()
    if engine not in ("A", "B"):
        raise ValueError("engine must be A or B (Engine C runs in the page itself)")
    if not text:
        raise ValueError("empty note")
    m, e, lock = get_engine(engine, body.get("model"))
    with lock:
        before = rss_mb()
        res = e.analyze(text)
    res["engine"] = engine
    res["model"] = m["id"]
    res["model_label"] = m["label"]
    res["load_seconds"] = e.load_seconds
    res["ram_mb"] = rss_mb(e.pid()) if hasattr(e, "pid") and e.pid() else rss_mb()
    res["server_ram_before_mb"] = before
    if not isinstance(res.get("raw"), str):
        res["raw"] = json.loads(json.dumps(res["raw"], default=str))
    return res


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, fmt, *args):  # quiet
        pass

    def end_headers(self):
        # The page may only talk to this server: no outside scripts, fonts or requests.
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                         "img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, obj, code=200):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            self.path = "/web/index.html"
        elif path == "/api/status":
            return self._json(status())
        elif path == "/api/results":
            d = ROOT / "bench" / "results"
            return self._json(sorted(p.name for p in d.glob("*.jsonl")) if d.exists() else [])
        elif not (path.startswith("/web/") or path.startswith("/bench/results/")):
            self.send_error(404)
            return
        return super().do_GET()

    def do_HEAD(self):
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            self.path = "/web/index.html"
        elif not (path.startswith("/web/") or path.startswith("/bench/results/")):
            self.send_error(404)
            return
        return super().do_HEAD()

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}")
            if path == "/api/analyze":
                return self._json(analyze(body))
            if path == "/api/unload":
                with _lock:
                    for k, e in list(_engines.items()):
                        if hasattr(e, "stop"):
                            e.stop()
                        _engines.pop(k, None)
                return self._json({"ok": True})
            self.send_error(404)
        except Exception as ex:  # noqa: BLE001 — show the failure in the page, don't hide it
            self._json({"error": f"{type(ex).__name__}: {ex}", "trace": traceback.format_exc()[-1500:]}, 500)


def main():
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}/"
    print(f"\n  ZivugMatch filing lab is running at {url}\n  Close this window (or press Ctrl+C) to stop.\n")
    if os.environ.get("LAB_NO_BROWSER") != "1":
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        for e in _engines.values():
            if hasattr(e, "stop"):
                e.stop()


if __name__ == "__main__":
    main()
