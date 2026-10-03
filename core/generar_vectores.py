"""Genera juego/tests/vectores.json: entradas y salidas exactas del núcleo Python para verificar los ports a JS.

Solo incluye casos representables en JavaScript (en JS no existe la distinción int/float de Python: 15.0 es entero).
Uso: py core/generar_vectores.py
"""
from __future__ import annotations

import datetime as dt
import json
import random
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import midnight_rinse_core as core  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "juego" / "tests" / "vectores.json"


def error_name(fn):
    try:
        return {"ok": fn()}
    except Exception as exc:  # se registra el tipo de error esperado
        return {"error": type(exc).__name__}


def vec_bayer(rng):
    cases = []
    for _ in range(4000):
        rgb = [rng.choice([rng.random(), rng.randrange(0, 32) / 31, rng.uniform(-0.5, 1.5)]) for _ in range(3)]
        x, y = rng.randrange(-40, 400), rng.randrange(-40, 300)
        cases.append({"rgb": rgb, "x": x, "y": y, "out": list(core.quantize(tuple(rgb), x, y))})
    errors = [
        {"rgb": [0.5, 0.5], "x": 0, "y": 0}, {"rgb": [0.5, 0.5, 0.5, 0.5], "x": 0, "y": 0},
        {"rgb": [True, 0.5, 0.5], "x": 0, "y": 0}, {"rgb": [0.5, "0.5", 0.5], "x": 0, "y": 0},
        {"rgb": [0.5, 0.5, 0.5], "x": 1.5, "y": 0}, {"rgb": [0.5, 0.5, 0.5], "x": 0, "y": False},
        {"rgb": [0.5, None, 0.5], "x": 0, "y": 0},
    ]
    return {"cases": cases, "errors": errors}


def vec_snap(rng):
    cases = []
    vress = [[320, 240], [160, 120], [640, 480], [7, 13], [1, 1]]
    for i in range(4000):
        w = 10 ** rng.uniform(-3, 3)
        clip = [rng.uniform(-3, 3) * w, rng.uniform(-3, 3) * w, rng.uniform(-1, 1), w]
        vres = vress[i % len(vress)]
        cases.append({"clip": clip, "vres": vres, "out": list(core.snap(tuple(clip), tuple(vres)))})
    errors = [
        {"clip": [0.1, 0.1, 0.1, 0.0], "vres": [320, 240]}, {"clip": [0.1, 0.1, 0.1, -1.0], "vres": [320, 240]},
        {"clip": [1.0000001e6, 0.0, 0.0, 1.0], "vres": [320, 240]}, {"clip": [0.1, 0.1, 0.1], "vres": [320, 240]},
        {"clip": [0.1, 0.1, 0.1, 1.0], "vres": [0, 240]}, {"clip": [0.1, 0.1, 0.1, 1.0], "vres": [320.5, 240]},
        {"clip": [True, 0.1, 0.1, 1.0], "vres": [320, 240]},
    ]
    return {"cases": cases, "errors": errors}


def vec_stepped(rng):
    seqs = []
    for hz in (15, 12, 30, 1):
        h = core.SteppedHold(hz)
        steps = []
        poses = []
        t = 0.0
        for i in range(600):
            t = i / 60 if i % 7 else t + rng.choice([0.0, 1e-7])
            pose = {"i": i}
            poses.append(pose)
            got = h.sample(t, pose)
            steps.append({"t": t, "pose": i, "got": got["i"]})
        seqs.append({"hz": hz, "steps": steps})
    return {"seqs": seqs}


