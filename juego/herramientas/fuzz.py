"""
Pasada de robustez: turnos completos con semilla (tests/fuzz.html) en un Chrome sin ventana.

  py herramientas/fuzz.py [n] [desde]   (por defecto 24 turnos desde la semilla 1)

Cada turno combina una noche especial, una dificultad y un idioma, y hace acciones al azar: caminar, parpadear,
salir al bosque y al pasillo, responder, conversar, acariciar al gato, sacar fotos y tocar lo que esté cerca. Uno de
cada seis va al final verdadero y cruza la puerta del amanecer. Falla si algún turno lanza un error o no termina.
Necesita el servidor local (py -m http.server 8765 --bind 127.0.0.1 desde juego/). Tarda ~1 minuto por turno.
"""
import html
import re
import subprocess
import sys
import tempfile

from probar import CHROMES


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 24
    desde = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    url = 'http://127.0.0.1:8765/tests/fuzz.html?n=%d&desde=%d' % (n, desde)
    chrome = next((c for c in CHROMES if c.exists()), None)
    if not chrome:
        sys.exit('no encontré Chrome ni Edge')
    with tempfile.TemporaryDirectory() as perfil:
        p = subprocess.run([str(chrome), '--headless=new', '--no-first-run', '--no-default-browser-check', '--mute-audio',
                            '--user-data-dir=' + perfil, '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
                            '--autoplay-policy=no-user-gesture-required',
                            '--virtual-time-budget=%d' % (n * 150000), '--dump-dom', url],
                           capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=120 + n * 150)
    m = re.search(r'<pre id="o">(.*?)</pre>', p.stdout, re.S)
    texto = html.unescape(m.group(1)) if m else ''
    print(texto.strip() or 'sin resultados (¿no cargó?)')
    malo = not texto.strip().endswith('FIN') or 'ERRORES' in texto or 'no arrancó' in texto
    sys.exit(1 if malo else 0)


if __name__ == '__main__':
    main()
