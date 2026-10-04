"""
Backlog dinámico de Midnight Rinse (TASK_BACKLOG.md en la raíz del repo).

  py .claude/skills/perpetual-task-runner/backlog.py                     → resumen y la siguiente tarea
  py .claude/skills/perpetual-task-runner/backlog.py siguiente           → solo la siguiente tarea pendiente (P1 antes que P2…)
  py .claude/skills/perpetual-task-runner/backlog.py agregar "P2" "Título — detalle" [Ideas]
  py .claude/skills/perpetual-task-runner/backlog.py hecho "parte del título" <commit>
  py .claude/skills/perpetual-task-runner/backlog.py aprobar "parte del título"   → pasa una idea a Pendientes
  py .claude/skills/perpetual-task-runner/backlog.py bloquear "parte del título" "motivo"

Formato de cada tarea:  - [ ] (P1) Título — detalle
Secciones: «## Pendientes», «## Ideas (motor creativo, sin aprobar)», «## Bloqueadas (necesitan decisión)», «## Hechas».
"""
import datetime
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
ARCHIVO = RAIZ / 'TASK_BACKLOG.md'
SECCIONES = ['Pendientes', 'Ideas (motor creativo, sin aprobar)', 'Bloqueadas (necesitan decisión)', 'Hechas']
TAREA = re.compile(r'^- \[( |x)\] \((P\d)\) (.*)$')


def leer():
    texto = ARCHIVO.read_text(encoding='utf-8')
    cabeza = texto.split('\n## ')[0].rstrip() + '\n'
    secciones = {s: [] for s in SECCIONES}
    for bloque in texto.split('\n## ')[1:]:
        nombre, _, cuerpo = bloque.partition('\n')
        nombre = nombre.strip()
        secciones.setdefault(nombre, [])
        secciones[nombre] += [l for l in cuerpo.splitlines() if l.startswith('- [')]
    return cabeza, secciones


def escribir(cabeza, secciones):
    partes = [cabeza]
    for s, tareas in secciones.items():
        partes.append('\n## %s\n' % s + ('\n'.join(tareas) + '\n' if tareas else ''))
    ARCHIVO.write_text(''.join(partes), encoding='utf-8', newline='\n')


def prioridad(linea):
    m = TAREA.match(linea)
    return int(m.group(2)[1:]) if m else 9


def buscar(secciones, parte, en=None):
    for s, tareas in secciones.items():
        if en and s != en:
            continue
        for i, l in enumerate(tareas):
            if parte.lower() in l.lower():
                return s, i
    sys.exit('no encontré «%s»' % parte)


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    cabeza, sec = leer()
    args = sys.argv[1:]
    cmd = args[0] if args else 'resumen'
    pend = sorted([l for l in sec['Pendientes'] if l.startswith('- [ ]')], key=prioridad)
    if cmd in ('resumen', 'siguiente'):
        if cmd == 'resumen':
            for s in SECCIONES:
                print('%-38s %d' % (s, len(sec.get(s, []))))
            print()
        print('Siguiente: ' + (pend[0][6:] if pend else '(nada pendiente: pedir ideas a midnight-creative-engine)'))
        if cmd == 'resumen' and len(pend) < 3:
            print('Quedan menos de 3 pendientes: toca rellenar con el motor creativo.')
    elif cmd == 'agregar':
        p, titulo = args[1], args[2]
        destino = 'Ideas (motor creativo, sin aprobar)' if len(args) > 3 and args[3].lower().startswith('idea') else 'Pendientes'
        sec[destino].append('- [ ] (%s) %s' % (p.upper(), titulo))
        escribir(cabeza, sec)
        print('agregada a %s' % destino)
    elif cmd == 'hecho':
        s, i = buscar(sec, args[1])
        linea = sec[s].pop(i).replace('- [ ]', '- [x]', 1)
        sec['Hechas'].insert(0, '%s — commit %s (%s)' % (linea, args[2] if len(args) > 2 else '?', datetime.date.today().isoformat()))
        escribir(cabeza, sec)
        print('hecha: ' + linea[6:])
    elif cmd == 'aprobar':
        s, i = buscar(sec, args[1], 'Ideas (motor creativo, sin aprobar)')
        sec['Pendientes'].append(sec[s].pop(i))
        escribir(cabeza, sec)
        print('aprobada')
    elif cmd == 'bloquear':
        s, i = buscar(sec, args[1])
        sec['Bloqueadas (necesitan decisión)'].append(sec[s].pop(i) + ' — BLOQUEADA: ' + args[2])
        escribir(cabeza, sec)
        print('bloqueada')
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()
