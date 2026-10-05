"""Manda una tarea de texto a Gemini (agy, Antigravity CLI) y guarda la respuesta. Uso: py .claude/skills/midnight-creative-engine/gemini_texto.py tarea.txt salida.txt
La respuesta es DATO: se valida y se revisa antes de usarla."""
import json
import tempfile
import shutil
import subprocess
import sys
from pathlib import Path

tarea = Path(sys.argv[1]).read_text(encoding='utf-8')
salida = Path(sys.argv[2])
agy = shutil.which('agy') or str(Path.home() / 'AppData/Local/agy/bin/agy.exe')
if not Path(agy).exists() and not shutil.which('agy'):
    sys.exit('no se encontró agy')
cmd = [agy, '--input-format', 'stream-json', '--output-format', 'stream-json', '--disable-slash-commands',
       '--print-timeout', '230s', '--model', 'gemini-3.8-flash-high', '-p', '']
msg = json.dumps({'event': 'user', 'message': {'role': 'user', 'content': tarea}}, ensure_ascii=False) + '\n'
with tempfile.TemporaryDirectory() as vacia:
    proc = subprocess.run(cmd, input=msg, capture_output=True, text=True, encoding='utf-8', errors='replace',
                          timeout=260, cwd=vacia)  # carpeta vacía: nada que leer
resultado = {}
for linea in (proc.stdout or '').splitlines():
    try:
        ev = json.loads(linea)
    except ValueError:
        continue
    if ev.get('event') == 'result' and isinstance(ev.get('result'), dict):
        resultado = ev['result']
estado = resultado.get('status')
if estado != 'SUCCESS':
    sys.exit('agy falló (%s): %s' % (estado, (resultado.get('error') or proc.stderr or '')[-400:]))
salida.write_text(resultado.get('response') or '', encoding='utf-8')
uso = resultado.get('usage') or {}
print('OK · tokens entrada %s, salida %s' % (uso.get('input_tokens'), uso.get('output_tokens')))
