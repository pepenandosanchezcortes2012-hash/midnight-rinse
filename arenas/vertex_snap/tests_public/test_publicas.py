"""Pruebas públicas de la Arena 3 · vertex_snap (casos normales y algunos bordes)."""
import math
import tempfile
import unittest

from vertex_snap import snap


def cerca(a: float, b: float) -> bool:
    return math.isclose(a, b, rel_tol=1e-12, abs_tol=0.0)


class BaseTemporal(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)


class TestSnapPublicas(BaseTemporal):
    def test_origen(self) -> None:
        self.assertEqual(snap((0.0, 0.0, 0.5, 1.0)), (0.0, 0.0, 0.5, 1.0))

    def test_valor_en_la_rejilla(self) -> None:
        x, y, z, w = snap((0.5, 0.25, 0.3, 1.0))
        self.assertTrue(cerca(x, 0.5) and cerca(y, 0.25))
        self.assertEqual((z, w), (0.3, 1.0))

    def test_ajusta_hacia_abajo_dentro_de_la_celda(self) -> None:
        x, y, _, _ = snap((0.5 + 0.4 / 320, 0.25 + 0.4 / 240, 0.0, 1.0))
        self.assertTrue(cerca(x, 160 / 320) and cerca(y, 60 / 240))

    def test_escala_con_w(self) -> None:
        x, y, z, w = snap((1.0, 0.5, 2.0, 2.0))
        self.assertTrue(cerca(x, 160 / 320 * 2.0) and cerca(y, 60 / 240 * 2.0))
        self.assertEqual(w, 2.0)

    def test_ndc_negativo_usa_floor(self) -> None:
        x, _, _, _ = snap((-0.001, 0.0, 0.0, 1.0))
        self.assertTrue(cerca(x, -1 / 320))

    def test_resolucion_personalizada(self) -> None:
        x, y, _, _ = snap((0.3, 0.3, 0.0, 1.0), (640, 480))
        self.assertTrue(cerca(x, math.floor(0.3 * 640 + 1e-9) / 640) and cerca(y, math.floor(0.3 * 480 + 1e-9) / 480))

    def test_resultado_en_la_cuadricula(self) -> None:
        x, y, _, w = snap((0.123, -0.456, 0.0, 3.0))
        self.assertAlmostEqual(x / w * 320, round(x / w * 320), delta=1e-6)
        self.assertAlmostEqual(y / w * 240, round(y / w * 240), delta=1e-6)

    def test_idempotente_simple(self) -> None:
        v = snap((0.777, 0.111, 1.0, 1.5))
        self.assertTrue(all(cerca(a, b) for a, b in zip(snap(v), v)))

    def test_w_no_positivo_lanza(self) -> None:
        for w in (0.0, -1.0):
            with self.subTest(w=w):
                with self.assertRaises(ValueError):
                    snap((0.1, 0.1, 0.1, w))

    def test_devuelve_tupla_de_cuatro(self) -> None:
        salida = snap((0.2, 0.2, 0.2, 1.0))
        self.assertIsInstance(salida, tuple)
        self.assertEqual(len(salida), 4)


if __name__ == "__main__":
    unittest.main()
