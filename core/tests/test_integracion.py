"""Prueba de integración: los 7 módulos juntos simulan un tramo del turno de medianoche."""
import datetime as dt
import os
import tempfile
import unittest

import midnight_rinse_core as core


class TestTurnoIntegrado(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.base = os.path.join(self._tmp.name, "records")

    def test_turno_de_medianoche(self) -> None:
        log = core.ShiftLog(self.base)
        self.assertEqual(log.update("start"), core.TEXTS["start"])

        dispatcher = core.Dispatcher()
        manos = core.SteppedHold(15)
        perilla = core.DetentDial(15.0, 0.5, 3.0)
        zona = dt.timezone(dt.timedelta(hours=-6))
        clicks = 0
        programados = 0
        disparados = []
        poses = []
        inicio = dt.datetime(2026, 10, 3, 1, 10, tzinfo=zona)
        for tick in range(60 * 60 * 4):  # 4 horas de juego a 1 tick por segundo de juego
            ahora = inicio + dt.timedelta(seconds=tick)
            multiplicador = core.anomaly_multiplier(ahora)
            if tick % int(600 / multiplicador) == 0:
                dispatcher.schedule(f"anomalia-{tick}", {"t": ahora.isoformat(), "susurros": core.whispers_active(ahora)},
                                    priority=int(multiplicador))
                programados += 1
            visibilidad = 0.0 if tick % 97 == 0 else 0.6
            disparados += dispatcher.tick(visibilidad, blink=(tick % 211 == 0))
            if tick % 4 == 0:
                clicks += len(perilla.drag(2.0))
            poses.append(manos.sample(tick / 60, {"tick": tick}))
            color = core.quantize((0.2, 0.4, 0.6), tick % 320, tick % 240)
            self.assertTrue(all(abs(c * 31 - round(c * 31)) < 1e-9 for c in color))
            x, y, z, w = core.snap((0.1 * (tick % 7), -0.05, 0.5, 1.0))
            self.assertAlmostEqual(x / w * 320, round(x / w * 320), delta=1e-6)

        ids = [e["event_id"] for e in disparados]
        self.assertGreater(len(ids), 0)
        self.assertEqual(len(ids), len(set(ids)), "ningún evento se dispara dos veces")
        self.assertEqual(len(ids) + dispatcher.pending(), programados, "ningún evento se pierde")
        # 3600 arrastres efectivos de 1 grado (resistencia 0.5): 10 vueltas = 240 clicks y vuelve a 0.
        self.assertEqual(clicks, 240)
        self.assertEqual(perilla.angle, 0.0)
        # Entre las 02:00 y las 05:00 las anomalías se programan 3 veces más seguido.
        dentro = sum(1 for e in disparados if 2 <= dt.datetime.fromisoformat(e["payload"]["t"]).hour < 5)
        fuera = sum(1 for e in disparados if not 2 <= dt.datetime.fromisoformat(e["payload"]["t"]).hour < 5)
        self.assertGreater(dentro, fuera)
        self.assertTrue(any(e["payload"]["susurros"] for e in disparados))
        self.assertIs(poses[1], poses[0])  # zero-order hold: la pose se retiene dentro del slot
        self.assertIsNot(poses[4], poses[0])  # t = 4/60 abre el slot siguiente a 15 Hz
        self.assertEqual(log.update("customer_talked"), core.TEXTS["customer_talked"])
        self.assertEqual(log.update("start"), core.TEXTS["customer_talked"])  # nunca retrocede
        self.assertEqual(log.update("collapse"), core.TEXTS["collapse"])
        with open(os.path.join(self.base, "shift_log.txt"), "rb") as handle:
            self.assertEqual(handle.read(), core.TEXTS["collapse"].encode("utf-8") + b"\n")


if __name__ == "__main__":
    unittest.main()
