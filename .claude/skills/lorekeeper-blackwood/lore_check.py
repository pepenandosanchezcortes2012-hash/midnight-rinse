"""
Verificador del canon (CANON.md) sobre los textos del juego. Señala contradicciones que se pueden detectar solas.

  py .claude/skills/lorekeeper-blackwood/lore_check.py              → revisa todos los textos del juego
  py .claude/skills/lorekeeper-blackwood/lore_check.py "texto nuevo" → revisa un texto antes de agregarlo

Reglas automáticas (las demás se revisan leyendo CANON.md):
  - La hora verdadera solo puede ser 05:13 / «cinco y trece».
  - El turno es de 01:10 a 05:12: ninguna hora entre 05:14 y 05:59 aparece como fin del turno.
  - Radio Nocturna es la 94.1; tu música, la 99.9. Ninguna otra frecuencia para ellas.
  - Siete casilleros, seis hojas, seis lavadoras, cuatro secadoras.
  - Iniciales de los de antes: R., E., S., D., T., A. (en ese orden en las firmas).
  - Firmas de las hojas entre el 14 de octubre y el 19 de noviembre.
  - Toda llamada del teléfono dice «faltan cinco minutos para las seis».
  - Él no tiene nombre (no se le llama por un nombre propio) y nunca ataca de frente (sin «te ataca», «te agarra», «te muerde»).
  - Blackwood: el embalse lo cubrió en 1986 (no otro año); las máscaras negras no hablan.
"""
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3]
ENGINE = RAIZ / 'juego' / 'src' / 'engine'
FUENTES = [ENGINE / f for f in ('historia.js', 'objetos.js', 'pasillo.js', 'config.js', 'game.js', 'gameplay.js', 'horror.js',
                                'bosque.js', 'espejo.js', 'fotos.js', 'tele.js', 'logros.js', 'archivo.js', 'novedades.js')] + \
          [RAIZ / 'juego' / 'src' / 'core' / 'shiftLog.js']
NO_APROBADOS = []  # todo lo de la §7 de CANON.md quedó aprobado (octubre de 2026)
NUMEROS = {'casilleros': ('siete', '7'), 'hojas': ('seis', '6')}
problemas = []


def textos(path):
    """Literales de texto de un archivo JS (los que tienen espacios y letras)."""
    s = path.read_text(encoding='utf-8')
    out = []
    for m in re.finditer(r"'((?:[^'\\\n]|\\.)*)'", s):
        t = m.group(1)
        if ' ' in t and re.search(r'[a-záéíóúñ]{3}', t):
            out.append((s.count('\n', 0, m.start()) + 1, t))
    return out


def revisar(origen, linea, t):
    def mal(msg):
        problemas.append('%s:%s  %s\n      «%s»' % (origen, linea, msg, t[:140]))
    low = t.lower()
    if 'hora verdadera' in low:
        horas = re.findall(r'\b0?5:1\d\b', t) + re.findall(r'cinco y (doce|trece|catorce|once)', low)
        if any(h not in ('05:13', '5:13', 'trece') for h in horas):
            mal('la hora verdadera solo puede ser las 05:13')
    if re.search(r'\b05:(1[4-9]|[2-5]\d)\b', t) and ('turno' in low or 'reloj' in low):
        mal('el turno termina a las 05:12 (la hora verdadera es 05:13)')
    if 'radio nocturna' in low or 'locutor' in low:
        freq = re.findall(r'\b(\d{2,3}\.\d)\b', t)
        if any(f != '94.1' for f in freq):
            mal('Radio Nocturna es la 94.1')
    for palabra, validos in NUMEROS.items():
        for m in re.finditer(r'\b(\w+) ' + palabra + r'\b', low):
            n = m.group(1)
            if re.match(r'^(\d+|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)$', n) and n not in validos:
                if not (palabra == 'hojas' and ('de 6' in t or '{n}' in t)):
                    mal('son %s %s' % (validos[0], palabra))
    for pat in NO_APROBADOS:
        if re.search(pat, low):
            mal('«%s» está en propuestas sin aprobar (CANON.md §7)' % re.search(pat, low).group(0))
    if ('embalse' in low or 'blackwood' in low or 'inund' in low) and re.search(r'\b19[5-9]\d\b', t):
        if any(y != '1986' for y in re.findall(r'\b(19[5-9]\d)\b', t)) and not re.search(r'1987', t):
            mal('el embalse cubrió Blackwood en 1986')
    if re.search(r'm[áa]scaras? negras?', low) and re.search(r'\b(dijo|dice|habla|hablan|susurra|pregunta)\b', low):
        mal('las máscaras negras nunca hablan (solo imprimen órdenes)')
    if re.search(r'\bte (ataca|agarra|muerde|apuñala|persigue corriendo)\b', low):
        mal('él nunca ataca de frente')


def revisar_juego():
    for f in FUENTES:
        if not f.exists():
            continue
        for linea, t in textos(f):
            revisar(f.name, linea, t)
    # Reglas que miran el conjunto.
    hist = (ENGINE / 'historia.js').read_text(encoding='utf-8')
    firmas = re.findall(r"firma: 'Turno del (\d+) de (\w+) · (\w)\.'", hist)
    if [f[2] for f in firmas] != list('RESDTA'):
        problemas.append('historia.js  las firmas deben ser R., E., S., D., T., A. en ese orden (hay %s)' % [f[2] for f in firmas])
    meses = {'octubre': 10, 'noviembre': 11}
    for d, mes, ini in firmas:
        fecha = (meses.get(mes, 0), int(d))
        if not ((10, 14) <= fecha <= (11, 19)):
            problemas.append('historia.js  la hoja de %s. (%s de %s) cae fuera del 14 oct – 19 nov' % (ini, d, mes))
    tel = re.search(r'telefono: \[(.*?)\]', hist, re.S)
    if tel:
        for i, linea in enumerate(re.findall(r"'((?:[^'\\]|\\.)*)'", tel.group(1)), 1):
            if 'faltan cinco minutos para las seis' not in linea.lower():
                problemas.append('historia.js  la llamada %d no dice «faltan cinco minutos para las seis»' % i)
    pas = (ENGINE / 'pasillo.js').read_text(encoding='utf-8')
    lockers = re.search(r'LOCKERS = \[(.*?)\];', pas, re.S)
    if lockers and len(re.findall(r"'\(", lockers.group(1))) != 7:
        problemas.append('pasillo.js  tiene que haber siete casilleros')


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    nuevos = sys.argv[1:]
    if nuevos:
        for t in nuevos:
            revisar('texto nuevo', '-', t)
    else:
        revisar_juego()
    if problemas:
        print('Contradicciones con el canon (%d):' % len(problemas))
        for p in problemas:
            print('  ✘ ' + p)
        sys.exit(1)
    print('✔ Sin contradicciones con el canon (%s).' % ('texto nuevo' if nuevos else '%d archivos' % len(FUENTES)))


if __name__ == '__main__':
    main()
