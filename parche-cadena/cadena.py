#!/usr/bin/env python3
"""Cadena del Coliseo: el campeón se queda y enfrenta a lotes nuevos de gladiadores, en orden.

Cada lote es un torneo real de coliseo.py con 4 gladiadores nuevos (uno por división). El campeón del lote anterior
entra como defensor del título (--incumbent) y los 4 retadores compiten contra él en la Gran Final: si uno lo supera,
toma el título; si no, el defensor sigue. Con 8 lotes de 4 se completan 32 gladiadores distintos. El último lote corre
completo (equipo rojo, jurado, fusión y Centinela) para ratificar al campeón de la cadena.

Uso:
  python3 cadena.py run arenas/<modulo> --backend cli --batches 8        # inicia o continúa (siempre reanuda)
  python3 cadena.py status arenas/<modulo>                               # avance
  python3 cadena.py verify arenas/<modulo>                               # compuertas de calidad (todo real)
  python3 cadena.py run arenas/<modulo> --redo 8                         # repite el último lote terminado
  python3 cadena.py run arenas/<modulo> --reset                          # borra la cadena y empieza de cero
Todo lo que pongas después de "--" se pasa tal cual a coliseo.py run.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import coliseo  # noqa: E402  (para conocer qué gladiadores trae cada lote)

COLISEO = HERE / "coliseo.py"
DONE_CODES = (0, 3, 4)      # APROBADO, CON OBSERVACIONES, SIN CAMPEÓN VÁLIDO: el lote terminó y dejó acta
CROWN_CODES = (0, 3)        # solo estos veredictos pueden coronar o fusionar al campeón
EARLY_CUT_RC = 6            # código propio: corte temprano por fallo sistemático del lote


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
        os.replace(tmp, str(path))
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def load_state(path: Path) -> Dict[str, Any]:
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("batches"), list):
                return data
        except ValueError:
            pass
    return {"batches": []}


def run_marker(arena: Path) -> str:
    marker = arena / "runs" / "LATEST"
    return marker.read_text(encoding="utf-8").strip() if marker.exists() else ""


def run_dir_of(arena: Path, run_id: str) -> Optional[Path]:
    if not run_id:
        return None
    folder = arena / "runs" / run_id
    return folder if folder.is_dir() else None


def read_telemetry(run_dir: Optional[Path]) -> Dict[str, Any]:
    if run_dir is None:
        return {}
    path = run_dir / "telemetry.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except ValueError:
        return {}


def tree_sha(folder: Path) -> str:
    return coliseo.sha256_files(coliseo.read_text_tree(folder)) if folder.is_dir() else ""


def pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == "nt":
        try:
            out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"], capture_output=True, text=True, timeout=20).stdout
        except (OSError, subprocess.TimeoutExpired):
            return True
        return str(pid) in out
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def acquire_lock(folder: Path) -> Optional[str]:
    """Evita dos cadenas a la vez sobre la misma arena. Devuelve un mensaje de error o None si tomó el candado."""
    folder.mkdir(parents=True, exist_ok=True)
    lock = folder / ".lock"
    if lock.exists():
        try:
            other = int(lock.read_text(encoding="utf-8").split()[0])
        except (ValueError, IndexError, OSError):
            other = 0
        if other and other != os.getpid() and pid_alive(other):
            return (f"ya hay una cadena corriendo sobre esta arena (proceso {other}). No lances otra: espera a que termine "
                    f"o ciérrala, y revisa el avance con: cadena.py status")
    lock.write_text(f"{os.getpid()} {time.strftime('%Y-%m-%d %H:%M:%S')}\n", encoding="utf-8")
    return None


def release_lock(folder: Path) -> None:
    try:
        (folder / ".lock").unlink()
    except OSError:
        pass


def build_command(args: argparse.Namespace, arena: Path, k: int, last: bool, incumbent: Optional[Path]) -> List[str]:
    cmd = [sys.executable, str(COLISEO), "run", str(arena), "--agents", str(args.batch_size), "--roster-batch", str(k)]
    if args.backend:
        cmd += ["--backend", args.backend]
    if args.concurrency:
        cmd += ["--concurrency", str(args.concurrency)]
    if args.rpm:
        cmd += ["--rpm", str(args.rpm)]
    if args.max_calls:
        cmd += ["--max-calls", str(args.max_calls)]
    if incumbent is not None:
        cmd += ["--incumbent", str(incumbent)]
    if not last and not args.extras_all:
        cmd += ["--red-team", str(args.red_team_mid), "--jury", str(args.jury_mid), "--no-fusion", "--no-sentinel"]
    cmd += list(args.passthrough)
    return cmd


def summarize(state: Dict[str, Any], total: int, size: int) -> str:
    lines = ["# Cadena del Coliseo", ""]
    lines.append(f"- Lotes planeados: {total} de {size} gladiadores nuevos cada uno ({total * size} gladiadores distintos en total).")
    done = [b for b in state["batches"] if b.get("rc") in DONE_CODES]
    lines.append(f"- Lotes terminados: {len(done)} · Campeón actual: {state.get('champion', 'ninguno')}")
    lines.append("")
    lines.append("| Lote | Retadores (plan) | Código | Veredicto | Campeón del lote | Título | Llamadas | Agentes | Acta |")
    lines.append("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |")
    for b in state["batches"]:
        lines.append(f"| {b['k'] + 1} | {', '.join(b.get('challengers', []))} | {b.get('rc', '—')} | {b.get('verdict', '—')} | "
                     f"{b.get('batch_champion', '—')} | {b.get('title', '—')} | {b.get('calls', '—')} | {b.get('agents', '—')} | "
                     f"{b.get('run_id', '—')} |")
    return "\n".join(lines) + "\n"


def early_cut_reason(tel: Dict[str, Any], batch_size: int) -> str:
    """Un fallo sistemático (por ejemplo, la arena descalifica a casi todos en R0) se detecta en los primeros lotes."""
    for row in tel.get("rounds", []):
        if row.get("key") == "R0":
            burned = int(row.get("burned", 0))
            limit = max(3, int(math.ceil(0.75 * batch_size)))
            if burned >= limit:
                causes = (tel.get("burn_categories") or {}).get("R0", {})
                return f"R0 purgó {burned} de {batch_size} gladiadores ({dict(causes)}). Revisa la arena antes de seguir"
    return ""


def cmd_run(args: argparse.Namespace) -> int:
    arena = Path(args.arena).resolve()
    if not (arena / "arena.json").exists():
        print(f"[X] No existe {arena / 'arena.json'}. Crea la arena con: coliseo.py init {arena}")
        return 2
    if args.batch_size < 4 or args.batch_size % 4:
        print("[X] --batch-size debe ser un múltiplo de 4 (un gladiador por división como mínimo).")
        return 2
    if not (1 <= args.batches <= 25):
        print("[X] --batches debe estar entre 1 y 25.")
        return 2
    folder = arena / "cadena"
    message = acquire_lock(folder)
    if message:
        print(f"[X] {message}")
        return 2
    try:
        return run_chain(args, arena, folder)
    finally:
        release_lock(folder)


def run_chain(args: argparse.Namespace, arena: Path, folder: Path) -> int:
    state_path = folder / "estado.json"
    champion_dir = folder / "campeon_actual"
    if args.reset:
        for child in list(folder.iterdir()):
            if child.name == ".lock":
                continue
            shutil.rmtree(child, ignore_errors=True) if child.is_dir() else child.unlink()
    state = load_state(state_path)
    if args.redo:
        done = sorted((b for b in state["batches"] if b.get("rc") in DONE_CODES), key=lambda b: b["k"])
        if not done or done[-1]["k"] + 1 != args.redo:
            print(f"[X] --redo solo repite el ÚLTIMO lote terminado (ahora es el {done[-1]['k'] + 1 if done else 'ninguno'}).")
            return 2
        entry = done[-1]
        snapshot = folder / f"antes-lote-{entry['k'] + 1:02d}"
        shutil.rmtree(champion_dir, ignore_errors=True)
        if snapshot.is_dir() and any(snapshot.iterdir()):
            shutil.copytree(snapshot, champion_dir)
        state["champion"] = entry.get("defensor", "ninguno todavía")
        if state["champion"] == "ninguno todavía":
            state.pop("champion", None)
        state["batches"] = [b for b in state["batches"] if b["k"] != entry["k"]]
        print(f"Se repetirá el lote {args.redo}: se restauró el defensor que tenía antes de ese lote.", flush=True)
    if args.incumbent and not champion_dir.exists() and not state["batches"]:
        shutil.copytree(args.incumbent, champion_dir)
        state["champion"] = "defensor inicial"
    finished = {b["k"] for b in state["batches"] if b.get("rc") in DONE_CODES}
    state["batches"] = [b for b in state["batches"] if b.get("rc") in DONE_CODES]
    total = args.batches
    print(f"CADENA: {total} lotes x {args.batch_size} gladiadores = {total * args.batch_size} gladiadores distintos. "
          f"El campeón se queda y defiende el título en cada lote.", flush=True)
    for k in range(total):
        if k in finished:
            print(f"Lote {k + 1}/{total}: ya terminado, se omite.", flush=True)
            continue
        last = k == total - 1
        incumbent = champion_dir if champion_dir.exists() and any(champion_dir.iterdir()) else None
        snapshot = folder / f"antes-lote-{k + 1:02d}"
        shutil.rmtree(snapshot, ignore_errors=True)
        if incumbent is not None:
            shutil.copytree(champion_dir, snapshot)
        else:
            snapshot.mkdir(parents=True, exist_ok=True)
        defender_label = state.get("champion", "ninguno todavía")
        cmd = build_command(args, arena, k, last, incumbent)
        print("=" * 92, flush=True)
        print(f"LOTE {k + 1}/{total}" + (" (final completo: equipo rojo, jurado, fusión y Centinela)" if last and not args.extras_all else "")
              + f" · defensor: {defender_label}", flush=True)
        marker_before = run_marker(arena)
        started = time.time()
        proc = subprocess.run(cmd)
        marker_after = run_marker(arena)
        run_id = marker_after if marker_after and marker_after != marker_before else ""
        run_dir = run_dir_of(arena, run_id)
        tel = read_telemetry(run_dir)
        entry: Dict[str, Any] = {"k": k, "rc": proc.returncode, "run_id": run_id, "defensor": defender_label,
                                 "verdict": tel.get("verdict", "sin acta"), "seconds": round(time.time() - started, 1)}
        ledger = tel.get("ledger", {})
        entry["calls"] = ledger.get("calls")
        entry["agents"] = ledger.get("agents")
        entry["challengers"] = [g.gid for g in coliseo.build_batch_roster(args.batch_size, k)]
        champ = tel.get("champion") or {}
        entry["batch_champion"] = champ.get("gid", "—")
        if proc.returncode in CROWN_CODES and champ and run_dir is not None and (run_dir / "champion").is_dir():
            new_champion = champ.get("gid") != "G000"
            changed = new_champion or tree_sha(run_dir / "champion") != tree_sha(champion_dir)
            if changed:
                shutil.rmtree(champion_dir, ignore_errors=True)
                shutil.copytree(run_dir / "champion", champion_dir)
            if new_champion:
                keep = folder / f"lote-{k + 1:02d}-{champ.get('gid')}"
                shutil.rmtree(keep, ignore_errors=True)
                shutil.copytree(run_dir / "champion", keep)
                state["champion"] = champ.get("label", champ.get("gid"))
                entry["title"] = "nuevo campeón"
            else:
                entry["title"] = "defendido (con fusión o reparación del Centinela)" if changed else "defendido"
        elif proc.returncode in DONE_CODES:
            entry["title"] = "sin campeón válido (no pasó la verificación final); el defensor se mantiene"
        if proc.returncode in DONE_CODES and k < 2 and not args.sin_corte_temprano:
            reason = early_cut_reason(tel, args.batch_size)
            if reason:
                entry["motor_rc"] = proc.returncode
                entry["rc"] = EARLY_CUT_RC
                entry["title"] = "corte temprano"
                state["batches"].append(entry)
                state["batches"].sort(key=lambda b: b["k"])
                write_json(state_path, state)
                (folder / "REPORTE.md").write_text(summarize(state, total, args.batch_size), encoding="utf-8")
                print(f"\nCORTE TEMPRANO tras el lote {k + 1}: {reason}.")
                print("Corrige la arena, borra su carpeta cadena y runs (o usa --reset) y vuelve a lanzar.")
                return EARLY_CUT_RC
        state["batches"].append(entry)
        state["batches"].sort(key=lambda b: b["k"])
        write_json(state_path, state)
        (folder / "REPORTE.md").write_text(summarize(state, total, args.batch_size), encoding="utf-8")
        if proc.returncode not in DONE_CODES:
            print(f"\nLote {k + 1} detenido (código {proc.returncode}: {entry['verdict']}). Estado guardado en {state_path}.")
            print(f"Para continuar: python3 {Path(__file__).name} run {args.arena} --batches {total} ...")
            return proc.returncode
    final = state["batches"][-1] if state["batches"] else {}
    print("=" * 92)
    print(f"CADENA TERMINADA · Campeón: {state.get('champion', 'ninguno')} · Código: {champion_dir}")
    print(f"Resumen: {folder / 'REPORTE.md'}")
    print(f"Comprueba las compuertas de calidad con: python3 {Path(__file__).name} verify {args.arena}")
    return final.get("rc") if final.get("rc") in DONE_CODES else 4


def gate(arena: Path, batches: int) -> List[str]:
    """Compuertas de calidad sobre lo que realmente ocurrió (actas y telemetría), no sobre lo planeado."""
    problems: List[str] = []
    state = load_state(arena / "cadena" / "estado.json")
    done = {b["k"]: b for b in state["batches"] if b.get("rc") in DONE_CODES}
    if sorted(done) != list(range(batches)):
        problems.append(f"lotes terminados: {[k + 1 for k in sorted(done)]} de {batches}")
    for k, entry in sorted(done.items()):
        tel = read_telemetry(run_dir_of(arena, entry.get("run_id", "")))
        if not tel:
            problems.append(f"lote {k + 1}: no hay telemetría del acta {entry.get('run_id')}")
            continue
        failed = int((tel.get("ledger") or {}).get("failed", 0))
        if failed:
            problems.append(f"lote {k + 1}: {failed} llamadas al modelo fallidas")
        r0 = (tel.get("burn_categories") or {}).get("R0", {})
        if r0.get("sin entrega válida"):
            problems.append(f"lote {k + 1}: {r0['sin entrega válida']} gladiadores sin entrega válida del modelo (cuota, red o formato)")
        if k == batches - 1:
            if tel.get("verdict") != "APROBADO":
                problems.append(f"lote final: veredicto {tel.get('verdict')} · {tel.get('observations')}")
            red = tel.get("redteam") or []
            if red and not any(r.get("status") == "en combate" for r in red):
                problems.append("lote final: ningún ataque del equipo rojo llegó a combate")
            final = tel.get("final") or {}
            if final.get("votes_cast") != final.get("votes_possible"):
                problems.append(f"lote final: jurado incompleto ({final.get('votes_cast')}/{final.get('votes_possible')} votos)")
            cfg = tel.get("config") or {}
            if cfg.get("sentinel_review") and not (tel.get("sentinel", {}).get("llm") or {}).get("verdict"):
                problems.append("lote final: el Centinela LLM no respondió")
            champion_dir = arena / "cadena" / "campeon_actual"
            run_dir = run_dir_of(arena, entry.get("run_id", ""))
            if run_dir is not None and tree_sha(champion_dir) != tree_sha(run_dir / "champion"):
                problems.append("campeon_actual no coincide con el código que ratificó el acta del lote final")
    return problems


def cmd_verify(args: argparse.Namespace) -> int:
    arena = Path(args.arena).resolve()
    problems = gate(arena, args.batches)
    if not problems:
        print(f"OK: {args.batches} lotes terminados, sin llamadas fallidas, final aprobado, jurado completo y campeón consistente.")
        return 0
    print("La cadena NO está terminada de verdad:")
    for problem in problems:
        print(f" - {problem}")
    return 1


def cmd_status(args: argparse.Namespace) -> int:
    state = load_state(Path(args.arena) / "cadena" / "estado.json")
    if not state["batches"]:
        print("Esta arena todavía no tiene una cadena en curso.")
        return 1
    print(summarize(state, args.batches, args.batch_size))
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Cadena del Coliseo: campeón que defiende el título contra lotes de gladiadores nuevos")
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run", help="inicia o continúa la cadena de lotes (siempre reanuda lo ya terminado)")
    run.add_argument("arena")
    run.add_argument("--batches", type=int, default=8, help="número de lotes (por defecto 8)")
    run.add_argument("--batch-size", type=int, default=4, help="gladiadores nuevos por lote (múltiplo de 4; por defecto 4)")
    run.add_argument("--backend", choices=["api", "cli"])
    run.add_argument("--concurrency", type=int)
    run.add_argument("--rpm", type=float)
    run.add_argument("--max-calls", type=int)
    run.add_argument("--incumbent", help="carpeta con un campeón inicial que defiende el título desde el primer lote")
    run.add_argument("--resume", action="store_true", help="compatibilidad: la cadena siempre continúa lo que ya terminó")
    run.add_argument("--reset", action="store_true", help="borra la cadena de esta arena y empieza de cero")
    run.add_argument("--redo", type=int, help="repite el ÚLTIMO lote terminado (número de lote, desde 1)")
    run.add_argument("--sin-corte-temprano", action="store_true", help="no detener la cadena si R0 purga a casi todo un lote")
    run.add_argument("--red-team-mid", type=int, default=2, help="atacantes del equipo rojo en los lotes intermedios")
    run.add_argument("--jury-mid", type=int, default=3, help="jurados en los lotes intermedios")
    run.add_argument("--extras-all", action="store_true", help="todos los lotes corren completos (más llamadas)")
    run.add_argument("passthrough", nargs="*", help="argumentos extra para coliseo.py run, después de --")
    status = sub.add_parser("status", help="muestra el avance de la cadena")
    status.add_argument("arena")
    status.add_argument("--batches", type=int, default=8)
    status.add_argument("--batch-size", type=int, default=4)
    verify = sub.add_parser("verify", help="compuertas de calidad: ¿la cadena terminó de verdad y sin degradaciones?")
    verify.add_argument("arena")
    verify.add_argument("--batches", type=int, default=8)
    args = parser.parse_args(argv)
    if args.command == "run":
        return cmd_run(args)
    return cmd_status(args) if args.command == "status" else cmd_verify(args)


if __name__ == "__main__":
    sys.exit(main())
