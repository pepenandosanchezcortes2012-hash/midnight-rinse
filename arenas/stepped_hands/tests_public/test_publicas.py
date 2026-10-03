"""Pruebas públicas de la Arena 4 · stepped_hands (casos normales y algunos bordes)."""
import tempfile
import unittest

from stepped_hands import SteppedHold


class BaseTemporal(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)


class TestSteppedHoldPublicas(BaseTemporal):
    def test_primera_llamada_captura(self) -> None:
        pose = {"mano": "abierta"}
        self.assertIs(SteppedHold().sample(0.0, pose), pose)

    def test_mismo_slot_devuelve_la_pose_retenida(self) -> None:
        h = SteppedHold(15)
        a, b = object(), object()
        h.sample(0.0, a)
        self.assertIs(h.sample(0.03, b), a)

    def test_slot_nuevo_captura(self) -> None:
        h = SteppedHold(15)
        a, b = object(), object()
        h.sample(0.0, a)
        self.assertIs(h.sample(0.1, b), b)

    def test_mismo_t_es_valido(self) -> None:
        h = SteppedHold(15)
        a = object()
        h.sample(0.5, a)
        self.assertIs(h.sample(0.5, object()), a)

    def test_cuatro_ticks_por_pose_a_60_hz(self) -> None:
        h = SteppedHold(15)
        poses = [object() for _ in range(24)]
        salida = [h.sample(i / 60, poses[i]) for i in range(24)]
        for i in range(24):
            self.assertIs(salida[i], poses[(i // 4) * 4], f"tick {i}")

    def test_hold_hz_uno(self) -> None:
        h = SteppedHold(1)
        a, b = object(), object()
        h.sample(0.25, a)
        self.assertIs(h.sample(0.75, b), a)
        self.assertIs(h.sample(1.5, b), b)

    def test_retroceso_grande_lanza(self) -> None:
        h = SteppedHold()
        h.sample(1.0, object())
        with self.assertRaises(ValueError):
            h.sample(0.5, object())

    def test_t_entero_es_valido(self) -> None:
        h = SteppedHold(15)
        a = object()
        self.assertIs(h.sample(2, a), a)

    def test_hold_hz_cadena_lanza(self) -> None:
        with self.assertRaises(ValueError):
            SteppedHold("15")


if __name__ == "__main__":
    unittest.main()
