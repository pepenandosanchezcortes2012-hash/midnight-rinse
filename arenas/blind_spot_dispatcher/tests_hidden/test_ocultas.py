"""Pruebas ocultas de la Arena 1 · blind_spot_dispatcher: todos los casos borde y las pruebas adversariales."""
import random
import sys
import tempfile
import threading
import unittest

from blind_spot_dispatcher import Dispatcher


class BaseTemporal(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.d = Dispatcher()


class TestVisibilidad(BaseTemporal):
    def test_visibilidad_minima_no_dispara(self) -> None:
        self.d.schedule("e", {})
        self.assertEqual(self.d.tick(1e-12), [])
        self.assertEqual(self.d.pending(), 1)

    def test_cero_entero_y_flotante_disparan(self) -> None:
        self.d.schedule("e1", {})
        self.assertEqual(len(self.d.tick(0)), 1)
        self.d.schedule("e2", {})
        self.assertEqual(len(self.d.tick(0.0)), 1)

    def test_uno_entero_y_flotante_no_disparan(self) -> None:
        self.d.schedule("e", {})
        self.assertEqual(self.d.tick(1), [])
        self.assertEqual(self.d.tick(1.0), [])
        self.assertEqual(self.d.pending(), 1)

    def test_no_finitos_y_fuera_de_rango_lanzan(self) -> None:
        self.d.schedule("e", {})
        for malo in (float("nan"), float("inf"), float("-inf"), -1e-12, -0.5, -1, 1.0000001, 2, 1e300):
            with self.subTest(visibility=malo):
                with self.assertRaises(ValueError):
                    self.d.tick(malo)
        self.assertEqual(self.d.pending(), 1, "un ValueError no debe consumir eventos")

    def test_bool_y_tipos_no_numericos_lanzan(self) -> None:
        for malo in (True, False, "0", "0.0", None, [0], 0j):
            with self.subTest(visibility=malo):
                with self.assertRaises(ValueError):
                    self.d.tick(malo)

    def test_blink_no_bool_lanza(self) -> None:
        self.d.schedule("e", {})
        for malo in (1, 0, "True", None, 1.0):
            with self.subTest(blink=malo):
                with self.assertRaises(ValueError):
                    self.d.tick(0.5, blink=malo)
        self.assertEqual(self.d.pending(), 1)

    def test_blink_false_con_visibilidad_positiva_no_dispara(self) -> None:
        self.d.schedule("e", {})
        self.assertEqual(self.d.tick(0.3, blink=False), [])


class TestProgramacion(BaseTemporal):
    def test_reprogramar_tras_disparar(self) -> None:
        self.d.schedule("latido", {"n": 1})
        self.d.tick(0)
        self.d.schedule("latido", {"n": 2})
        [evento] = self.d.tick(0)
        self.assertEqual(evento, {"event_id": "latido", "payload": {"n": 2}})

    def test_duplicado_pendiente_no_altera_la_cola(self) -> None:
        primero = {"v": 1}
        self.d.schedule("x", primero)
        with self.assertRaises(ValueError):
            self.d.schedule("x", {"v": 2})
        [evento] = self.d.tick(0)
        self.assertIs(evento["payload"], primero)

    def test_payload_no_dict_lanza(self) -> None:
        for malo in ([], None, "x", 3, (("a", 1),)):
            with self.subTest(payload=malo):
                with self.assertRaises(ValueError):
                    self.d.schedule("e", malo)
        self.assertEqual(self.d.pending(), 0)

    def test_event_id_invalido_lanza(self) -> None:
        for malo in ("", None, 5, b"id", ["id"]):
            with self.subTest(event_id=malo):
                with self.assertRaises(ValueError):
                    self.d.schedule(malo, {})

    def test_priority_invalida_lanza(self) -> None:
        for malo in (True, False, 1.0, "1", None):
            with self.subTest(priority=malo):
                with self.assertRaises(ValueError):
                    self.d.schedule("e", {}, priority=malo)
        self.assertEqual(self.d.pending(), 0)

    def test_prioridades_negativas_y_grandes(self) -> None:
        self.d.schedule("neg", {}, priority=-5)
        self.d.schedule("enorme", {}, priority=10 ** 30)
        self.d.schedule("cero", {})
        self.assertEqual([e["event_id"] for e in self.d.tick(0)], ["enorme", "cero", "neg"])

    def test_salida_tiene_exactamente_dos_claves(self) -> None:
        self.d.schedule("e", {"k": "v"})
        [evento] = self.d.tick(0, blink=True)
        self.assertEqual(set(evento), {"event_id", "payload"})

    def test_cola_vacia_repetida(self) -> None:
        for _ in range(3):
            self.assertEqual(self.d.tick(0.0, blink=True), [])
        self.assertEqual(self.d.pending(), 0)


class TestVolumen(BaseTemporal):
    def test_cincuenta_mil_eventos_en_orden(self) -> None:
        rng = random.Random(1337)
        esperados = []
        for i in range(50000):
            prioridad = rng.randrange(-50, 50)
            self.d.schedule(f"ev{i}", {"i": i}, priority=prioridad)
            esperados.append((-prioridad, i))
        self.assertEqual(self.d.pending(), 50000)
        self.assertEqual(self.d.tick(0.5), [])
        disparados = self.d.tick(0)
        self.assertEqual(len(disparados), 50000)
        esperados.sort()
        obtenidos = [e["payload"]["i"] for e in disparados]
        orden = [i for _, i in esperados]
        # Sin assertEqual sobre listas enormes: su diff es cuadrático y agotaría el tiempo límite.
        primera = next((k for k, (a, b) in enumerate(zip(obtenidos, orden)) if a != b), None)
        self.assertIsNone(primera, f"orden incorrecto a partir de la posición {primera}")
        self.assertEqual(self.d.pending(), 0)


class TestConcurrenciaProbabilistica(BaseTemporal):
    """Prueba probabilística: el GIL oculta carreras; se fuerza el cambio de hilo y se repite 200 veces."""

    def setUp(self) -> None:
        super().setUp()
        self._intervalo = sys.getswitchinterval()
        sys.setswitchinterval(1e-6)
        self.addCleanup(sys.setswitchinterval, self._intervalo)

    def test_probabilistica_ocho_hilos_no_duplican_ni_pierden(self) -> None:
        for iteracion in range(200):
            d = Dispatcher()
            disparados = []
            candado = threading.Lock()
            errores = []

            def trabajador(t: int) -> None:
                try:
                    locales = []
                    for j in range(10):
                        d.schedule(f"{iteracion}-{t}-{j}", {"t": t, "j": j}, priority=j % 3)
                        if j % 3 == t % 3:
                            locales.extend(d.tick(0.0))
                        else:
                            locales.extend(d.tick(0.9))
                    with candado:
                        disparados.extend(locales)
                except Exception as exc:  # cualquier error de hilo hace fallar la prueba
                    errores.append(exc)

            hilos = [threading.Thread(target=trabajador, args=(t,)) for t in range(8)]
            for h in hilos:
                h.start()
            for h in hilos:
                h.join()
            disparados.extend(d.tick(0.0))
            self.assertEqual(errores, [])
            ids = [e["event_id"] for e in disparados]
            self.assertEqual(len(ids), 80, f"iteración {iteracion}: se perdieron o duplicaron eventos")
            self.assertEqual(len(set(ids)), 80, f"iteración {iteracion}: eventos duplicados")
            self.assertEqual(d.pending(), 0)


if __name__ == "__main__":
    unittest.main()
