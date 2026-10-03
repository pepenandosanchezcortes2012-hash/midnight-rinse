"""Pruebas públicas de la Arena 7 · shift_log (casos normales y algunos bordes)."""
import os
import tempfile
import unittest

from midnight_rinse_core.shift_log import ShiftLog

START = "Turno asignado sin incidencias. Recuerde fregar el pasillo central cada 45 minutos."
CUSTOMER = ("Turno asignado. NO lo mires directamente a la cara. Si te pregunta la hora, "
            "dile que faltan cinco minutos para las seis.")


class BaseTemporal(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.base = os.path.join(self._tmp.name, "records")
        self.archivo = os.path.join(self.base, "shift_log.txt")

    def leer(self) -> bytes:
        with open(self.archivo, "rb") as handle:
            return handle.read()


class TestShiftLogPublicas(BaseTemporal):
    def test_start_devuelve_el_texto_sin_salto(self) -> None:
        self.assertEqual(ShiftLog(self.base).update("start"), START)

    def test_archivo_contiene_texto_mas_salto(self) -> None:
        ShiftLog(self.base).update("start")
        self.assertEqual(self.leer(), START.encode("utf-8") + b"\n")

    def test_crea_base_dir(self) -> None:
        self.assertFalse(os.path.exists(self.base))
        ShiftLog(self.base).update("start")
        self.assertTrue(os.path.isdir(self.base))

    def test_avanza_de_fase(self) -> None:
        log = ShiftLog(self.base)
        log.update("start")
        self.assertEqual(log.update("customer_talked"), CUSTOMER)
        self.assertEqual(self.leer(), CUSTOMER.encode("utf-8") + b"\n")

    def test_no_retrocede(self) -> None:
        log = ShiftLog(self.base)
        log.update("customer_talked")
        self.assertEqual(log.update("start"), CUSTOMER)
        self.assertEqual(self.leer(), CUSTOMER.encode("utf-8") + b"\n")

    def test_repetir_la_misma_fase_es_idempotente(self) -> None:
        log = ShiftLog(self.base)
        self.assertEqual(log.update("start"), START)
        self.assertEqual(log.update("start"), START)
        self.assertEqual(self.leer(), START.encode("utf-8") + b"\n")

    def test_saltar_fases_hacia_adelante(self) -> None:
        log = ShiftLog(self.base)
        log.update("start")
        texto = log.update("collapse")
        self.assertTrue(texto.endswith("ser clara?"))

    def test_fase_desconocida_lanza(self) -> None:
        with self.assertRaises(ValueError):
            ShiftLog(self.base).update("fin")

    def test_otra_instancia_ve_el_estado_del_archivo(self) -> None:
        ShiftLog(self.base).update("customer_talked")
        self.assertEqual(ShiftLog(self.base).update("start"), CUSTOMER)


if __name__ == "__main__":
    unittest.main()
