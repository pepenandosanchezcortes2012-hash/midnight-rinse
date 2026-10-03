#!/usr/bin/env python3
"""Parche del modo cadena para apex-goal-orchestrator-pro v3 (campeón que se queda, lotes de 4 gladiadores).

Uso:  python3 aplicar_parche.py [carpeta_de_la_skill]
Por defecto: ~/.gemini/skills/apex-goal-orchestrator-pro. Aplica los cambios sobre el coliseo.py que tengas instalado
(respeta tus modificaciones, por ejemplo las del adaptador de agy), hace copia .bak y es idempotente.
"""
from __future__ import annotations

import py_compile
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

EDITS = [
    ('    "incumbent_dir": "",\n}\n',
     '    "incumbent_dir": "",\n    "roster_batch": -1,\n}\n', '"roster_batch": -1'),
    ('    return roster\n\n\n@dataclass\nclass Criterion:',
     '''    return roster


def build_batch_roster(count: int, batch: int, vary_temperature: bool = False) -> List[Gladiator]:
    """Lote número `batch` de la cadena: toma gladiadores distintos de la plantilla completa de 100.

    Con count=4 trae uno por división; el lote 0 son G001, G026, G051 y G076, el lote 1 son G002, G027, G052 y G077,
    y así hasta el lote 24. Ocho lotes de 4 suman los 32 gladiadores de la cadena, todos distintos.
    """
    full = build_roster(100, vary_temperature)
    by_division: Dict[str, List[Gladiator]] = {d["code"]: [g for g in full if g.division == d["code"]] for d in DIVISIONS}
    per_division = [count // 4 + (1 if i < count % 4 else 0) for i in range(4)]
    picked: List[Gladiator] = []
    for d_index, division in enumerate(DIVISIONS):
        members = by_division[division["code"]]
        for j in range(per_division[d_index]):
            picked.append(members[(batch * per_division[d_index] + j) % len(members)])
    return picked


@dataclass
class Criterion:''', 'def build_batch_roster'),
    ('        self.gladiators = build_roster(int(cfg["agents"]), bool(cfg["vary_temperature"]))',
     '''        if int(cfg.get("roster_batch", -1)) >= 0:
            self.gladiators = build_batch_roster(int(cfg["agents"]), int(cfg["roster_batch"]), bool(cfg["vary_temperature"]))
        else:
            self.gladiators = build_roster(int(cfg["agents"]), bool(cfg["vary_temperature"]))''', 'self.gladiators = build_batch_roster'),
    ('        "sandbox": args.sandbox, "incumbent_dir": args.incumbent,\n    }',
     '        "sandbox": args.sandbox, "incumbent_dir": args.incumbent, "roster_batch": args.roster_batch,\n    }', '"roster_batch": args.roster_batch'),
    ('    p_run.add_argument("--no-judge", action="store_true", help="sin jueces LLM en los empates")',
     '    p_run.add_argument("--roster-batch", type=int, help="lote de la cadena (0, 1, 2...): usa gladiadores distintos de la plantilla de 100")\n'
     '    p_run.add_argument("--no-judge", action="store_true", help="sin jueces LLM en los empates")', '"--roster-batch"'),
    ('    if int(cfg["concurrency"]) < 1 or int(cfg["bench_runs"]) < 1 or int(cfg["stability_runs"]) < 1:',
     '    if not isinstance(cfg.get("roster_batch", -1), int) or not (-1 <= cfg.get("roster_batch", -1) < 25):\n'
     '        problems.append("roster_batch debe ser un entero entre -1 (sin cadena) y 24")\n'
     '    if int(cfg["concurrency"]) < 1 or int(cfg["bench_runs"]) < 1 or int(cfg["stability_runs"]) < 1:', 'roster_batch debe ser'),
]


def main() -> int:
    skill = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else Path("~/.gemini/skills/apex-goal-orchestrator-pro").expanduser()
    target = skill / "scripts" / "coliseo.py"
    if not target.exists():
        print(f"[X] No encuentro {target}")
        return 2
    text = target.read_text(encoding="utf-8")
    original = text
    for old, new, marker in EDITS:
        if marker in text:
            continue
        if old not in text:
            print(f"[X] No pude aplicar un cambio: no encuentro el texto esperado cerca de: {old.strip().splitlines()[0][:80]}")
            print("    Tu coliseo.py difiere de la v3 en esa zona. No se modificó nada. Aplica ese cambio a mano.")
            return 3
        text = text.replace(old, new, 1)
    if text != original:
        shutil.copy2(target, target.with_suffix(".py.bak"))
        target.write_text(text, encoding="utf-8")
        print("coliseo.py actualizado (copia de seguridad: coliseo.py.bak)")
    else:
        print("coliseo.py ya tenía el modo cadena.")
    try:
        py_compile.compile(str(target), doraise=True)
    except py_compile.PyCompileError as exc:
        backup = target.with_suffix(".py.bak")
        if backup.exists():
            shutil.copy2(backup, target)
        print(f"[X] El archivo resultante no compila ({exc}). Restaurado desde la copia.")
        return 4
    shutil.copy2(HERE / "cadena.py", skill / "scripts" / "cadena.py")
    try:
        py_compile.compile(str(skill / "scripts" / "cadena.py"), doraise=True)
    except py_compile.PyCompileError as exc:
        print(f"[X] cadena.py no compila ({exc}). Probablemente se alteró al copiarlo: guárdalo otra vez tal cual está en el anexo.")
        return 6
    helpcheck = subprocess.run([sys.executable, str(skill / "scripts" / "cadena.py"), "status", "--help"], capture_output=True, text=True)
    if helpcheck.returncode != 0:
        print("[X] cadena.py no arranca:", helpcheck.stderr[-300:])
        return 6
    skill_md = skill / "SKILL.md"
    section = (HERE / "seccion_skill_4_8.md").read_text(encoding="utf-8")
    if skill_md.exists() and "### 4.8 Modo cadena" not in skill_md.read_text(encoding="utf-8"):
        with skill_md.open("a", encoding="utf-8") as handle:
            handle.write("\n\n" + section)
        print("SKILL.md: sección 4.8 agregada al final.")
    check = subprocess.run([sys.executable, str(target), "roster", "--agents", "4"], capture_output=True, text=True)
    probe = subprocess.run([sys.executable, "-c",
                            "import sys; sys.path.insert(0, sys.argv[1]); import coliseo; "
                            "ids=[g.gid for k in range(8) for g in coliseo.build_batch_roster(4,k)]; "
                            "print(len(ids), len(set(ids)))", str(skill / "scripts")], capture_output=True, text=True)
    if check.returncode != 0 or probe.stdout.split() != ["32", "32"]:
        print("[X] La verificación final falló:", check.stderr[-300:], probe.stdout, probe.stderr[-300:])
        return 5
    print("Listo: cadena.py instalado y verificado (8 lotes de 4 = 32 gladiadores distintos).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
