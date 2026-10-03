"""Pruebas ocultas de la Arena 3 · vertex_snap: todos los casos borde y las pruebas adversariales.

Nota del orquestador: con la fórmula literal, la idempotencia solo se sostiene mientras el error de redondeo
(~4e-16 x nx) sea menor que EPS = 1e-9; medido: 0 fallos con |ndc| <= 1e4, 9.2 % con |ndc| <= 1e6. Por eso la
prueba de idempotencia de 100 000 vectores usa |ndc| <= 1e3 (un vértice real apenas pasa de 1) y en el borde 1e6
solo se comprueban la aceptación y la propiedad de cuadrícula.
"""
import math
import random
import tempfile
import unittest

from vertex_snap import snap


def formula(clip, vres=(320, 240)):
    x, y, z, w = clip
    nx = math.floor(x / w * vres[0] + 1e-9)
    ny = math.floor(y / w * vres[1] + 1e-9)
    return nx / vres[0] * w, ny / vres[1] * w, z, w


def cerca(a: float, b: float, rel: float = 1e-12) -> bool:
    return math.isclose(a, b, rel_tol=rel, abs_tol=0.0)


class BaseTemporal(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)

    def igual_a_formula(self, clip, vres=(320, 240)) -> None:
        obtenido = snap(clip, vres)
        deseado = formula(clip, vres)
        self.assertTrue(cerca(obtenido[0], deseado[0]) and cerca(obtenido[1], deseado[1]), f"{clip} {vres}: {obtenido} != {deseado}")
        self.assertEqual(obtenido[2:], tuple(clip[2:]))

    def en_cuadricula(self, salida, vres=(320, 240)) -> None:
        x, y, _, w = salida
        for valor, res in ((x, vres[0]), (y, vres[1])):
            celdas = valor / w * res
            self.assertLessEqual(abs(celdas - round(celdas)), 1e-6, f"{salida} no está en la cuadrícula")


class TestW(BaseTemporal):
    def test_w_muy_pequeno(self) -> None:
        for w in (1e-300, 1e-12, 5e-8):
            with self.subTest(w=w):
                clip = (0.3 * w, -0.7 * w, 0.0, w)
                self.igual_a_formula(clip)
                self.en_cuadricula(snap(clip))

    def test_w_muy_grande(self) -> None:
        for w in (1e300, 1e12, 7.5e8):
            with self.subTest(w=w):
                clip = (0.3 * w, -0.7 * w, 1.0, w)
                self.igual_a_formula(clip)
                self.en_cuadricula(snap(clip))

    def test_w_cero_negativo_o_invalido_lanza(self) -> None:
        for w in (0, 0.0, -0.0, -1e-300, -5.0, float("nan"), float("inf"), float("-inf"), True, None, "1"):
            with self.subTest(w=w):
                with self.assertRaises(ValueError):
                    snap((0.1, 0.1, 0.1, w))

    def test_x_entre_w_que_desborda_lanza(self) -> None:
        for clip in ((1e308, 0.0, 0.0, 1e-308), (0.0, -1e308, 0.0, 1e-10)):
            with self.subTest(clip=clip):
                with self.assertRaises(ValueError):
                    snap(clip)


class TestNdc(BaseTemporal):
    def test_ndc_negativos(self) -> None:
        for ndc in (-0.001, -0.5, -1.0, -1.3, -1 / 320, -2 / 240):
            with self.subTest(ndc=ndc):
                self.igual_a_formula((ndc * 2.0, ndc * 2.0, 0.0, 2.0))

    def test_ndc_exactos_en_la_rejilla(self) -> None:
        for k in range(-400, 401):
            obtenido = snap((k / 320 * 2.0, k / 240 * 2.0, 0.0, 2.0))
            if not (cerca(obtenido[0], k / 320 * 2.0) and cerca(obtenido[1], k / 240 * 2.0)):
                self.fail(f"k={k}: {obtenido}")

    def test_ndc_en_el_limite_de_un_millon(self) -> None:
        for clip in ((1e6, 0.0, 0.0, 1.0), (0.0, -1e6, 0.0, 1.0), (2e6, 2e6, 0.0, 2.0)):
            with self.subTest(clip=clip):
                salida = snap(clip)
                self.en_cuadricula(salida)
                self.assertEqual(salida[2:], clip[2:])

    def test_ndc_mayor_que_un_millon_lanza(self) -> None:
        for clip in ((1.0000001e6, 0.0, 0.0, 1.0), (0.0, -1.0000001e6, 0.0, 1.0), (1e7, 1e7, 0.0, 1.0)):
            with self.subTest(clip=clip):
                with self.assertRaises(ValueError):
                    snap(clip)


