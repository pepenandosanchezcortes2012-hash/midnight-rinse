"""Pruebas públicas de la Arena 2 · bayer_rgb555 (casos normales y algunos bordes)."""
import tempfile
import unittest

from midnight_rinse_core.bayer_rgb555 import quantize


class BaseTemporal(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)


class TestBayerPublicas(BaseTemporal):
    def test_negro(self) -> None:
        self.assertEqual(quantize((0.0, 0.0, 0.0), 0, 0), (0.0, 0.0, 0.0))

    def test_blanco(self) -> None:
        self.assertEqual(quantize((1.0, 1.0, 1.0), 5, 3), (1.0, 1.0, 1.0))

    def test_gris_medio_en_umbral_minimo(self) -> None:
        self.assertEqual(quantize((0.5, 0.5, 0.5), 0, 0), (15 / 31, 15 / 31, 15 / 31))

    def test_gris_medio_en_umbral_maximo(self) -> None:
        self.assertEqual(quantize((0.5, 0.5, 0.5), 0, 7), (16 / 31, 16 / 31, 16 / 31))

    def test_canales_independientes(self) -> None:
        self.assertEqual(quantize((0.0, 0.5, 1.0), 0, 0), (0.0, 15 / 31, 1.0))

    def test_valores_mayores_que_uno_se_limitan(self) -> None:
        self.assertEqual(quantize((1.5, 2, 1.0), 1, 1), (1.0, 1.0, 1.0))

    def test_devuelve_tupla_de_floats(self) -> None:
        salida = quantize((0.25, 0.5, 0.75), 2, 2)
        self.assertIsInstance(salida, tuple)
        self.assertEqual(len(salida), 3)
        self.assertTrue(all(isinstance(c, float) for c in salida))

    def test_periodico_cada_8_pixeles(self) -> None:
        self.assertEqual(quantize((0.3, 0.6, 0.9), 2, 5), quantize((0.3, 0.6, 0.9), 10, 13))

    def test_salida_multiplo_de_un_treintaiunavo(self) -> None:
        for c in quantize((0.123, 0.456, 0.789), 4, 6):
            self.assertAlmostEqual(c * 31, round(c * 31), places=9)

    def test_x_cadena_lanza(self) -> None:
        with self.assertRaises(ValueError):
            quantize((0.5, 0.5, 0.5), "1", 0)


if __name__ == "__main__":
    unittest.main()