def vec_dial(rng):
    seqs = []
    for detent, res, hyst in ((15.0, 0.5, 3.0), (15.0, 0.0, 3.0), (22.5, 0.25, 2.0), (2.5, 0.0, 1.0), (360.0, 0.5, 0.0)):
        d = core.DetentDial(detent, res, hyst)
        steps = []
        for _ in range(500):
            r = rng.random()
            if r < 0.5:
                delta = rng.choice([-1, 1]) * rng.randrange(1, 9) / 8
            elif r < 0.9:
                delta = rng.choice([-1, 1]) * rng.randrange(8, 400) / 4
            else:
                delta = rng.choice([-1, 1]) * rng.randrange(360, 1440)
            clicks = d.drag(delta)
            steps.append({"delta": delta, "clicks": [c["angle"] for c in clicks], "angle": d.angle})
        seqs.append({"params": [detent, res, hyst], "steps": steps})
    errors = [[7.0, 0.5, 3.0], [25.0, 0.5, 3.0], [15.0, 1.0, 3.0], [15.0, 0.5, 7.5], [0.0, 0.5, 0.0], [True, 0.5, 3.0]]
    return {"seqs": seqs, "init_errors": errors}


def vec_clock():
    cases = []
    for minute in range(0, 24 * 60, 7):
        for sec, us in ((0, 0), (59, 999999)):
            h, m = divmod(minute, 60)
            moment = dt.datetime(2026, 10, 3, h, m, sec, us)
            cases.append({"h": h, "m": m, "s": sec, "us": us, "mult": core.anomaly_multiplier(moment),
                          "whispers": core.whispers_active(moment)})
    for h, m, s, us in ((1, 59, 59, 999999), (2, 0, 0, 0), (4, 59, 59, 999999), (5, 0, 0, 0), (2, 59, 59, 999999),
                        (3, 0, 0, 0), (3, 59, 59, 999999), (4, 0, 0, 0)):
        moment = dt.datetime(2026, 10, 3, h, m, s, us)
        cases.append({"h": h, "m": m, "s": s, "us": us, "mult": core.anomaly_multiplier(moment), "whispers": core.whispers_active(moment)})
    return {"cases": cases}


def vec_shift_log():
    cases = []
    stored_options = [None, "", "contenido ajeno\n"] + [core.TEXTS[p] + "\n" for p in core.PHASES] + [core.TEXTS["collapse"]]
    with tempfile.TemporaryDirectory() as tmp:
        for i, stored in enumerate(stored_options):
            for phase in core.PHASES:
                base = Path(tmp) / f"c{i}-{phase}"
                base.mkdir()
                if stored is not None:
                    (base / "shift_log.txt").write_bytes(stored.encode("utf-8"))
                text = core.ShiftLog(str(base)).update(phase)
                after = (base / "shift_log.txt").read_bytes().decode("utf-8")
                cases.append({"stored": stored, "phase": phase, "returns": text, "after": after})
    return {"texts": core.TEXTS, "phases": list(core.PHASES), "cases": cases,
            "invalid": ["", "../x", "START", "start\n", None, 0, ["start"]]}


def vec_dispatcher(rng):
    d = core.Dispatcher()
    ops = []
    for i in range(3000):
        r = rng.random()
        if r < 0.55:
            event_id = f"e{rng.randrange(0, 400)}"
            prio = rng.randrange(-3, 4)
            res = error_name(lambda: d.schedule(event_id, {"n": i}, prio))
            ops.append({"op": "schedule", "id": event_id, "n": i, "priority": prio, "error": res.get("error")})
        elif r < 0.95:
            vis = rng.choice([0, 0.0, 1e-12, 0.5, 1.0, 1])
            blink = rng.random() < 0.2
            fired = d.tick(vis, blink)
            ops.append({"op": "tick", "visibility": vis, "blink": blink, "fired": [[e["event_id"], e["payload"]["n"]] for e in fired]})
        else:
            ops.append({"op": "pending", "result": d.pending()})
    errors = [{"visibility": v} for v in (-0.1, 1.0000001, True, "0")] + [{"visibility": 0.5, "blink": 1}]
    return {"ops": ops, "tick_errors": errors}


def main() -> int:
    rng = random.Random(20261003)
    data = {
        "bayer": vec_bayer(rng), "snap": vec_snap(rng), "stepped": vec_stepped(rng), "dial": vec_dial(rng),
        "clock": vec_clock(), "shift_log": vec_shift_log(), "dispatcher": vec_dispatcher(rng),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"{OUT} · {OUT.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
