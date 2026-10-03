"""Genera los iconos de la app (pixel art 32x32 escalado sin suavizar): una lavadora cuyo ojo de buey
tiene agua oscura... y dos ojos mirando. Salida en juego/iconos/.

    py juego/herramientas/iconos.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

DESTINO = Path(__file__).resolve().parent.parent / 'iconos'

FONDO = (5, 6, 8)
CUERPO = (216, 214, 204)
SOMBRA = (150, 147, 136)
ARO = (143, 138, 120)
VIDRIO = (22, 34, 48)
REMOLINO = (44, 74, 98)
OJO = (232, 236, 220)
AMARILLO = (226, 200, 75)
ROJO = (255, 70, 50)


def dibujar(tam=32):
    im = Image.new('RGB', (tam, tam), FONDO)
    d = ImageDraw.Draw(im)
    # Cuerpo de la lavadora con su panel superior.
    d.rectangle([5, 4, 26, 28], fill=CUERPO)
    d.rectangle([5, 27, 26, 28], fill=SOMBRA)
    d.rectangle([25, 4, 26, 28], fill=SOMBRA)
    d.rectangle([5, 4, 26, 8], fill=SOMBRA)
    d.rectangle([7, 5, 9, 7], fill=AMARILLO)   # perilla
    d.rectangle([22, 6, 23, 6], fill=ROJO)     # foco
    d.rectangle([12, 6, 19, 6], fill=(90, 88, 80))
    # Ojo de buey: aro, vidrio y agua.
    d.ellipse([8, 10, 23, 25], fill=ARO)
    d.ellipse([10, 12, 21, 23], fill=VIDRIO)
    d.arc([11, 13, 20, 22], 200, 340, fill=REMOLINO)
    d.arc([12, 15, 19, 21], 20, 160, fill=REMOLINO)
    # Dos ojos en el agua.
    d.rectangle([13, 17, 14, 17], fill=OJO)
    d.rectangle([17, 17, 18, 17], fill=OJO)
    # Brillo del vidrio.
    d.rectangle([11, 13, 11, 14], fill=(120, 150, 170))
    return im


def escalar(im, lado):
    return im.resize((lado, lado), Image.NEAREST)


def main():
    DESTINO.mkdir(exist_ok=True)
    base = dibujar()
    for lado in (192, 512):
        escalar(base, lado).save(DESTINO / ('icono-%d.png' % lado))
    escalar(base, 180).save(DESTINO / 'apple-touch-icon.png')
    # "Maskable": el dibujo al 72 % sobre fondo, para que el sistema pueda recortarlo en círculo o gota.
    mask = Image.new('RGB', (512, 512), FONDO)
    chico = escalar(base, 368)
    mask.paste(chico, ((512 - 368) // 2, (512 - 368) // 2))
    mask.save(DESTINO / 'icono-maskable-512.png')
    escalar(base, 32).save(DESTINO / 'favicon-32.png')
    print('iconos en', DESTINO)


if __name__ == '__main__':
    main()
