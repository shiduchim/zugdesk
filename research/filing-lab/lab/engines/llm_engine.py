"""Engine B — a small generative language model, run by llama.cpp on this computer.

The model reads the note and writes the interpretation as JSON. Its output is forced to follow a
JSON schema (llama.cpp "grammar-constrained decoding"), so it can only use the allowed words for
roles, activity types and answers — but every name, time phrase and fact is the model's own work.
No rules here read the note.

The model runs inside `llama-server` (llama.cpp's own local server, bound to 127.0.0.1). This module
starts it, talks to it over localhost, and stops it.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROLES = ["shadchan", "single", "reference", "family", "other"]
EVENT_TYPES = ["call", "message", "meeting", "date", "suggestion", "effort", "profile_sent",
               "profile_received", "reference_check", "request", "promise", "note"]
ANSWERS = ["yes", "no", "thinking", "more_info"]

S = {"type": ["string", "null"], "maxLength": 80}
NAME = {"type": "string", "maxLength": 60}
JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "people": {"type": "array", "maxItems": 6, "items": {"type": "object", "properties": {
            "name": NAME, "role": {"enum": ROLES}, "of": S},
            "required": ["name", "role", "of"]}},
        "events": {"type": "array", "maxItems": 4, "items": {"type": "object", "properties": {
            "type": {"enum": EVENT_TYPES}, "actor": S, "with": S, "about": S, "result": S,
            "count": {"type": ["integer", "null"]}, "when": S, "negated": {"type": "boolean"}},
            "required": ["type", "actor", "with", "about", "result", "count", "when", "negated"]}},
        "answers": {"type": "array", "maxItems": 3, "items": {"type": "object", "properties": {
            "of": NAME, "about": S, "value": {"enum": ANSWERS}, "source": S},
            "required": ["of", "about", "value", "source"]}},
        "tasks": {"type": "array", "maxItems": 3, "items": {"type": "object", "properties": {
            "who": S, "what": {"type": "string", "maxLength": 60}, "when": S}, "required": ["who", "what", "when"]}},
        "waiting": {"type": "array", "maxItems": 3, "items": {"type": "object", "properties": {
            "who": NAME, "what": S, "when": S}, "required": ["who", "what", "when"]}},
        "uncertain": {"type": "array", "maxItems": 3, "items": {"type": "string", "maxLength": 80}},
    },
    "required": ["people", "events", "answers", "tasks", "waiting", "uncertain"],
}

SYSTEM_PROMPT = """You read ONE short note that a single person (the user, "me") typed into a private shidduch organizer, and you return JSON describing only what the note says.

Rules:
- Never add a name, date, answer, number or fact that is not in the note. If something is not stated, use null or leave the list empty.
- Copy names exactly as written ("Mrs. Cohen", "Rivky", "Leah's reference"). Do not invent surnames.
- "me" means the user. Do not list the user in people.
- Groups and amounts are not people ("three families", "nobody", "someone", "a girl").

people: every person named or described by relation ("David", "Mrs. Levin", "Rivka's mother", "Leah's reference").
  role: shadchan (matchmaker, or a friend who suggests, arranges or passes on news) | single (a possible match, or someone looking for a shidduch) | reference | family (a relative; put whose relative in "of") | other.
events: what happened. type: call | message | meeting | date | suggestion (someone suggested a single) | effort (a shadchan worked on finding someone) | profile_sent (I sent my profile) | profile_received | reference_check | request (someone asked for something) | promise (someone said they will do something) | note.
  actor = who did it ("me" for the user); with = the other side; about = the single it concerns; result = the outcome in the note's words; count = a number given in the note; when = the time words as written; negated = true if the note says it did not happen or not yet.
