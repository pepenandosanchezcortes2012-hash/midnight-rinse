"""Pruebas ocultas de la Arena 5 · detent_dial: todos los casos borde y las pruebas adversariales."""
import random
import tempfile
import unittest

from midnight_rinse_core.detent_dial import DetentDial


def angulos(clicks):
    return [c["angle"] for c in clicks]


class BaseTemporal(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)


class TestValidacionDeParametros(BaseTemporal):
    def test_detent_que_no_divide_360_lanza(self) -> None:
        for malo in (7, 7.0, 25, 25.0, 720, 0.7):
            with self.subTest(detent=malo):
                with self.assertRaises(ValueError):
                    DetentDial(malo, 0.5, 0.0)

    def test_detent_no_positivo_no_finito_o_bool_lanza(self) -> None:
        for malo in (0, 0.0, -15, -15.0, float("nan"), float("inf"), float("-inf"), True, False, "15", None):
            with self.subTest(detent=malo):
                with self.assertRaises(ValueError):
                    DetentDial(malo)

    def test_detents_validos(self) -> None:
        for bueno in (15, 15.0, 22.5, 360, 1, 0.5, 120):
            with self.subTest(detent=bueno):
                self.assertEqual(DetentDial(bueno, 0.5, 0.0).angle, 0.0)

    def test_resistance_fuera_de_rango_o_invalida_lanza(self) -> None:
        for malo in (1, 1.0, -0.1, -1, 1.5, float("nan"), float("inf"), True, False, "0.5", None):
            with self.subTest(resistance=malo):
                with self.assertRaises(ValueError):
                    DetentDial(15.0, malo, 3.0)

    def test_hysteresis_fuera_de_rango_o_invalida_lanza(self) -> None:
        for malo in (7.5, 8, -0.001, -1, float("nan"), float("inf"), True, False, "3", None):
            with self.subTest(hysteresis=malo):
                with self.assertRaises(ValueError):
                    DetentDial(15.0, 0.5, malo)
        self.assertEqual(DetentDial(15.0, 0.5, 7.4).angle, 0.0)
        self.assertEqual(DetentDial(15.0, 0.5, 0).angle, 0.0)

    def test_delta_invalido_lanza_y_no_altera_el_estado(self) -> None:
        dial = DetentDial(15.0, 0.0, 3.0)
        dial.drag(20.0)
        for malo in (float("nan"), float("inf"), float("-inf"), True, False, "5", None, [5]):
            with self.subTest(delta=malo):
                with self.assertRaises(ValueError):
                    dial.drag(malo)
        self.assertEqual(dial.angle, 20.0)
        self.assertEqual(angulos(dial.drag(10.0)), [30.0])

    def test_movimiento_efectivo_mayor_que_un_millon_lanza(self) -> None:
        dial = DetentDial(15.0, 0.0, 3.0)
        for malo in (1e6 + 1, -(1e6 + 1), 10 ** 7, 2e6 + 4):
            with self.subTest(delta=malo):
                with self.assertRaises(ValueError):
                    dial.drag(malo)
        self.assertEqual(dial.angle, 0.0)
        con_resistencia = DetentDial(15.0, 0.5, 3.0)
        with self.assertRaises(ValueError):
            con_resistencia.drag(2e6 + 4)

    def test_movimiento_efectivo_de_un_millon_exacto_es_valido(self) -> None:
        dial = DetentDial(15.0, 0.5, 3.0)
        clicks = dial.drag(2e6)
        self.assertEqual(len(clicks), 66666)
        self.assertEqual(clicks[0], {"type": "click", "angle": 15.0})
        self.assertEqual(clicks[23], {"type": "click", "angle": 0.0})
        self.assertEqual(dial.angle, 1e6 % 360.0)


