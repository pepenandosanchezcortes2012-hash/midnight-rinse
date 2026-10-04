"""
Centinela de QA de Midnight Rinse: lo que tiene que estar bien antes de subir a GitHub Pages.

  py .claude/skills/qa-sentinel-audio/centinela.py            → rápido: estático + núcleo JS + partida (Chrome sin ventana)
  py .claude/skills/qa-sentinel-audio/centinela.py completo   → además: 203 pruebas de Python del núcleo y la versión en vivo

Estático (sin navegador):
  1. index.html: cada src/href es relativo, el archivo existe con esas MAYÚSCULAS exactas (GitHub Pages distingue
     mayúsculas; Windows no) y todos los ?v= son el mismo sello.
  2. manifest, sw.js y la redirección de la raíz: rutas relativas y archivos que existen.
  3. Ningún script pide rutas absolutas ('/src/…', 'C:\\', 'file:').
  4. Textos en inglés completos (herramientas/textos.py).
Pruebas:
  5. Núcleo JS contra los vectores de Python (node juego/tests/nucleo.test.js): despachador de oclusión incluido.
  6. Partida en Chrome sin ventana (herramientas/probar.py), con el desbloqueo del audio y el despachador en juego.
  7. (completo) Python: core/tests con unittest.
  8. (completo) En vivo: cada recurso de index.html responde 200 en GitHub Pages y las pruebas pasan allá.
Sale con código 1 si algo falla.
"""
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
JUEGO = RAIZ / 'juego'
VIVO = 'https://pepenandosanchezcortes2012-hash.github.io/midnight-rinse/'
fallas = []


def ok(cond, msg):
    print(('  ✔ ' if cond else '  ✘ ') + msg)
    if not cond:
        fallas.append(msg)


def existe_exacto(base, rel):
    """¿Existe el archivo con estas mayúsculas exactas? (como lo pide GitHub Pages)."""
    p = base
    for parte in rel.split('/'):
        if parte in ('', '.'):
            continue
        if parte == '..':
            p = p.parent
            continue
        if not p.is_dir() or parte not in os.listdir(p):
            return False
        p = p / parte
    return p.exists()


def relativo(url):
    return not re.match(r'^(/|[a-zA-Z]:\\|file:|\\\\)', url)


