"""Pruebas públicas de la Arena 1 · blind_spot_dispatcher (casos normales y algunos bordes)."""
import tempfile
import unittest

from midnight_rinse_core.blind_spot_dispatcher import Dispatcher


class BaseTemporal(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.d = Dispatcher()


class TestDispatcherPublicas(BaseTemporal):
    def test_no_dispara_si_el_jugador_mira(self) -> None:
        self.d.schedule("sombra", {"x": 1})
        self.assertEqual(self.d.tick(1.0), [])
        self.assertEqual(self.d.tick(0.5), [])
        self.assertEqual(self.d.pending(), 1)

    def test_dispara_con_visibilidad_cero(self) -> None:
        self.d.schedule("sombra", {"x": 1})
        disparados = self.d.tick(0.0)
        self.assertEqual(disparados, [{"event_id": "sombra", "payload": {"x": 1}}])
        self.assertEqual(self.d.pending(), 0)

    def test_dispara_al_parpadear(self) -> None:
        self.d.schedule("puerta", {})
        self.assertEqual(len(self.d.tick(0.8, blink=True)), 1)
        self.assertEqual(self.d.pending(), 0)

    def test_payload_es_el_mismo_objeto(self) -> None:
        payload = {"sonido": "pasos"}
        self.d.schedule("pasos", payload)
        [evento] = self.d.tick(0)
        self.assertIs(evento["payload"], payload)

    def test_orden_por_prioridad(self) -> None:
        self.d.schedule("bajo", {}, priority=1)
        self.d.schedule("alto", {}, priority=10)
        self.d.schedule("medio", {}, priority=5)
        self.assertEqual([e["event_id"] for e in self.d.tick(0.0)], ["alto", "medio", "bajo"])

    def test_empate_respeta_orden_de_programacion(self) -> None:
        for nombre in ("primero", "segundo", "tercero"):
            self.d.schedule(nombre, {}, priority=3)
        self.assertEqual([e["event_id"] for e in self.d.tick(0.0)], ["primero", "segundo", "tercero"])

    def test_pending_cuenta_la_cola(self) -> None:
        self.assertEqual(self.d.pending(), 0)
        self.d.schedule("a", {})
        self.d.schedule("b", {})
        self.assertEqual(self.d.pending(), 2)

    def test_id_pendiente_duplicado_lanza(self) -> None:
        self.d.schedule("a", {})
        with self.assertRaises(ValueError):
            self.d.schedule("a", {})

    def test_id_vacio_lanza(self) -> None:
        with self.assertRaises(ValueError):
            self.d.schedule("", {})

    def test_cola_vacia_devuelve_lista_vacia(self) -> None:
        self.assertEqual(self.d.tick(0.0), [])


if __name__ == "__main__":
    unittest.main()