class TestValidacion(BaseTemporal):
    def test_nan_e_infinitos_lanzan(self) -> None:
        for i in range(4):
            for malo in (float("nan"), float("inf"), float("-inf")):
                clip = [0.1, 0.1, 0.1, 1.0]
                clip[i] = malo
                with self.subTest(posicion=i, valor=malo):
                    with self.assertRaises(ValueError):
                        snap(tuple(clip))

    def test_bool_o_no_numericos_en_clip_lanzan(self) -> None:
        for clip in ((True, 0.1, 0.1, 1.0), (0.1, False, 0.1, 1.0), (0.1, 0.1, True, 1.0), ("0.1", 0.1, 0.1, 1.0),
                     (0.1, None, 0.1, 1.0), (0.1, 0.1, 0.1, 1j)):
            with self.subTest(clip=clip):
                with self.assertRaises(ValueError):
                    snap(clip)

    def test_longitud_de_clip_incorrecta_lanza(self) -> None:
        for clip in ((0.1, 0.1, 1.0), (0.1, 0.1, 0.1, 1.0, 1.0), (), None, 5):
            with self.subTest(clip=clip):
                with self.assertRaises(ValueError):
                    snap(clip)

    def test_vres_invalida_lanza(self) -> None:
        for vres in ((0, 240), (320, 0), (-320, 240), (320, -1), (True, 240), (320, False), (320.0, 240), (320, 240.0),
                     (320,), (320, 240, 1), None, ("320", 240)):
            with self.subTest(vres=vres):
                with self.assertRaises(ValueError):
                    snap((0.1, 0.1, 0.1, 1.0), vres)

    def test_vres_no_estandar(self) -> None:
        for vres in ((1, 1), (7, 13), (1920, 1080), (256, 224), (3, 1000)):
            with self.subTest(vres=vres):
                clip = (0.4321, -0.8765, 0.5, 1.25)
                self.igual_a_formula(clip, vres)
                self.en_cuadricula(snap(clip, vres), vres)

    def test_z_y_w_no_cambian(self) -> None:
        clip = (0.3, 0.3, -12345.678912345, 9.5)
        salida = snap(clip)
        self.assertEqual((salida[2], salida[3]), (-12345.678912345, 9.5))
        self.assertEqual(snap((0.3, 0.3, 0.123456789, 1.0))[2], 0.123456789)
        entero = snap((1, 1, 3, 2))
        self.assertEqual((entero[2], entero[3]), (3, 2))


class TestIdempotencia(BaseTemporal):
    def test_cien_mil_vectores_aleatorios_idempotentes(self) -> None:
        rng = random.Random(320240)
        resoluciones = [(320, 240), (640, 480), (256, 224), (1, 1), (7, 13), (1920, 1080)]
        for i in range(100000):
            w = 10 ** rng.uniform(-3, 3)
            limite = 1000.0 if i % 10 == 0 else 4.0
            clip = (rng.uniform(-limite, limite) * w, rng.uniform(-limite, limite) * w, rng.uniform(-1, 1), w)
            vres = resoluciones[i % len(resoluciones)]
            uno = snap(clip, vres)
            dos = snap(uno, vres)
            if not all(cerca(a, b, 1e-9) for a, b in zip(uno, dos)):
                self.fail(f"no idempotente: {clip} {vres}: {uno} -> {dos}")
            x, y, _, ww = uno
            if abs(x / ww * vres[0] - round(x / ww * vres[0])) > 1e-6 or abs(y / ww * vres[1] - round(y / ww * vres[1])) > 1e-6:
                self.fail(f"fuera de la cuadrícula: {clip} {vres}: {uno}")


if __name__ == "__main__":
    unittest.main()
