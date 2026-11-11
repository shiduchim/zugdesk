"""Engine A — GLiNER2.5, a small schema-driven extraction model (an encoder, not a chatbot).

One forward pass over the note answers a schema: which spans are people, what kind of activity
it is, who reported whose answer, what the user must do, and whom the user is waiting for.
GLiNER only ever returns pieces of the note itself (spans) or one of the labels we offer, so it
cannot invent a name or a date.

`to_interpretation` only renames the model's output into the lab's shared format. It never reads
the note, so whatever is right or wrong is the model's own result.
"""
from __future__ import annotations

import time
from pathlib import Path

ACTIVITY = {
    "call": "a phone call or conversation with someone",
    "message": "a text, WhatsApp or email message",
    "meeting": "met someone in person",
    "date": "the user went out on a date with a single",
    "suggestion": "someone suggested a person as a shidduch for the user",
    "effort": "a shadchan or friend worked on finding someone for the user, contacted families or asked around",
    "profile_sent": "the user sent their own profile or resume to someone",
    "profile_received": "the user received someone's profile or resume",
    "reference_check": "the user called or heard from a reference about someone",
    "request": "someone asked the user for something or wants something from the user",
    "promise": "someone said they will do something later",
    "note": "other information",
}
ROLE_LABELS = {
    "shadchan": "matchmaker, or a friend who suggests, arranges or passes on news",
    "single": "a possible match for the user, or someone looking for a shidduch",
    "reference": "a reference who is asked about someone",
    "family": "a relative of someone, like a mother, father or sister",
    "other": "anyone else",
}
ANSWER_CHOICES = ["agreed / yes", "said no / not interested", "still thinking / needs time", "wants more information"]
ANSWER_MAP = {"agreed / yes": "yes", "said no / not interested": "no",
              "still thinking / needs time": "thinking", "wants more information": "more_info"}
CERTAINTY = {
    "happened": "the note reports something that happened or was decided",
    "not yet": "the note says something has not happened yet, was not asked, or is not known",
}


def build_schema(model, use_attributes=True, use_records=True):
    from gliner2 import AttributeGroup
    s = model.create_schema()
    s = s.entities({
        "person": "a specific person named in the note, by name, title or relation, e.g. Michael, Mrs. Cohen, "
                  "Rivka's mother, Leah's reference. Not the user and not a group like three families.",
        "time": "when something happened or should happen, e.g. tomorrow, in two days, by Thursday, next week, yesterday",
    })
    if use_attributes:
        s = s.entity_attributes({"role": AttributeGroup(list(ROLE_LABELS), applies_to=["person"], qualify_labels=True)})
    s = s.classification("activity", ACTIVITY, multi_label=True, cls_threshold=0.5)
    s = s.classification("certainty", CERTAINTY)
    if use_records:
        (s.structure("activity_record")
            .field("type", dtype="str", choices=list(ACTIVITY), description="what kind of activity")
            .field("actor", dtype="str", description="who did it; 'I' or 'me' when it was the user")
            .field("with", dtype="str", description="the other person in the activity")
            .field("about", dtype="str", description="the single the activity is about")
            .field("result", dtype="str", description="how it turned out, e.g. busy, no answer, nobody was interested")
            .field("number", dtype="str", description="a number of families, girls or people, e.g. three"))
        (s.structure("answer_report")
            .field("whose_answer", dtype="str", description="the single (or 'I') whose answer about the shidduch is reported")
            .field("answer", dtype="str", choices=ANSWER_CHOICES, description="the answer that was given")
            .field("reported_by", dtype="str", description="the person who told the user the answer"))
        (s.structure("user_task")
            .field("contact", dtype="str", description="the person the user must call, text, or send something to")
            .field("action", dtype="str", description="what the user must do, e.g. call, send references")
            .field("when", dtype="str", description="when the user must do it, e.g. tomorrow, by Thursday"))
        (s.structure("waiting_for")
            .field("person", dtype="str", description="the person who will call, text or get back to the user")
            .field("action", dtype="str", description="what they will do")
            .field("when", dtype="str", description="when they said they would"))
    return s


NUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}


def _txt(v):
    if v is None:
        return None
    if isinstance(v, dict):
        return v.get("text") or v.get("label")
    if isinstance(v, list):
        return _txt(v[0]) if v else None
    return str(v)


