"""Pruebas públicas de la Arena 6 · clock_anomaly (casos normales y algunos bordes)."""
import tempfile
import unittest
from datetime import datetime

from clock_anomaly import anomaly_multiplier, whispers_active


def hora(h: int, m: int = 0, s: int = 0, us: int = 0) -> datetime:
    return datetime(2026, 10, 2, h, m, s, us)


class BaseTemporal(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)


class TestClockPublicas(BaseTemporal):
    def test_multiplicador_en_la_ventana(self) -> None:
        self.assertEqual(anomaly_multiplier(hora(2, 30)), 3.0)
        self.assertEqual(anomaly_multiplier(hora(4, 15)), 3.0)

    def test_multiplicador_fuera_de_la_ventana(self) -> None:
        self.assertEqual(anomaly_multiplier(hora(1, 0)), 1.0)
        self.assertEqual(anomaly_multiplier(hora(12, 0)), 1.0)

    def test_multiplicador_es_float(self) -> None:
        self.assertIsInstance(anomaly_multiplier(hora(3)), float)
        self.assertIsInstance(anomaly_multiplier(hora(9)), float)

    def test_susurros_activos(self) -> None:
        self.assertIs(whispers_active(hora(3, 30)), True)

    def test_susurros_inactivos(self) -> None:
        self.assertIs(whispers_active(hora(2, 30)), False)
        self.assertIs(whispers_active(hora(5, 30)), False)

    def test_otro_dia_mismo_horario(self) -> None:
        self.assertEqual(anomaly_multiplier(datetime(1999, 12, 31, 2, 0)), 3.0)
        self.assertIs(whispers_active(datetime(2040, 2, 29, 3, 0)), True)

    def test_entero_lanza_type_error(self) -> None:
        with self.assertRaises(TypeError):
            anomaly_multiplier(3)
        with self.assertRaises(TypeError):
            whispers_active(3)

    def test_mediodia(self) -> None:
        self.assertEqual((anomaly_multiplier(hora(12)), whispers_active(hora(12))), (1.0, False))


if __name__ == "__main__":
    unittest.main()
