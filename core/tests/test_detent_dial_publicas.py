"""Pruebas públicas de la Arena 5 · detent_dial (casos normales y algunos bordes)."""
import tempfile
import unittest

from midnight_rinse_core.detent_dial import DetentDial


def angulos(clicks):
    return [c["angle"] for c in clicks]


class BaseTemporal(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)


class TestDetentDialPublicas(BaseTemporal):
    def test_angulo_inicial(self) -> None:
        self.assertEqual(DetentDial().angle, 0.0)

    def test_resistencia_por_defecto_reduce_el_movimiento(self) -> None:
        dial = DetentDial()
        self.assertEqual(dial.drag(30.0), [{"type": "click", "angle": 15.0}])
        self.assertEqual(dial.angle, 15.0)

    def test_varios_retenes_en_orden(self) -> None:
        dial = DetentDial(15.0, 0.0, 3.0)
        self.assertEqual(angulos(dial.drag(45.0)), [15.0, 30.0, 45.0])

    def test_sentido_negativo(self) -> None:
        dial = DetentDial(15.0, 0.0, 3.0)
        self.assertEqual(angulos(dial.drag(-30.0)), [345.0, 330.0])
        self.assertEqual(dial.angle, 330.0)

    def test_caer_exactamente_en_un_reten_cuenta(self) -> None:
        dial = DetentDial(15.0, 0.0, 3.0)
        dial.drag(10.0)
        self.assertEqual(angulos(dial.drag(5.0)), [15.0])

    def test_salir_de_un_reten_no_cuenta(self) -> None:
        dial = DetentDial(15.0, 0.0, 3.0)
        dial.drag(15.0)
        self.assertEqual(dial.drag(5.0), [])

    def test_empezar_sobre_un_reten_no_emite(self) -> None:
        dial = DetentDial(15.0, 0.0, 3.0)
        self.assertEqual(dial.drag(5.0), [])

    def test_regresar_al_cero_emite_click_cero(self) -> None:
        dial = DetentDial(15.0, 0.0, 3.0)
        dial.drag(15.0)
        self.assertEqual(angulos(dial.drag(-15.0)), [0.0])

    def test_histeresis_rearma_lejos_del_reten(self) -> None:
        dial = DetentDial(15.0, 0.0, 3.0)
        dial.drag(15.0)
        dial.drag(-4.0)
        self.assertEqual(angulos(dial.drag(4.0)), [15.0])

    def test_reten_de_22_5_grados(self) -> None:
        dial = DetentDial(22.5, 0.0, 2.0)
        self.assertEqual(angulos(dial.drag(45.0)), [22.5, 45.0])

    def test_resistencia_uno_lanza(self) -> None:
        with self.assertRaises(ValueError):
            DetentDial(15.0, 1.0, 3.0)


if __name__ == "__main__":
    unittest.main()