def _num(v):
    t = _txt(v)
    if not t:
        return None
    t = t.strip().lower()
    if t.isdigit():
        return int(t)
    return NUM.get(t)


def to_interpretation(out: dict) -> dict:
    """Rename GLiNER's output into the shared interpretation format (no reading of the note)."""
    ir = {"people": [], "events": [], "answers": [], "tasks": [], "waiting": [], "uncertain": []}
    ents = (out.get("entities") or {})
    for p in ents.get("person", []) or []:
        name = _txt(p)
        role = None
        if isinstance(p, dict) and isinstance(p.get("role"), dict):
            lab = p["role"].get("label") or ""
            role = lab.split(": ")[-1] if lab else None
        ir["people"].append({"name": name, "role": role if role in ROLE_LABELS else "other", "of": None})

    certainty = _txt(out.get("certainty"))
    negated = certainty == "not yet"
    act = out.get("activity") or []
    act_labels = [(_txt(a) if not isinstance(a, str) else a) for a in (act if isinstance(act, list) else [act])]
    records = out.get("activity_record") or []
    used_types = set()
    for r in records:
        t = _txt(r.get("type"))
        if t not in ACTIVITY:
            t = next((a for a in act_labels if a not in used_types), "note")
        used_types.add(t)
        ir["events"].append({"type": t, "actor": _txt(r.get("actor")), "with": _txt(r.get("with")),
                             "about": _txt(r.get("about")), "source": None, "result": _txt(r.get("result")),
                             "count": _num(r.get("number")), "when": None, "negated": negated})
    for a in act_labels:  # activity labels with no record of their own
        if a in ACTIVITY and a not in used_types:
            ir["events"].append({"type": a, "actor": None, "with": None, "about": None, "source": None,
                                 "result": None, "count": None, "when": None, "negated": negated})
    times = [_txt(t) for t in ents.get("time", []) or []]
    if times and ir["events"]:
        ir["events"][0]["when"] = times[0]
    for r in out.get("answer_report") or []:
        v = ANSWER_MAP.get(_txt(r.get("answer")))
        whose = _txt(r.get("whose_answer"))
        if v and whose:
            me = whose.strip().lower() in ("i", "me")
            ir["answers"].append({"of": "me" if me else whose, "about": None, "value": v, "source": _txt(r.get("reported_by"))})
    for r in out.get("user_task") or []:
        ir["tasks"].append({"who": _txt(r.get("contact")), "what": _txt(r.get("action")) or "follow up", "when": _txt(r.get("when"))})
    for r in out.get("waiting_for") or []:
        who = _txt(r.get("person"))
        if who:
            ir["waiting"].append({"who": who, "what": _txt(r.get("action")), "when": _txt(r.get("when"))})
    return ir


class GlinerEngine:
    def __init__(self, model_dir: Path, label: str | None = None, threads: int | None = None):
        self.model_dir = Path(model_dir)
        self.label = label or self.model_dir.name
        self.threads = threads
        self.model = None
        self.schema = None
        self.parts = None
        self.load_seconds = None

    def start(self):
        if self.model is not None:
            return
        import torch
        if self.threads:
            torch.set_num_threads(self.threads)
        from gliner2 import AutoExtractor
        t0 = time.time()
        self.model = AutoExtractor.from_pretrained(str(self.model_dir))
        self.model.eval() if hasattr(self.model, "eval") else None
        # Use the richest schema this checkpoint accepts; record which parts it supports.
        probe = "Mrs. Cohen called."
        for attrs, recs in ((True, True), (False, True), (True, False), (False, False)):
            try:
                sch = build_schema(self.model, attrs, recs)
                self.model.extract(probe, sch, include_confidence=True, include_spans=True)
                self.schema, self.parts = sch, {"role attributes": attrs, "records": recs}
                break
            except Exception as e:  # noqa: BLE001 — a checkpoint without that head
                last = e
        if self.schema is None:
            raise RuntimeError(f"GLiNER schema not supported by this checkpoint: {last}")
        self.load_seconds = round(time.time() - t0, 2)

    def stop(self):
        self.model = None

    def analyze(self, text: str):
        self.start()
        import torch
        t0 = time.perf_counter()
        with torch.inference_mode():
            out = self.model.extract(text, self.schema, include_confidence=True, include_spans=True)
        ms = (time.perf_counter() - t0) * 1000
        return {"ir": to_interpretation(out), "raw": out, "ms": round(ms, 1), "error": None, "parts": self.parts}
