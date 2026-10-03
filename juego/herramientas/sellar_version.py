"""Sella index.html con ?v=<versión> en todos los scripts y estilos locales.

Así, cuando el navegador baja un index.html nuevo, también baja los scripts nuevos en vez de mezclar
versiones guardadas en caché (GitHub Pages cachea cada archivo 10 minutos). Ejecutar antes de publicar:

    py juego/herramientas/sellar_version.py
"""
import io
import re
import time
from pathlib import Path

INDEX = Path(__file__).resolve().parent.parent / 'index.html'
version = time.strftime('%Y%m%d%H%M%S')
texto = io.open(INDEX, encoding='utf-8').read()
patron = re.compile(r'((?:src|href)=")((?:src|vendor)/[^"?]+)(?:\?v=[^"]*)?(")')
nuevo, n = patron.subn(lambda m: m.group(1) + m.group(2) + '?v=' + version + m.group(3), texto)
io.open(INDEX, 'w', encoding='utf-8', newline='\n').write(nuevo)
print('index.html sellado con v=%s en %d recursos' % (version, n))
