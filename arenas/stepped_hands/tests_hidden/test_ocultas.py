"""Pruebas ocultas de la Arena 4 · stepped_hands: todos los casos borde y las pruebas adversariales."""
import tempfile
import unittest

from stepped_hands import SteppedHold


class BaseTemporal(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)


class TestFronteras(BaseTemporal):
    def test_fronteras_exactas_de_slot(self) -> None:
        h = SteppedHold(15)
        a, b, c = object(), object(), object()
        h.sample(0.0, a)
        self.assertIs(h.sample(1 / 15, b), b, "1/15 pertenece al slot 1")
        self.assertIs(h.sample(1 / 15, c), b)
        self.assertIs(h.sample(2 / 15, c), c, "2/15 pertenece al slot 2")

    def test_todas_las_fronteras_k_entre_15(self) -> None:
        h = SteppedHold(15)
        h.sample(0.0, object())
        for k in range(1, 400):
            nueva = object()
            self.assertIs(h.sample(k / 15, nueva), nueva, f"frontera {k}/15")

    def test_justo_antes_de_la_frontera_no_captura(self) -> None:
        h = SteppedHold(15)
        a = object()
        h.sample(0.0, a)
        self.assertIs(h.sample(1 / 15 - 1e-6, object()), a)

    def test_seis_mil_ticks_a_60_hz(self) -> None:
        h = SteppedHold(15)
        poses = [object() for _ in range(6000)]
        for i in range(6000):
            esperado = poses[(i // 4) * 4]
            obtenido = h.sample(i / 60, poses[i])
            if obtenido is not esperado:
                self.fail(f"tick {i}: la pose debía mantenerse exactamente 4 ticks")

    def test_otras_frecuencias(self) -> None:
        h = SteppedHold(30)
        poses = [object() for _ in range(600)]
        for i in range(600):
            if h.sample(i / 60, poses[i]) is not poses[(i // 2) * 2]:
                self.fail(f"hold_hz 30, tick {i}")


class TestTiempo(BaseTemporal):
    def test_retroceso_de_un_epsilon_lanza_y_no_altera_el_estado(self) -> None:
        h = SteppedHold(15)
        a = object()
        h.sample(1.0, a)
        for t in (1.0 - 1e-12, 0.9999999999999999, 0.0):
            with self.subTest(t=t):
                with self.assertRaises(ValueError):
                    h.sample(t, object())
        self.assertIs(h.sample(1.0, object()), a)

    def test_saltos_grandes_de_tiempo(self) -> None:
        h = SteppedHold(15)
        a, b, c = object(), object(), object()
        h.sample(0.0, a)
        self.assertIs(h.sample(1e6, b), b)
        self.assertIs(h.sample(1e6 + 0.01, c), b)
        self.assertIs(h.sample(1e12, c), c)

    def test_poses_mutables_no_se_copian(self) -> None:
        h = SteppedHold(15)
        pose = {"dedos": [1, 2, 3]}
        retenida = h.sample(0.0, pose)
        pose["dedos"].append(4)
        self.assertIs(h.sample(0.01, {"dedos": []}), pose)
        self.assertEqual(retenida["dedos"], [1, 2, 3, 4])

    def test_t_invalido_lanza_y_no_altera_el_estado(self) -> None:
        h = SteppedHold(15)
        a = object()
        h.sample(0.5, a)
        for malo in ("0.5", None, [0.5], 0.5j, True, False, float("nan"), float("inf"), float("-inf"), -1e-12, -1, -0.5):
            with self.subTest(t=malo):
                with self.assertRaises(ValueError):
                    h.sample(malo, object())
        self.assertIs(h.sample(0.5, object()), a)

    def test_t_negativo_en_la_primera_llamada_lanza(self) -> None:
        for malo in (-1e-12, -1, -0.5, -1e6, float("-inf")):
            with self.subTest(t=malo):
                h = SteppedHold(15)
                with self.assertRaises(ValueError):
                    h.sample(malo, object())
                a = object()
                self.assertIs(h.sample(0.0, a), a, "el error no debe dejar estado")

    def test_t_por_hold_no_finito_lanza(self) -> None:
        h = SteppedHold(15)
        with self.assertRaises(ValueError):
            h.sample(1e308, object())
        nueva = object()
        self.assertIs(h.sample(0.0, nueva), nueva, "el error no debe dejar estado")

    def test_error_en_la_primera_llamada_no_captura(self) -> None:
        h = SteppedHold(15)
        with self.assertRaises(ValueError):
            h.sample(float("nan"), object())
        a = object()
        self.assertIs(h.sample(3.0, a), a)

    def test_pose_none_se_retiene(self) -> None:
        h = SteppedHold(15)
        self.assertIsNone(h.sample(0.0, None))
        self.assertIsNone(h.sample(0.01, "otra"))
        self.assertEqual(h.sample(0.2, "otra"), "otra")


class TestHoldHz(BaseTemporal):
    def test_hold_hz_invalido_lanza(self) -> None:
        for malo in (0, -1, -15, 15.0, 1.0, True, False, "15", None, 15.5):
            with self.subTest(hold_hz=malo):
                with self.assertRaises(ValueError):
                    SteppedHold(malo)

    def test_hold_hz_validos(self) -> None:
        for bueno in (1, 15, 60, 1000):
            with self.subTest(hold_hz=bueno):
                a = object()
                self.assertIs(SteppedHold(bueno).sample(0.0, a), a)


if __name__ == "__main__":
    unittest.main()
