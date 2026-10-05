"""
Auditoría PS1 de Midnight Rinse: que se vea como PlayStation y que corra fluido en PC y celular.

  py .claude/skills/retro-psx-optimizer/auditar_psx.py           → invariantes del render (sin navegador)
  py .claude/skills/retro-psx-optimizer/auditar_psx.py medir     → además mide cada área en Chrome sin ventana

Invariantes (si alguno falla, el juego dejó de verse PS1 o algo se encareció):
  - Resolución interna 320×240, objetivo de render con NearestFilter, sin antialias, pixelRatio 1.
  - Vertex snapping en el sombreador de vértices (uSnapRes, floor(ndc * uSnapRes)).
  - UV afines (sin corrección de perspectiva): vUvW = uv * w y la división en el fragmento.
  - Tramado Bayer 8×8 (mod 8, 64 niveles) y cuantización RGB555 (31 niveles por canal).
  - Iluminación Gouraud por vértice con a lo más 6 luces; niebla por vértice.
  - Texturas procedurales pequeñas (≤ 256 px) y espejo/fotos a baja resolución.
Medición (con «medir»): llamadas de dibujo, triángulos y ms de update+render por área. Umbrales para el celular:
  ≤ 220 llamadas y ≤ 60 000 triángulos por cuadro. Con SwiftShader los ms son de CPU (sirven para comparar versiones).
"""
import json
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
SRC = RAIZ / 'juego' / 'src'
CHROMES = [Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe'),
           Path(r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'),
           Path(r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')]
MAX_LLAMADAS = 220
MAX_TRIANGULOS = 60000
fallas = []


def ok(cond, msg):
    print(('  ✔ ' if cond else '  ✘ ') + msg)
    if not cond:
        fallas.append(msg)


def invariantes():
    print('Invariantes del render')
    retro = (SRC / 'engine' / 'retro.js').read_text(encoding='utf-8')
    config = (SRC / 'engine' / 'config.js').read_text(encoding='utf-8')
    ok(re.search(r'RENDER_W:\s*320', config) and re.search(r'RENDER_H:\s*240', config), 'resolución interna 320×240')
    ok('antialias: false' in retro and 'setPixelRatio(1)' in retro, 'sin antialias y pixelRatio 1')
    ok(re.search(r'WebGLRenderTarget\(C\.RENDER_W, C\.RENDER_H,[^)]*NearestFilter', retro, re.S) is not None, 'objetivo 320×240 con NearestFilter')
    ok('floor(ndc * uSnapRes' in retro, 'vertex snapping (floor(ndc * uSnapRes))')
    ok('vUvW = vec3(uv * clip.w, clip.w)' in retro and 'vUvW.xy / vUvW.z' in retro, 'UV afines (sin corrección de perspectiva)')
    ok('mod(x, 8.0)' in retro and 'tBayer' in retro and '/ 64.0' in retro, 'tramado Bayer 8×8 (64 niveles)')
    ok('* 31.0' in retro and '/ 31.0' in retro, 'cuantización RGB555 (31 niveles)')
    luces = re.search(r'MAX_LIGHTS\s*=\s*(\d+)', retro)
    ok(luces and int(luces.group(1)) <= 6 and 'vLight = light' in retro, 'Gouraud por vértice con %s luces' % (luces.group(1) if luces else '?'))
    tex = (SRC / 'engine' / 'textures.js').read_text(encoding='utf-8')
    grandes = [int(n) for n in re.findall(r'(?:canvas|dynamic)\(\s*(\d+)', tex) if int(n) > 256]
    ok(not grandes, 'texturas procedurales ≤ 256 px' + (' (hay %s)' % grandes if grandes else ''))
    esp = (SRC / 'engine' / 'espejo.js').read_text(encoding='utf-8')
    fot = (SRC / 'engine' / 'fotos.js').read_text(encoding='utf-8')
    ok('WebGLRenderTarget(192, 144' in esp and 'NearestFilter' in esp, 'espejo a 192×144 sin suavizado')
    ok(re.search(r'var W = 320;', fot) and re.search(r'var H = 240;', fot), 'fotos a 320×240')


def medir():
    print('Medición por área (Chrome sin ventana)')
    try:
        urllib.request.urlopen('http://127.0.0.1:8765/index.html', timeout=5)
    except Exception:
        ok(False, 'servidor local en 127.0.0.1:8765 (py -m http.server 8765 --bind 127.0.0.1 desde juego/)')
        return
    chrome = next((c for c in CHROMES if c.exists()), None)
    with tempfile.TemporaryDirectory() as perfil:
        p = subprocess.run([str(chrome), '--headless=new', '--no-first-run', '--mute-audio', '--user-data-dir=' + perfil,
                            '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1036,647',
                            '--virtual-time-budget=60000', '--dump-dom', 'http://127.0.0.1:8765/tests/rendimiento.html'],
                           capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=300)
    m = (re.findall(r'<pre id="resultado">(.*?)</pre>', p.stdout, re.S) or [None])[-1]
    try:
        datos = json.loads(m.replace('&quot;', '"'))
    except Exception:
        ok(False, 'no hubo resultado de la medición')
        return
    if 'error' in datos:
        ok(False, 'la medición falló: %s' % datos['error'])
        return
    for a in datos['areas']:
        print('    %-18s %4d llamadas · %6d triángulos · %5.2f ms (CPU, SwiftShader)' % (a['area'], a['llamadas'], a['triangulos'], a['ms']))
        ok(a['llamadas'] <= MAX_LLAMADAS and a['triangulos'] <= MAX_TRIANGULOS, '%s dentro de los umbrales del celular' % a['area'])
    print('    texturas %s · geometrías %s · programas %s · resolución %s' % (datos['texturas'], datos['geometrias'], datos['programas'], datos['resolucion']))


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    invariantes()
    if 'medir' in sys.argv[1:]:
        medir()
    print('\n' + ('TODO EN ORDEN' if not fallas else 'FALLAS: %d' % len(fallas)))
    sys.exit(1 if fallas else 0)


if __name__ == '__main__':
    main()
