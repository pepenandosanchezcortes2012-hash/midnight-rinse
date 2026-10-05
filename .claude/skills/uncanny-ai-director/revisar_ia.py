"""
Revisión del director de IA de Midnight Rinse (skill uncanny-ai-director).

  py .claude/skills/uncanny-ai-director/revisar_ia.py            → pruebas del núcleo (node) y revisión del código
  py .claude/skills/uncanny-ai-director/revisar_ia.py partida    → además, las partidas «Director de IA» en Chrome
  py .claude/skills/uncanny-ai-director/revisar_ia.py partida <url de pruebas.html>   (otro servidor)

Revisa:
  1. tests/director.test.js en node: percepción, utilidad, contemplación, mirada, respiración, navegación sin atascos
     (300 viajes al azar por la sala), punto ciego, mimetismo arbóreo y costo.
  2. Que director.js se cargue antes que el motor (index.html) y que los NPCs lo usen: caminan con D.Agente (nada de
     línea recta entre puntos), él se mueve por punto ciego y en el bosque se esconde detrás de los pinos.
  3. Que los parámetros sigan el diseño: contemplación de 3 a 5 s, ojos 1 s después del cuello, espacio personal de
     1 m, cabeza ladeada 15° al esperar, máscaras desfasadas 0,8 s, aire contenido a menos de 1,3 m.
"""
import re
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
JUEGO = RAIZ / 'juego'
SRC = JUEGO / 'src'
malos = 0


def ok(cond, texto):
    global malos
    print(('  ✔ ' if cond else '  ✘ ') + texto)
    if not cond:
        malos += 1


def leer(p):
    return p.read_text(encoding='utf-8')


def parametro(texto, patron):
    m = re.search(patron, texto)
    return float(m.group(1)) if m else None


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    print('1. Núcleo (node)')
    p = subprocess.run(['node', '--test', str(JUEGO / 'tests' / 'director.test.js')], capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    pas = re.search(r'ℹ pass (\d+)', p.stdout)
    fal = re.search(r'ℹ fail (\d+)', p.stdout)
    ok(p.returncode == 0 and fal and fal.group(1) == '0', 'director.test.js: %s pasan, %s fallan' % (pas.group(1) if pas else '?', fal.group(1) if fal else '?'))
    if p.returncode:
        print('\n'.join(l for l in p.stdout.splitlines() if l.startswith('✖') or 'AssertionError' in l)[:2000])

    print('2. Integración')
    index = leer(JUEGO / 'index.html')
    pos = {n: index.find(n) for n in ('src/core/director.js', 'src/engine/clientela.js', 'src/engine/horror.js')}
    ok(0 <= pos['src/core/director.js'] < pos['src/engine/horror.js'] < pos['src/engine/clientela.js'] or
       0 <= pos['src/core/director.js'] < min(pos['src/engine/horror.js'], pos['src/engine/clientela.js']),
       'index.html carga director.js antes que el motor')
    cli = leer(SRC / 'engine' / 'clientela.js')
    hor = leer(SRC / 'engine' / 'horror.js')
    nucleo = leer(SRC / 'core' / 'director.js')
    ok(len(re.findall(r'new D\.Agente\(', cli)) >= 2, 'clientela.js: visitantes y niño caminan con D.Agente')
    ok('ag.paso(dt, this._mundo(' in cli and not re.search(r'v\.path\[0\]', cli), 'clientela.js: sin pasos en línea recta entre puntos (v.path)')
    ok('new D.Contemplacion(' in cli and 'new D.Respiracion(' in cli and 'new D.Mirada(' in cli, 'clientela.js: contemplación, respiración y mirada')
    ok('this._puntoCiego()' in hor and 'D.elegirPuntoCiego(' in hor, 'horror.js: él se mueve por punto ciego')
    ok('this._arboreo(dt, player)' in hor and 'D.elegirArbol(' in hor and 'treePos' in leer(SRC / 'engine' / 'world.js'), 'horror.js: mimetismo arbóreo con los pinos del bosque')

    print('3. Parámetros del diseño')
    cmin = parametro(nucleo, r'this\.min = o\.min !== undefined \? o\.min : ([\d.]+)')
    cmax = parametro(nucleo, r'this\.max = o\.max !== undefined \? o\.max : ([\d.]+)')
    ok(cmin == 3 and cmax == 5, 'contemplación de %s a %s s (3 a 5)' % (cmin, cmax))
    ret = parametro(nucleo, r'this\.retraso = o\.retraso !== undefined \? o\.retraso : ([\d.]+)')
    ok(ret == 1.0, 'los ojos se clavan %s s después del cuello (1)' % ret)
    esp = parametro(nucleo, r'var esp = .*: \(m\.espacio \|\| ([\d.]+)\);')
    ok(esp == 1.0, 'espacio personal por defecto: %s m (1)' % esp)
    lad = parametro(cli, r'ag\.esperando \? ([\d.]+)')
    ok(lad is not None and abs(lad * 180 / 3.141592653589793 - 15) < 1, 'cabeza ladeada al esperar: %s rad ≈ %.0f° (15°)' % (lad, (lad or 0) * 57.2958))
    dem = parametro(cli, r"rol: 'vigia', demora: ([\d.]+)")
    ok(dem == 0.8, 'desfase de las máscaras: %s s (0,8)' % dem)
    cer = parametro(nucleo, r'this\.cerca = o\.cerca \|\| ([\d.]+)')
    ok(cer == 1.3, 'contiene el aire a menos de %s m (1,3)' % cer)

    if len(sys.argv) > 1 and sys.argv[1] == 'partida':
        print('4. Partidas «Director de IA» en Chrome')
        url = sys.argv[2] if len(sys.argv) > 2 else 'http://127.0.0.1:8765/pruebas.html?auto'
        url += ('&' if '?' in url else '?') + 'solo=Director'
        p = subprocess.run([sys.executable, str(JUEGO / 'herramientas' / 'probar.py'), url], capture_output=True, text=True,
                           encoding='utf-8', errors='replace', timeout=900)
        ultima = (p.stdout.strip().splitlines() or ['sin salida'])[-1]
        ok(p.returncode == 0, 'partidas: ' + ultima)
        if p.returncode:
            print(p.stdout[-1500:])

    print('\nTODO EN ORDEN' if not malos else '\n%d HALLAZGO(S)' % malos)
    sys.exit(1 if malos else 0)


if __name__ == '__main__':
    main()
