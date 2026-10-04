"""
Corre las pruebas de partida (pruebas.html?auto) en un Chrome sin ventana y muestra el resultado.

  py herramientas/probar.py [url]     (por defecto http://127.0.0.1:8765/pruebas.html?auto)

Necesita el servidor local (py -m http.server 8765 --bind 127.0.0.1 desde juego/). Usa un perfil temporal, así que no
toca el Chrome de todos los días. Chrome espera en tiempo virtual hasta que las pruebas terminan y entrega el HTML final.
"""
import html
import re
import subprocess
import sys
import tempfile
from pathlib import Path

CHROMES = [Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe'),
           Path(r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'),
           Path(r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')]


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/pruebas.html?auto'
    chrome = next((c for c in CHROMES if c.exists()), None)
    if not chrome:
        sys.exit('no encontré Chrome ni Edge')
    with tempfile.TemporaryDirectory() as perfil:
        p = subprocess.run([str(chrome), '--headless=new', '--no-first-run', '--no-default-browser-check', '--mute-audio',
                            '--user-data-dir=' + perfil, '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
                            '--window-size=1036,647', '--virtual-time-budget=240000', '--dump-dom', url],
                           capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600)
    dom = p.stdout
    filas = re.findall(r'<li class="(ok|mal)"[^>]*>(.*?)</li>', dom, re.S)
    if not filas:
        print('sin resultados (¿no cargó?)')
        print(re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', dom)))[:600])
        sys.exit(2)
    malas = 0
    for clase, cuerpo in filas:
        texto = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', cuerpo))).strip()
        if clase == 'mal':
            malas += 1
            print('✗', texto[:400])
    print('pasaron %d de %d' % (len(filas) - malas, len(filas)))
    sys.exit(1 if malas else 0)


if __name__ == '__main__':
    main()