class TestCrucesYClicks(BaseTemporal):
    def test_drag_cero(self) -> None:
        dial = DetentDial(15.0, 0.5, 3.0)
        self.assertEqual(dial.drag(0), [])
        self.assertEqual(dial.drag(0.0), [])
        self.assertEqual(dial.angle, 0.0)

    def test_setecientos_veinte_grados_efectivos(self) -> None:
        dial = DetentDial(15.0, 0.5, 3.0)
        clicks = dial.drag(1440.0)
        vuelta = [float((15 * k) % 360) for k in range(1, 25)]
        self.assertEqual(len(clicks), 48)
        self.assertEqual(angulos(clicks), vuelta + vuelta)
        self.assertTrue(all(c == {"type": "click", "angle": c["angle"]} for c in clicks))
        self.assertEqual(dial.angle, 0.0)

    def test_setecientos_veinte_grados_negativos(self) -> None:
        dial = DetentDial(15.0, 0.0, 3.0)
        clicks = dial.drag(-720.0)
        vuelta = [float((360 - 15 * k) % 360) for k in range(1, 25)]
        self.assertEqual(angulos(clicks), vuelta + vuelta)
        self.assertEqual(dial.angle, 0.0)

    def test_negativos_cruzando_el_cero(self) -> None:
        dial = DetentDial(15.0, 0.0, 3.0)
        dial.drag(20.0)
        self.assertEqual(angulos(dial.drag(-40.0)), [15.0, 0.0, 345.0])
        self.assertEqual(dial.angle, 340.0)

    def test_vibracion_sobre_un_reten_da_un_solo_click(self) -> None:
        dial = DetentDial(15.0, 0.0, 3.0)
        dial.drag(14.0)
        total = dial.drag(1.0)
        for _ in range(20):
            total += dial.drag(-0.5)
            total += dial.drag(0.5)
            total += dial.drag(0.5)
            total += dial.drag(-0.5)
        self.assertEqual(angulos(total), [15.0])

    def test_vibracion_al_inicio_sobre_el_cero(self) -> None:
        dial = DetentDial(15.0, 0.5, 3.0)
        total = []
        for _ in range(10):
            total += dial.drag(1.0)
            total += dial.drag(-1.0)
        self.assertEqual(angulos(total), [0.0])

    def test_vibracion_alrededor_del_cero_por_el_lado_negativo(self) -> None:
        dial = DetentDial(15.0, 0.0, 3.0)
        dial.drag(15.0)
        self.assertEqual(angulos(dial.drag(-15.0)), [0.0])
        total = []
        for _ in range(5):
            total += dial.drag(-0.5)
            self.assertEqual(dial.angle, 359.5)
            total += dial.drag(0.5)
        self.assertEqual(total, [], "la distancia al retén 0 es circular: 359.5 está a 0.5 grados del 0")

    def test_histeresis_cero_rearma_siempre(self) -> None:
        dial = DetentDial(15.0, 0.0, 0.0)
        dial.drag(14.5)
        total = []
        for _ in range(3):
            total += dial.drag(0.5)
            total += dial.drag(-0.5)
        self.assertEqual(angulos(total), [15.0, 15.0, 15.0])

    def test_cruce_de_359_a_0(self) -> None:
        dial = DetentDial(15.0, 0.0, 3.0)
        self.assertEqual(len(dial.drag(359.0)), 23)
        self.assertEqual(dial.drag(1.0), [{"type": "click", "angle": 0.0}])
        self.assertEqual(dial.angle, 0.0)

    def test_vuelta_completa_con_reten_desarmado_al_empezar(self) -> None:
        dial = DetentDial(15.0, 0.0, 3.0)
        dial.drag(15.0)
        clicks = dial.drag(360.0)
        self.assertEqual(angulos(clicks), [float((15 * k) % 360) for k in range(2, 25)])
        # Termina otra vez sobre 15 (distancia 0 < histéresis): el 15 sigue desarmado y su primer cruce no suena.
        self.assertEqual(angulos(dial.drag(360.0)), [float((15 * k) % 360) for k in range(2, 25)])
        dial.drag(-5.0)
        # A 5 grados (>= 3) el 15 se rearma: ahora sí suena al cruzarlo.
        self.assertEqual(angulos(dial.drag(5.0)), [15.0])

    def test_reten_cercano_no_se_rearma_dentro_de_la_histeresis(self) -> None:
        dial = DetentDial(15.0, 0.0, 3.0)
        dial.drag(15.0)
        dial.drag(-2.5)
        self.assertEqual(dial.drag(2.5), [])
        dial.drag(-3.0)
        self.assertEqual(angulos(dial.drag(3.0)), [15.0])

    def test_resistencia_cero_y_media(self) -> None:
        sin = DetentDial(15.0, 0.0, 3.0)
        media = DetentDial(15.0, 0.5, 3.0)
        self.assertEqual(angulos(sin.drag(30.0)), [15.0, 30.0])
        self.assertEqual(angulos(media.drag(60.0)), [15.0, 30.0])

    def test_resistencia_casi_uno_no_revienta(self) -> None:
        dial = DetentDial(15.0, 0.999, 3.0)
        clicks = dial.drag(100000.0)
        self.assertIsInstance(clicks, list)
        self.assertTrue(all(c["type"] == "click" and 0.0 <= c["angle"] < 360.0 for c in clicks))
        self.assertTrue(0.0 <= dial.angle < 360.0)

    def test_angulo_nunca_es_360(self) -> None:
        dial = DetentDial(15.0, 0.0, 3.0)
        self.assertEqual(dial.drag(-1e-14), [])
        self.assertEqual(dial.angle, 0.0)
        self.assertIsInstance(dial.angle, float)

    def test_clicks_son_floats_y_nunca_360(self) -> None:
        dial = DetentDial(15, 0, 3)
        clicks = dial.drag(1080)
        self.assertTrue(all(isinstance(c["angle"], float) and 0.0 <= c["angle"] < 360.0 for c in clicks))
        self.assertIsInstance(dial.angle, float)

    def test_determinista(self) -> None:
        rng = random.Random(2024)
        pasos = [rng.choice([-1, 1]) * rng.randrange(0, 2000) / 8 for _ in range(3000)]
        a = DetentDial(15.0, 0.5, 3.0)
        b = DetentDial(15.0, 0.5, 3.0)
        salida_a = [angulos(a.drag(p)) for p in pasos]
        salida_b = [angulos(b.drag(p)) for p in pasos]
        self.assertTrue(salida_a == salida_b, "la misma secuencia de drags no produjo los mismos clicks")
        self.assertEqual(a.angle, b.angle)


if __name__ == "__main__":
    unittest.main()
