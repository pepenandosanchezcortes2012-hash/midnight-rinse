"""Pruebas ocultas de la Arena 6 · clock_anomaly: todos los casos borde y las pruebas adversariales."""
import datetime as dt
import tempfile
import unittest

from midnight_rinse_core.clock_anomaly import anomaly_multiplier, whispers_active

CDMX = dt.timezone(dt.timedelta(hours=-6))


def hora(h: int, m: int = 0, s: int = 0, us: int = 0, tz=None) -> dt.datetime:
    return dt.datetime(2026, 10, 2, h, m, s, us, tzinfo=tz)


class BaseTemporal(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)

    def comprobar(self, momento: dt.datetime, multiplicador: float, susurros: bool) -> None:
        obtenido = anomaly_multiplier(momento)
        self.assertEqual(obtenido, multiplicador, f"multiplicador a las {momento.time()}")
        self.assertIsInstance(obtenido, float)
        self.assertIs(whispers_active(momento), susurros, f"susurros a las {momento.time()}")


class TestFronteras(BaseTemporal):
    def test_fronteras_del_multiplicador(self) -> None:
        self.comprobar(hora(1, 59, 59, 999999), 1.0, False)
        self.comprobar(hora(2, 0, 0, 0), 3.0, False)
        self.comprobar(hora(4, 59, 59, 999999), 3.0, False)
        self.comprobar(hora(5, 0, 0, 0), 1.0, False)

    def test_fronteras_de_los_susurros(self) -> None:
        self.comprobar(hora(2, 59, 59, 999999), 3.0, False)
        self.comprobar(hora(3, 0, 0, 0), 3.0, True)
        self.comprobar(hora(3, 59, 59, 999999), 3.0, True)
        self.comprobar(hora(4, 0, 0, 0), 3.0, False)

    def test_medianoche_y_fin_del_dia(self) -> None:
        self.comprobar(hora(0, 0, 0, 0), 1.0, False)
        self.comprobar(hora(23, 59, 59), 1.0, False)
        self.comprobar(hora(23, 59, 59, 999999), 1.0, False)

    def test_todo_el_dia_minuto_a_minuto(self) -> None:
        for minuto in range(24 * 60):
            h, m = divmod(minuto, 60)
            esperado_m = 3.0 if 2 <= h < 5 else 1.0
            esperado_s = h == 3
            if anomaly_multiplier(hora(h, m)) != esperado_m or whispers_active(hora(h, m)) is not esperado_s:
                self.fail(f"{h:02d}:{m:02d}")

    def test_extremos_del_calendario(self) -> None:
        self.comprobar(dt.datetime.min, 1.0, False)
        self.comprobar(dt.datetime.max, 1.0, False)
        self.comprobar(dt.datetime(1, 1, 1, 3, 30), 3.0, True)


class TestZonasHorarias(BaseTemporal):
    def test_datetime_con_zona_usa_la_hora_local_sin_convertir(self) -> None:
        self.comprobar(hora(3, 0, tz=CDMX), 3.0, True)
        self.comprobar(hora(1, 59, 59, 999999, tz=CDMX), 1.0, False)
        self.comprobar(hora(4, 59, tz=CDMX), 3.0, False)
        self.comprobar(hora(21, 0, tz=CDMX), 1.0, False)

    def test_misma_hora_con_y_sin_zona(self) -> None:
        for h in range(24):
            self.assertEqual(anomaly_multiplier(hora(h, 30, tz=CDMX)), anomaly_multiplier(hora(h, 30)))
            self.assertIs(whispers_active(hora(h, 30, tz=CDMX)), whispers_active(hora(h, 30)))


class TestTipos(BaseTemporal):
    def test_date_puro_lanza_type_error(self) -> None:
        for funcion in (anomaly_multiplier, whispers_active):
            with self.subTest(funcion=funcion.__name__):
                with self.assertRaises(TypeError):
                    funcion(dt.date(2026, 10, 2))

    def test_otros_tipos_lanzan_type_error(self) -> None:
        for malo in ("2026-10-02T03:00:00", "03:00", None, 3, 3.0, dt.time(3, 0), [hora(3)], dt.timedelta(hours=3)):
            for funcion in (anomaly_multiplier, whispers_active):
                with self.subTest(funcion=funcion.__name__, valor=malo):
                    with self.assertRaises(TypeError):
                        funcion(malo)

    def test_subclase_de_datetime_es_valida(self) -> None:
        class MiFecha(dt.datetime):
            pass

        self.comprobar(MiFecha(2026, 10, 2, 3, 15), 3.0, True)


if __name__ == "__main__":
    unittest.main()
