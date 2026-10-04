"""
Textos del juego para la versión en inglés (src/engine/textos_en.js).

  py herramientas/textos.py                      → cuántos textos hay y cuántos faltan por traducir
  py herramientas/textos.py --faltan f.json      → escribe la lista de los que faltan (para traducirlos)
  py herramientas/textos.py --agregar t.json     → valida un {español: inglés} y lo agrega al diccionario
  py herramientas/textos.py --sobran             → claves del diccionario que ya no aparecen en el juego

Qué cuenta como texto:
- index.html: lo mismo que traduce MR.I18N.translateDom (párrafos con formato enteros, con sus etiquetas; el
  resto nodo por nodo; atributos placeholder/title/aria-label; el <title>). Se salta translate="no".
- JavaScript: las cadenas literales con aspecto de texto visible (con espacios o letras acentuadas, o una palabra
  con mayúscula inicial), fuera de los shaders, rutas, colores y nombres internos.
"""
import html
import io
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

JUEGO = Path(__file__).resolve().parent.parent
DICC = JUEGO / 'src' / 'engine' / 'textos_en.js'
JS = sorted((JUEGO / 'src' / 'engine').glob('*.js')) + [JUEGO / 'src' / 'core' / 'shiftLog.js', JUEGO / 'src' / 'main.js']
SIN_TEXTO = {'retro.js', 'idioma.js', 'textos_en.js', 'input.js'}
LETRAS = re.compile(r'[A-Za-zÁÉÍÓÚáéíóúñÑ]')
INLINE = {'b', 'i', 'em', 'strong', 'span', 'br', 'kbd', 'small'}
VACIOS = {'br', 'input', 'img', 'meta', 'link', 'hr', 'source', 'wbr', 'area', 'base', 'col', 'embed', 'param', 'track'}
BLOQUEO = {'input', 'select', 'button', 'textarea'}


# ------------------------------------------------------------------------------------------------- HTML
class Nodo:
    def __init__(self, tag, attrs, svg, padre):
        self.tag, self.attrs, self.svg, self.padre, self.hijos = tag, attrs, svg, padre, []


