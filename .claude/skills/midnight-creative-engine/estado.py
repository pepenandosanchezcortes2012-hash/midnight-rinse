"""
Inventario del contenido actual de Midnight Rinse, para que el motor creativo proponga cosas NUEVAS (no repetidas).

  py .claude/skills/midnight-creative-engine/estado.py

Lista: sustos del director por área, noches especiales, sustos armados (tele, espejo, foto), transmisiones de radio,
llamadas, hojas, susurros, objetos perdidos, logros y las ideas que ya están en TASK_BACKLOG.md.
"""
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
ENGINE = RAIZ / 'juego' / 'src' / 'engine'


def leer(nombre):
    return (ENGINE / nombre).read_text(encoding='utf-8')


def lista_js(texto, clave):
    m = re.search(clave + r': \[(.*?)\n    \]', texto, re.S)
    return re.findall(r"'((?:[^'\\]|\\.)*)'", m.group(1)) if m else []


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    horror = leer('horror.js')
    print('SUSTOS DEL DIRECTOR (por área)')
    for area, patron in (('pasillo', r"table = \[(\['bombilla'.*?)\];"), ('bosque', r"table = \[(\['rama'.*?)\];"),
                         ('sala', r"table = \[(\['apagon', 3\].*?)\];")):
        m = re.search(patron, horror, re.S)
        nombres = re.findall(r"\['([a-z_]+)'", m.group(1)) if m else []
        print('  %-8s %s' % (area, ', '.join(nombres)))
    extra = sorted(set(re.findall(r"table\.push\(\['([a-z_]+)'", horror)))
    print('  extra    ' + ', '.join(extra))
    print('  armados  tele_rostro (tele.js), espejo (espejo.js), él en la foto (fotos.js), relámpago revela (clima.js), reflejo en lavadora (horror.js)')
    # Lo que el mundo ya tiene preparado para esos sustos (comentarios de world.js con «evento»): leerlos antes de proponer.
    mundo = (ENGINE / 'world.js').read_text(encoding='utf-8')
    for c in re.findall(r'//\s*([^\n]*evento[^\n]*)', mundo, re.I):
        print('  mundo    ' + c.strip()[:120])
    config = leer('config.js')
    bloque = config[config.index('MR.NOCHES_ESPECIALES = {'):config.index('MR.DIFICULTAD = {')]
    noches = re.findall(r"^\s+(\w+): \{ nombre: '([^']+)'", bloque, re.M)
    print('\nNOCHES ESPECIALES (%d): %s' % (len(noches), ', '.join(n[1] for n in noches)))
    hist = leer('historia.js')
    for clave, titulo in (('radio', 'RADIO NOCTURNA 94.1'), ('telefono', 'TELÉFONO'), ('susurros', 'SUSURROS')):
        items = lista_js(hist, clave)
        print('\n%s (%d)' % (titulo, len(items)))
        for i, t in enumerate(items, 1):
            print('  %d. %s' % (i, t[:110]))
    firmas = re.findall(r"firma: '([^']+)'", hist)
    print('\nHOJAS DEL BOSQUE (%d): %s' % (len(firmas), ' | '.join(firmas)))
    objetos = re.findall(r"nombre: '([^']+)'", leer('objetos.js'))
    print('\nOBJETOS PERDIDOS (%d): %s' % (len(objetos), ', '.join(objetos)))
    logros = re.findall(r"titulo: '([^']+)'", leer('logros.js'))
    print('\nLOGROS (%d): %s' % (len(logros), ', '.join(logros)))
    backlog = RAIZ / 'TASK_BACKLOG.md'
    if backlog.exists():
        tareas = [l[6:] for l in backlog.read_text(encoding='utf-8').splitlines() if l.startswith('- [')]
        print('\nYA EN EL BACKLOG (%d, no repetir):' % len(tareas))
        for t in tareas:
            print('  - ' + t[:120])


if __name__ == '__main__':
    main()
