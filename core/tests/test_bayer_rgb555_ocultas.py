"""Pruebas ocultas de la Arena 2 · bayer_rgb555: todos los casos borde y las pruebas adversariales."""
import math
import random
import tempfile
import unittest

from midnight_rinse_core.bayer_rgb555 import quantize

M = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
]


def esperado(c: float, x: int, y: int) -> float:
    c = min(1.0, max(0.0, c))
    nivel = math.floor(c * 31 + (M[y % 8][x % 8] + 0.5) / 64)
    return min(31, max(0, nivel)) / 31


class BaseTemporal(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)


class TestValoresExactos(BaseTemporal):
    def test_cero_y_uno_en_los_64_pixeles(self) -> None:
        for y in range(8):
            for x in range(8):
                self.assertEqual(quantize((0.0, 1.0, 0), x, y), (0.0, 1.0, 0.0), f"pixel {x},{y}")
                self.assertEqual(quantize((1, 0, 1), x, y), (1.0, 0.0, 1.0), f"pixel {x},{y}")

    def test_valores_exactos_k_entre_31_en_los_64_pixeles(self) -> None:
        for k in range(32):
            c = k / 31
            for y in range(8):
                for x in range(8):
                    salida = quantize((c, c, c), x, y)
                    if salida != (k / 31,) * 3:
                        self.fail(f"k={k} en {x},{y}: {salida}")

    def test_formula_en_todos_los_umbrales(self) -> None:
        rng = random.Random(555)
        for _ in range(20000):
            x, y = rng.randrange(-64, 64), rng.randrange(-64, 64)
            rgb = (rng.randrange(0, 10001) / 10000, rng.randrange(-100, 1101) / 1000, rng.randrange(0, 997) / 997)
            obtenido = quantize(rgb, x, y)
            deseado = tuple(esperado(c, x, y) for c in rgb)
            if obtenido != deseado:
                self.fail(f"{rgb} en {x},{y}: {obtenido} != {deseado}")

    def test_matriz_no_traspuesta(self) -> None:
        # M[y][x]: en (x=1, y=0) el umbral es 32.5/64; en (x=0, y=1) es 48.5/64.
        self.assertEqual(quantize((0.5,) * 3, 1, 0), (esperado(0.5, 1, 0),) * 3)
        # c = 0.495: 15.345 + 0.5078 -> 15 en (1, 0); 15.345 + 0.7578 -> 16 en (0, 1).
        self.assertEqual(quantize((0.495,) * 3, 1, 0), (15 / 31,) * 3)
        self.assertEqual(quantize((0.495,) * 3, 0, 1), (16 / 31,) * 3)


class TestLimites(BaseTemporal):
    def test_negativos_e_infinitos_se_limitan(self) -> None:
        for y in range(8):
            for x in range(8):
                self.assertEqual(quantize((-0.5, float("-inf"), -3), x, y), (0.0, 0.0, 0.0))
                self.assertEqual(quantize((float("inf"), 7, 1.0000001), x, y), (1.0, 1.0, 1.0))

    def test_flotantes_diminutos(self) -> None:
        for diminuto in (5e-324, 1e-300, 1e-15, -1e-300):
            with self.subTest(c=diminuto):
                for y in range(8):
                    for x in range(8):
                        self.assertEqual(quantize((diminuto,) * 3, x, y), (0.0, 0.0, 0.0))

    def test_casi_uno_por_debajo(self) -> None:
        c = 1.0 - 1e-12
        for y in range(8):
            for x in range(8):
                self.assertEqual(quantize((c,) * 3, x, y), (esperado(c, x, y),) * 3)

    def test_nan_lanza(self) -> None:
        for rgb in ((float("nan"), 0.5, 0.5), (0.5, float("nan"), 0.5), (0.5, 0.5, float("nan"))):
            with self.subTest(rgb=rgb):
                with self.assertRaises(ValueError):
                    quantize(rgb, 0, 0)


class TestValidacion(BaseTemporal):
    def test_longitudes_incorrectas_lanzan(self) -> None:
        for rgb in ((0.5, 0.5), (0.5, 0.5, 0.5, 0.5), (), (0.5,)):
            with self.subTest(rgb=rgb):
                with self.assertRaises(ValueError):
                    quantize(rgb, 0, 0)

    def test_rgb_no_secuencia_lanza(self) -> None:
        for rgb in (None, 0.5, 3):
            with self.subTest(rgb=rgb):
                with self.assertRaises(ValueError):
                    quantize(rgb, 0, 0)

    def test_elementos_no_numericos_o_bool_lanzan(self) -> None:
        for rgb in (("0.5", 0.5, 0.5), (0.5, None, 0.5), (0.5, 0.5, [1]), (True, 0.5, 0.5), (0.5, False, 0.5),
                    (0.5, 0.5, 1j), "abc"):
            with self.subTest(rgb=rgb):
                with self.assertRaises(ValueError):
                    quantize(rgb, 0, 0)

    def test_x_y_negativos_son_validos_y_periodicos(self) -> None:
        for x, y in ((-1, -1), (-8, 0), (0, -9), (-17, -23)):
            with self.subTest(x=x, y=y):
                self.assertEqual(quantize((0.37, 0.61, 0.83), x, y), quantize((0.37, 0.61, 0.83), x % 8, y % 8))

    def test_x_y_bool_o_float_lanzan(self) -> None:
        for x, y in ((True, 0), (0, False), (1.0, 0), (0, 2.0), (0.5, 0), (None, 0), (0, "1")):
            with self.subTest(x=x, y=y):
                with self.assertRaises(ValueError):
                    quantize((0.5, 0.5, 0.5), x, y)


class TestPropiedades(BaseTemporal):
    def test_monotona_no_decreciente_por_pixel(self) -> None:
        for y in range(8):
            for x in range(8):
                previo = -1.0
                for i in range(0, 1201):
                    c = (i - 100) / 1000
                    valor = quantize((c, c, c), x, y)[0]
                    if valor < previo:
                        self.fail(f"no monótona en {x},{y} con c={c}")
                    previo = valor

    def test_determinista_y_periodica(self) -> None:
        rng = random.Random(8)
        for _ in range(3000):
            rgb = (rng.random(), rng.random(), rng.random())
            x, y = rng.randrange(0, 320), rng.randrange(0, 240)
            base = quantize(rgb, x, y)
            self.assertEqual(base, quantize(rgb, x, y))
            self.assertEqual(base, quantize(rgb, x + 8 * rng.randrange(1, 9), y - 8 * rng.randrange(1, 9)))


if __name__ == "__main__":
    unittest.main()