class Arbol(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.raiz = Nodo('#doc', [], False, None)
        self.actual = self.raiz
        self.titulo = ''
        self._en_titulo = False

    def handle_starttag(self, tag, attrs):
        if tag == 'title':
            self._en_titulo = True
        svg = self.actual.svg or tag == 'svg'
        n = Nodo(tag, attrs, svg, self.actual)
        self.actual.hijos.append(n)
        if tag not in VACIOS:
            self.actual = n

    def handle_startendtag(self, tag, attrs):
        self.actual.hijos.append(Nodo(tag, attrs, self.actual.svg or tag == 'svg', self.actual))

    def handle_endtag(self, tag):
        if tag == 'title':
            self._en_titulo = False
        n = self.actual
        while n is not None and n.tag != tag:
            n = n.padre
        if n is not None and n.padre is not None:
            self.actual = n.padre

    def handle_data(self, data):
        if self._en_titulo:
            self.titulo += data
        self.actual.hijos.append(data)


def serializar(n):
    """innerHTML como lo devuelve el navegador (para el marcado sencillo de index.html)."""
    out = []
    for h in n.hijos:
        if isinstance(h, str):
            out.append(h.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('\xa0', '&nbsp;'))
        else:
            a = ''.join(' %s="%s"' % (k, (v or '').replace('&', '&amp;').replace('"', '&quot;')) for k, v in h.attrs)
            out.append('<%s%s>' % (h.tag, a))
            if h.tag not in VACIOS:
                out.append(serializar(h) + '</%s>' % h.tag)
    return ''.join(out)


def bloquea(n):
    return any(not isinstance(h, str) and (h.tag in BLOQUEO or bloquea(h)) for h in n.hijos)


def es_unidad(n):
    texto = inline = False
    for h in n.hijos:
        if isinstance(h, str):
            texto = texto or bool(LETRAS.search(h))
        else:
            if h.svg or h.tag not in INLINE or bloquea(h):
                return False
            inline = True
    return texto and inline


def norm(s):
    return re.sub(r'\s+', ' ', s).strip()


def textos_html():
    arbol = Arbol()
    arbol.feed((JUEGO / 'index.html').read_text(encoding='utf-8'))
    claves = [norm(arbol.titulo)]

    def body(n):
        for h in n.hijos:
            if not isinstance(h, str):
                if h.tag == 'body':
                    return h
                b = body(h)
                if b:
                    return b
        return None

    def recorrer(n):
        d = dict(n.attrs)
        if d.get('translate') == 'no' or n.tag in ('script', 'style'):
            return
        for a in ('placeholder', 'title', 'aria-label'):
            if d.get(a):
                claves.append(norm(d[a]))
        if es_unidad(n):
            claves.append(norm(serializar(n)))
            return
        for h in n.hijos:
            if isinstance(h, str):
                if LETRAS.search(h):
                    claves.append(norm(h))
            else:
                recorrer(h)

    recorrer(body(arbol.raiz))
    return [c for c in claves if c]


# ------------------------------------------------------------------------------------------------- JS
MAS_LITERAL = {q: re.compile(r'\s*\+\s*' + re.escape(q)) for q in '\'"`'}


def literales(fuente):
    """Cadenas entre comillas simples o dobles, saltando comentarios y expresiones regulares."""
    i, n, out, prev = 0, len(fuente), [], ''
    while i < n:
        c = fuente[i]
        if c == '/' and fuente[i + 1:i + 2] == '/':
            i = fuente.find('\n', i)
            i = n if i < 0 else i
            continue
        if c == '/' and fuente[i + 1:i + 2] == '*':
            j = fuente.find('*/', i + 2)
            i = n if j < 0 else j + 2
            continue
        if c == '/' and (prev in '(,=:[!&|?{};+' or prev == ''):
            j = i + 1
            clase = False
            while j < n and (fuente[j] != '/' or clase):
                if fuente[j] == '\\':
                    j += 1
                elif fuente[j] == '[':
                    clase = True
                elif fuente[j] == ']':
                    clase = False
                elif fuente[j] == '\n':
                    break
                j += 1
            i = j + 1
            prev = '/'
            continue
        if c in '\'"`':
            j = i + 1
            buf = []
            while j < n and fuente[j] != c:
                if fuente[j] == '\\':
                    buf.append(fuente[j:j + 2])
                    j += 2
                    continue
                buf.append(fuente[j])
                j += 1
            crudo = ''.join(buf)
            try:
                valor = json.loads('"' + crudo.replace('"', '\\"').replace("\\'", "'") + '"')
            except ValueError:
                valor = crudo
            i = j + 1
            if prev == '+lit' and out:
                out[-1] += valor  # 'a' + 'b': JavaScript los une en una sola cadena
            else:
                out.append(valor)
            m = MAS_LITERAL[c].match(fuente, i)
            if m:
                i = m.end() - 1  # sigue con el literal de después del +
                prev = '+lit'
                continue
            prev = 'x'
            continue
        if not c.isspace():
            prev = c
        i += 1
    return out


CODIGO = re.compile(r'gl_|vec[234]|uniform |varying |attribute |float |void main|texture2D|#define|\bpx\b|\d+px|rgba?\(|hsla?\(|'
                    r'\[type=|\(pointer:|display-mode|position\.|\bmod\(|https?:|www\.|\.(js|html|png|json|css|mp3|ogg)\b|^midnight-rinse/|^#[0-9a-f]{3,8}$|monospace|=>|\)\s*;\s*$')
NOMBRE = re.compile(r'^[\w\-./#:?=&%,*\[\]]+$')
NO_TEXTO = {'use strict', 'Escape', 'Enter'}  # nombres de teclas y directivas, no texto


def es_texto(s):
    t = s.strip()
    if not t or t in NO_TEXTO or not LETRAS.search(t) or CODIGO.search(t) or re.match(r'^\w+\($', t):
        return False
    if NOMBRE.match(t):
        # una sola palabra: solo si parece texto (Mayúscula inicial y minúsculas, o con acentos)
        return bool(re.match(r'^[A-ZÁÉÍÓÚ¿¡][a-záéíóúñ]+[.!?]?$', t) or re.search(r'[áéíóúñÁÉÍÓÚÑ¿¡]', t))
    if t.endswith(';') or t.endswith('{') or (t.endswith('}') and not re.search(r'\{\w+\}$', t)):
        return False
    return True


def textos_js():
    claves = []
    for f in JS:
        if f.name in SIN_TEXTO:
            continue
        for s in literales(f.read_text(encoding='utf-8')):
            if es_texto(s):
                claves.append(s.strip())
    return claves


# ------------------------------------------------------------------------------------------------- diccionario
def leer_dicc():
    s = DICC.read_text(encoding='utf-8')
    return json.loads(s[s.index('{', s.index('MR.TEXTOS_EN')):s.rindex('}') + 1])


def escribir_dicc(d):
    cuerpo = json.dumps(d, ensure_ascii=False, indent=1)
    DICC.write_text('/** Textos en inglés (clave: el texto original en español). Lo mantiene herramientas/textos.py. */\n'
                    'window.MR = window.MR || {};\nMR.TEXTOS_EN = ' + cuerpo + ';\n', encoding='utf-8', newline='\n')


def todas():
    vistas, out = set(), []
    for c in textos_html() + textos_js():
        if c not in vistas:
            vistas.add(c)
            out.append(c)
    return out


ETIQUETA = re.compile(r'<[^>]+>')
LLAVE = re.compile(r'\{\w+\}')


def problemas(es, en):
    """Qué está mal en una traducción (lista vacía si nada)."""
    p = []
    if not isinstance(en, str) or not en.strip():
        return ['vacía']
    if sorted(ETIQUETA.findall(es)) != sorted(ETIQUETA.findall(en)):
        p.append('etiquetas distintas')
    if sorted(LLAVE.findall(es)) != sorted(LLAVE.findall(en)):
        p.append('marcadores {x} distintos')
    if ('http' in en.lower() or 'www.' in en.lower()) and 'http' not in es.lower() and 'www.' not in es.lower():
        p.append('enlace nuevo')
    if '<script' in en.lower() or 'javascript:' in en.lower() or ' on' in ''.join(ETIQUETA.findall(en)).lower():
        p.append('código')
    if es.count('\n') != en.count('\n'):
        p.append('saltos de línea')
    if len(es) > 12 and not (0.35 <= len(en) / len(es) <= 2.6):
        p.append('largo raro (%d → %d)' % (len(es), len(en)))
    return p


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    args = sys.argv[1:]
    d = leer_dicc()
    claves = todas()
    if args[:1] == ['--faltan']:
        faltan = [c for c in claves if c not in d]
        Path(args[1]).write_text(json.dumps(faltan, ensure_ascii=False, indent=1), encoding='utf-8')
        print('%d textos sin traducir → %s' % (len(faltan), args[1]))
    elif args[:1] == ['--agregar']:
        nuevo = json.loads(Path(args[1]).read_text(encoding='utf-8'))
        malos = 0
        for es, en in nuevo.items():
            p = problemas(es, en)
            if p:
                malos += 1
                print('RECHAZADA (%s): %s' % (', '.join(p), es[:90]))
                continue
            d[es] = en
        escribir_dicc(d)
        print('agregadas %d, rechazadas %d · diccionario: %d' % (len(nuevo) - malos, malos, len(d)))
    elif args[:1] == ['--sobran']:
        s = set(claves)
        for k in d:
            if k not in s:
                print(k[:120])
    else:
        h = textos_html()
        print('textos: %d (HTML %d, JS %d) · traducidos %d · faltan %d' % (
            len(claves), len(set(h)), len(claves) - len(set(h)), sum(1 for c in claves if c in d), sum(1 for c in claves if c not in d)))


if __name__ == '__main__':
    main()