answers: only when the note reports someone's answer about a shidduch. of = whose answer ("me" for the user); about = the single (when of is "me"); value: yes | no | thinking (needs time, undecided) | more_info (wants more information); source = who told the user, if second-hand. If the answer is not known yet, or the note says it was not asked, add NO answer.
tasks: things the USER must do, only if the note asks for it: who = the person to contact; what = the action; when = the time words as written ("tomorrow", "in two days", "by Thursday"), or null.
waiting: when SOMEONE ELSE will contact the user or get back to them: who; what; when (time words as written).
uncertain: anything the note leaves open, in a few words."""

FEW_SHOT = [
    ("Yehuda texted me that Mrs. Rosen's idea fell through. Remind me to call him Sunday.",
     {"people": [{"name": "Yehuda", "role": "other", "of": None}, {"name": "Mrs. Rosen", "role": "shadchan", "of": None}],
      "events": [{"type": "message", "actor": "Yehuda", "with": "me", "about": None, "result": "Mrs. Rosen's idea fell through", "count": None, "when": None, "negated": False}],
      "answers": [], "tasks": [{"who": "Yehuda", "what": "call", "when": "Sunday"}], "waiting": [], "uncertain": []}),
    ("Mrs. Blum said Chavi's parents haven't decided yet, she'll update me after Yom Tov.",
     {"people": [{"name": "Mrs. Blum", "role": "shadchan", "of": None}, {"name": "Chavi's parents", "role": "family", "of": "Chavi"}, {"name": "Chavi", "role": "single", "of": None}],
      "events": [], "answers": [], "tasks": [],
      "waiting": [{"who": "Mrs. Blum", "what": "update me", "when": "after Yom Tov"}],
      "uncertain": ["whether Chavi's parents agree"]}),
    ("Ari's sister told me Chavi said no. Sent my profile to Mrs. Blum.",
     {"people": [{"name": "Ari's sister", "role": "family", "of": "Ari"}, {"name": "Chavi", "role": "single", "of": None}, {"name": "Mrs. Blum", "role": "shadchan", "of": None}],
      "events": [{"type": "profile_sent", "actor": "me", "with": "Mrs. Blum", "about": None, "result": None, "count": None, "when": None, "negated": False}],
      "answers": [{"of": "Chavi", "about": None, "value": "no", "source": "Ari's sister"}],
      "tasks": [], "waiting": [], "uncertain": []}),
]


def build_messages(text: str):
    msgs = [{"role": "system", "content": SYSTEM_PROMPT}]
    for note, out in FEW_SHOT:
        msgs.append({"role": "user", "content": note})
        msgs.append({"role": "assistant", "content": json.dumps(out, ensure_ascii=False)})
    msgs.append({"role": "user", "content": text})
    return msgs


# NuExtract models use their own template format instead of a chat prompt.
NUEXTRACT_TEMPLATE = {
    "people": [{"name": "verbatim-string", "role": ROLES, "of": "verbatim-string"}],
    "events": [{"type": EVENT_TYPES, "actor": "string", "with": "string", "about": "verbatim-string",
                "result": "verbatim-string", "count": "integer", "when": "verbatim-string", "negated": ["true", "false"]}],
    "answers": [{"of": "string", "about": "verbatim-string", "value": ANSWERS, "source": "verbatim-string"}],
    "tasks": [{"who": "verbatim-string", "what": "string", "when": "verbatim-string"}],
    "waiting": [{"who": "verbatim-string", "what": "string", "when": "verbatim-string"}],
    "uncertain": ["string"],
}


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def find_llama_server(root: Path) -> str | None:
    names = ["llama-server.exe", "llama-server"]
    for d in [root / "tools" / "llama.cpp", root / "tools" / "llama.cpp" / "bin", root / "tools"]:
        for n in names:
            if (d / n).exists():
                return str(d / n)
    for n in names:
        p = shutil.which(n)
        if p:
            return p
    env = os.environ.get("LLAMA_SERVER")
    return env if env and Path(env).exists() else None


class LlamaServerEngine:
    """Runs one GGUF model in a local llama-server process and asks it for the interpretation."""

    def __init__(self, root: Path, model_path: Path, style: str = "chat", threads: int | None = None,
                 ctx: int = 4096, gpu_layers: int = 0, label: str | None = None):
        self.root = root
        self.model_path = Path(model_path)
        self.style = style
        self.threads = threads or max(1, (os.cpu_count() or 4))
        self.ctx = ctx
        self.gpu_layers = gpu_layers
        self.label = label or self.model_path.stem
        self.proc: subprocess.Popen | None = None
        self.port = None
        self.load_seconds = None

    # -- process ---------------------------------------------------------------------------
    def start(self):
        if self.proc and self.proc.poll() is None:
            return
        exe = find_llama_server(self.root)
        if not exe:
            raise RuntimeError("llama-server was not found. Run the installer (it downloads llama.cpp) "
                               "or put llama-server(.exe) in tools/llama.cpp/.")
        if not self.model_path.exists():
            raise RuntimeError(f"Model file not found: {self.model_path}. Run the model download step.")
        self.port = _free_port()
        args = [exe, "-m", str(self.model_path), "--host", "127.0.0.1", "--port", str(self.port),
                "-c", str(self.ctx), "-t", str(self.threads), "-ngl", str(self.gpu_layers),
                "--no-webui", "-np", "1", "--jinja"]
        t0 = time.time()
        creation = 0x08000000 if sys.platform == "win32" else 0  # CREATE_NO_WINDOW
        self.log = open(self.root / "models" / f"llama-server-{self.label}.log", "w", encoding="utf-8")
        self.proc = subprocess.Popen(args, stdout=self.log, stderr=subprocess.STDOUT, creationflags=creation)
        for _ in range(600):
            if self.proc.poll() is not None:
                raise RuntimeError(f"llama-server stopped while loading {self.model_path.name}; see models/llama-server-{self.label}.log")
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{self.port}/health", timeout=1) as r:
                    if r.status == 200:
                        break
            except Exception:
                time.sleep(0.25)
        else:
            raise RuntimeError("llama-server did not become ready in time")
        self.load_seconds = round(time.time() - t0, 2)

    def stop(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(10)
            except Exception:
                self.proc.kill()
        self.proc = None

    def pid(self):
        return self.proc.pid if self.proc else None

    # -- inference -------------------------------------------------------------------------
    def _post(self, path, body, timeout=300):
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}{path}", data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))

    def analyze(self, text: str):
        self.start()
        t0 = time.perf_counter()
        if self.style == "nuextract":
            template = json.dumps(NUEXTRACT_TEMPLATE, indent=2)
            body = {"messages": [{"role": "user", "content": f"# Template:\n{template}\n# Context:\n{text}"}],
                    "temperature": 0, "max_tokens": 700, "cache_prompt": True,
                    "response_format": {"type": "json_schema", "json_schema": {"schema": JSON_SCHEMA}}}
        else:
            body = {"messages": build_messages(text), "temperature": 0, "top_k": 1, "max_tokens": 700,
                    "cache_prompt": True, "chat_template_kwargs": {"enable_thinking": False},
                    "response_format": {"type": "json_schema", "json_schema": {"schema": JSON_SCHEMA}}}
        out = self._post("/v1/chat/completions", body)
        ms = (time.perf_counter() - t0) * 1000
        raw = out["choices"][0]["message"].get("content") or ""
        usage = out.get("usage", {})
        timings = out.get("timings", {})
        answer = re.sub(r"^\s*<think>.*?</think>\s*", "", raw, flags=re.S)  # empty thinking marker, not the answer
        try:
            ir = json.loads(answer)
            error = None
        except Exception as e:  # the grammar makes this rare, but a cut-off answer is possible
            ir, error = None, f"model output was not valid JSON: {e}"
        if ir is not None:
            for e in ir.get("events", []):
                e.setdefault("source", None)
        return {"ir": ir, "raw": raw, "ms": round(ms, 1), "error": error,
                "tokens_in": usage.get("prompt_tokens"), "tokens_out": usage.get("completion_tokens"),
                "gen_tps": round(timings.get("predicted_per_second", 0), 1) if timings else None}
