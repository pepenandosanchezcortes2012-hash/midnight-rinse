"""
Corre las pruebas de partida (pruebas.html?auto) en un Chrome sin ventana y muestra el resultado.

  py herramientas/probar.py [url] [--todo]   (por defecto http://127.0.0.1:8765/pruebas.html?auto; --todo muestra cada prueba)

Si no hay servidor local en 127.0.0.1:8765, levanta uno temporal (servidor.py). Usa un perfil temporal, así que no
toca el Chrome de todos los días. Chrome espera en tiempo virtual hasta que las pruebas terminan y entrega el HTML final.
"""
import html
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from servidor import servidor

CHROMES = [Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe'),
           Path(r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'),
           Path(r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')]


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    args = [a for a in sys.argv[1:] if a != '--todo']
    todo = '--todo' in sys.argv
    url = args[0] if args else 'http://127.0.0.1:8765/pruebas.html?auto'
    chrome = next((c for c in CHROMES if c.exists()), None)
    if not chrome:
        sys.exit('no encontré Chrome ni Edge')

    def correr():
        with servidor(), tempfile.TemporaryDirectory() as perfil:
            p = subprocess.run([str(chrome), '--headless=new', '--no-first-run', '--no-default-browser-check', '--mute-audio',
                                '--user-data-dir=' + perfil, '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
                                '--window-size=1036,647', '--autoplay-policy=no-user-gesture-required',
                                '--virtual-time-budget=600000', '--dump-dom', url],
                               capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=900)
        dom = p.stdout
        # ¿Terminó? La página escribe en #resumen «Todo bien: N/T…» o «Fallaron…» al final; mientras corre, «Corriendo…».
        fin = re.search(r'<div id="resumen"[^>]*>(.*?)</div>', dom, re.S)
        fin = html.unescape(fin.group(1)).strip() if fin else ''
        return dom, fin, p.stderr or ''

    dom, fin, err = correr()
    if not (fin.startswith('Todo bien') or fin.startswith('Fallaron')):
        # Chrome a veces entrega la página a medias (infraestructura, no una prueba): se avisa y se reintenta una vez.
        print('aviso: Chrome entregó la página a medias («%s»); se reintenta una vez. Chrome dijo: %s' % (fin or 'sin resumen', err.strip()[-300:] or '(nada)'))
        dom, fin, err = correr()
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
        elif todo:
            print('·', texto[:300])
    if not (fin.startswith('Todo bien') or fin.startswith('Fallaron')):
        print('la página no terminó (resumen: «%s»): solo hay %d resultados' % (fin or 'sin resumen', len(filas)))
        sys.exit(3)
    print('pasaron %d de %d' % (len(filas) - malas, len(filas)))
    sys.exit(1 if malas else 0)


if __name__ == '__main__':
    main()
