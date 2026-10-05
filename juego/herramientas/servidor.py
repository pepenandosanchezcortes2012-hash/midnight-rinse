"""
Servidor local de juego/ en 127.0.0.1:8765, solo mientras dura una prueba.

  with servidor():      # si ya hay uno corriendo (py -m http.server 8765 desde juego/), lo usa
      ...               # si no, levanta uno temporal en este proceso y lo apaga al salir

Así las herramientas (probar.py, fuzz.py, auditar_psx.py, centinela.py) no necesitan un servidor encendido todo el
tiempo: no queda nada ocupando memoria entre una prueba y otra.
"""
import contextlib
import functools
import http.server
import threading
import urllib.request
from pathlib import Path

JUEGO = Path(__file__).resolve().parent.parent
URL = 'http://127.0.0.1:8765/'


def activo():
    try:
        urllib.request.urlopen(URL + 'index.html', timeout=2)
        return True
    except Exception:
        return False


class _Silencioso(http.server.SimpleHTTPRequestHandler):
    # En Windows, el registro puede decir que .js es text/plain: se fija aquí.
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map,
                          **{'.js': 'application/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json'})

    def log_message(self, *args):
        pass


@contextlib.contextmanager
def servidor():
    if activo():
        yield
        return
    manejador = functools.partial(_Silencioso, directory=str(JUEGO))
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), manejador)
    hilo = threading.Thread(target=srv.serve_forever, daemon=True)
    hilo.start()
    try:
        yield
    finally:
        srv.shutdown()
        srv.server_close()