def estatico():
    print('1-4. Estático')
    html = (JUEGO / 'index.html').read_text(encoding='utf-8')
    refs = re.findall(r'(?:src|href)="([^"#]+)"', html)
    locales = [r for r in refs if not re.match(r'^(https?:|mailto:|data:)', r)]
    sellos = set()
    malas = []
    for r in locales:
        ruta = r.split('?')[0]
        m = re.search(r'\?v=(\d+)', r)
        if m:
            sellos.add(m.group(1))
        if not relativo(r) or not existe_exacto(JUEGO, ruta):
            malas.append(r)
    ok(not malas, 'index.html: %d rutas relativas y existentes%s' % (len(locales), (' — fallan: ' + ', '.join(malas[:5])) if malas else ''))
    ok(len(sellos) == 1, 'index.html: un solo sello de versión (%s)' % ', '.join(sorted(sellos)[:3]))
    man = json.loads((JUEGO / 'manifest.webmanifest').read_text(encoding='utf-8'))
    iconos = [i['src'] for i in man.get('icons', [])]
    ok(relativo(man.get('start_url', '.')) and all(relativo(i) and existe_exacto(JUEGO, i) for i in iconos),
       'manifest: start_url e %d íconos relativos y existentes' % len(iconos))
    sw = (JUEGO / 'sw.js').read_text(encoding='utf-8')
    ok(not re.search(r"""['"]/(src|vendor|iconos|index)""", sw), 'sw.js: sin rutas absolutas')
    raiz = (RAIZ / 'index.html').read_text(encoding='utf-8')
    destino = re.findall(r'(?:url=|href=")([^";]+)', raiz)
    ok(destino and all(relativo(d) and existe_exacto(RAIZ, d.split('?')[0].rstrip('/') + ('/index.html' if d.endswith('/') else '')) for d in destino),
       'index.html de la raíz: redirige a %s' % (destino[0] if destino else '¿?'))
    abs_js = []
    for f in sorted((JUEGO / 'src').rglob('*.js')):
        for i, linea in enumerate(f.read_text(encoding='utf-8').splitlines(), 1):
            if re.search(r"""(fetch|src\s*=|href\s*=|register)\(?\s*['"](/[a-z]|[A-Za-z]:\\|file:)""", linea):
                abs_js.append('%s:%d' % (f.name, i))
    ok(not abs_js, 'scripts sin rutas absolutas%s' % (' — ' + ', '.join(abs_js[:5]) if abs_js else ''))
    p = subprocess.run([sys.executable, str(JUEGO / 'herramientas' / 'textos.py')], capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    m = re.search(r'faltan (\d+)', p.stdout)
    ok(m and m.group(1) == '0', 'textos en inglés: %s' % p.stdout.strip())


def pruebas(completo):
    print('5. Núcleo JS (vectores de Python, incluido el despachador de oclusión)')
    p = subprocess.run(['node', str(JUEGO / 'tests' / 'nucleo.test.js')], capture_output=True, text=True, encoding='utf-8', errors='replace')
    pas = re.search(r'pass (\d+)', p.stdout)
    fal = re.search(r'fail (\d+)', p.stdout)
    ok(p.returncode == 0 and fal and fal.group(1) == '0', 'node: %s pasan, %s fallan' % (pas.group(1) if pas else '?', fal.group(1) if fal else '?'))
    print('6. Partida en Chrome sin ventana')
    try:
        urllib.request.urlopen('http://127.0.0.1:8765/pruebas.html', timeout=5)
        servidor = True
    except Exception:
        servidor = False
    ok(servidor, 'servidor local en 127.0.0.1:8765 (py -m http.server 8765 --bind 127.0.0.1 desde juego/)')
    if servidor:
        p = subprocess.run([sys.executable, str(JUEGO / 'herramientas' / 'probar.py')], capture_output=True, text=True,
                           encoding='utf-8', errors='replace', timeout=900)
        print('    ' + p.stdout.strip().replace('\n', '\n    '))
        ok(p.returncode == 0, 'partida: ' + (p.stdout.strip().splitlines() or ['sin salida'])[-1])
    if completo:
        print('7. Núcleo en Python (core/tests)')
        p = subprocess.run([sys.executable, '-m', 'unittest', 'discover', '-s', 'tests', '-q'], cwd=str(RAIZ / 'core'),
                           capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=900)
        resumen = [l for l in p.stderr.splitlines() if l.startswith('Ran ') or l.startswith('OK') or l.startswith('FAILED')]
        ok(p.returncode == 0, 'python: ' + ' · '.join(resumen))


def vivo():
    print('8. En vivo (GitHub Pages)')
    html = urllib.request.urlopen(VIVO + 'juego/index.html', timeout=20).read().decode('utf-8')
    refs = [r for r in re.findall(r'(?:src|href)="([^"#]+)"', html) if not re.match(r'^(https?:|mailto:|data:)', r)]
    malas = []
    for r in refs:
        try:
            req = urllib.request.Request(VIVO + 'juego/' + r, method='HEAD')
            code = urllib.request.urlopen(req, timeout=20).status
        except Exception as e:
            code = getattr(e, 'code', 0)
        if code != 200:
            malas.append('%s (%s)' % (r, code))
    ok(not malas, '%d recursos responden 200%s' % (len(refs), (' — ' + ', '.join(malas[:5])) if malas else ''))
    commit = subprocess.run(['git', 'rev-parse', '--short=7', 'HEAD'], cwd=str(RAIZ), capture_output=True, text=True).stdout.strip()
    p = subprocess.run([sys.executable, str(JUEGO / 'herramientas' / 'probar.py'), VIVO + 'juego/pruebas.html?auto&r=' + commit],
                       capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=900)
    ok(p.returncode == 0, 'pruebas en vivo: ' + (p.stdout.strip().splitlines() or ['sin salida'])[-1])


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    completo = 'completo' in sys.argv[1:]
    estatico()
    pruebas(completo)
    if completo:
        vivo()
    print('\n' + ('TODO EN ORDEN' if not fallas else 'FALLAS: %d' % len(fallas)))
    sys.exit(1 if fallas else 0)


if __name__ == '__main__':
    main()
