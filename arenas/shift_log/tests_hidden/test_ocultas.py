"""Pruebas ocultas de la Arena 7 · shift_log: todos los casos borde y las pruebas adversariales."""
import multiprocessing
import os
import sys
import tempfile
import threading
import time
import unittest

from shift_log import ShiftLog

TEXTOS = {
    "start": "Turno asignado sin incidencias. Recuerde fregar el pasillo central cada 45 minutos.",
    "customer_talked": ("Turno asignado. NO lo mires directamente a la cara. Si te pregunta la hora, "
                        "dile que faltan cinco minutos para las seis."),
    "collapse": "¿Por qué sigues limpiando si sabes que el agua nunca va a volver a ser clara?",
}
FASES = ["start", "customer_talked", "collapse"]
VALIDOS = {t.encode("utf-8") + b"\n" for t in TEXTOS.values()}


def _proceso_trabajador(base_dir: str, fases: list) -> None:
    """Nivel de módulo para que funcione con multiprocessing 'spawn' (macOS y Windows)."""
    log = ShiftLog(base_dir)
    for fase in fases:
        log.update(fase)


def _borrar_con_reintentos(ruta: str) -> None:
    for _ in range(200):
        try:
            os.remove(ruta)
            return
        except FileNotFoundError:
            return
        except PermissionError:  # Windows: un lector lo tiene abierto
            time.sleep(0.005)
    raise AssertionError("no se pudo borrar el archivo de prueba")


def _crear_symlink(test: unittest.TestCase, destino: str, enlace: str, es_dir: bool) -> None:
    try:
        os.symlink(destino, enlace, target_is_directory=es_dir)
    except (OSError, NotImplementedError) as exc:
        test.skipTest(f"no se pueden crear enlaces simbólicos aquí: {exc}")


class BaseTemporal(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.tmp = self._tmp.name
        self.base = os.path.join(self.tmp, "records")
        self.archivo = os.path.join(self.base, "shift_log.txt")

    def leer(self, ruta: str = "") -> bytes:
        with open(ruta or self.archivo, "rb") as handle:
            return handle.read()

    def escribir(self, datos: bytes) -> None:
        os.makedirs(self.base, exist_ok=True)
        with open(self.archivo, "wb") as handle:
            handle.write(datos)


class TestFasesYTextos(BaseTemporal):
    def test_bytes_exactos_con_acentos_y_signo_de_apertura(self) -> None:
        log = ShiftLog(self.base)
        self.assertEqual(log.update("collapse"), TEXTOS["collapse"])
        esperado = TEXTOS["collapse"].encode("utf-8") + b"\n"
        self.assertEqual(self.leer(), esperado)
        self.assertTrue(self.leer().startswith("¿".encode("utf-8")))
        self.assertNotIn(b"\r", self.leer())

    def test_bytes_exactos_de_las_tres_fases(self) -> None:
        log = ShiftLog(self.base)
        for fase in FASES:
            self.assertEqual(log.update(fase), TEXTOS[fase])
            self.assertEqual(self.leer(), TEXTOS[fase].encode("utf-8") + b"\n")

    def test_fases_invalidas_lanzan_y_no_escriben(self) -> None:
        log = ShiftLog(self.base)
        for mala in ("", "../x", "../start", "start/../collapse", "START", "start\n", " start", None, 0, 1, ["start"],
                     b"start", ("start",), {"start": 1}):
            with self.subTest(fase=mala):
                with self.assertRaises(ValueError):
                    log.update(mala)
        self.assertFalse(os.path.exists(self.archivo))
        self.assertFalse(os.path.exists(os.path.join(self.tmp, "x")))

    def test_retroceso_no_escribe_nada(self) -> None:
        log = ShiftLog(self.base)
        log.update("collapse")
        antes = os.stat(self.archivo)
        for fase in ("start", "customer_talked"):
            self.assertEqual(log.update(fase), TEXTOS["collapse"])
        despues = os.stat(self.archivo)
        self.assertEqual((antes.st_ino, antes.st_mtime_ns, antes.st_size), (despues.st_ino, despues.st_mtime_ns, despues.st_size))

    def test_sin_temporales_residuales(self) -> None:
        log = ShiftLog(self.base)
        for fase in FASES:
            log.update(fase)
        restos = sorted(set(os.listdir(self.base)) - {"shift_log.txt", ".shift_log.lock"})
        self.assertEqual(restos, [])


class TestContenidoPreexistente(BaseTemporal):
    def test_contenido_ajeno_se_sobrescribe_con_start(self) -> None:
        self.escribir(b"contenido ajeno\n")
        self.assertEqual(ShiftLog(self.base).update("start"), TEXTOS["start"])
        self.assertEqual(self.leer(), TEXTOS["start"].encode("utf-8") + b"\n")

    def test_archivo_vacio_es_fase_ninguna(self) -> None:
        self.escribir(b"")
        self.assertEqual(ShiftLog(self.base).update("customer_talked"), TEXTOS["customer_talked"])

    def test_texto_sin_salto_o_con_crlf_es_ajeno(self) -> None:
        for datos in (TEXTOS["collapse"].encode("utf-8"), TEXTOS["collapse"].encode("utf-8") + b"\r\n",
                      TEXTOS["collapse"].encode("utf-8") + b"\n\n", TEXTOS["collapse"].encode("latin-1", "replace") + b"\n"):
            with self.subTest(datos=datos[-4:]):
                self.escribir(datos)
                self.assertEqual(ShiftLog(self.base).update("start"), TEXTOS["start"])
                self.assertEqual(self.leer(), TEXTOS["start"].encode("utf-8") + b"\n")

    def test_fase_valida_preexistente_se_respeta(self) -> None:
        self.escribir(TEXTOS["customer_talked"].encode("utf-8") + b"\n")
        self.assertEqual(ShiftLog(self.base).update("start"), TEXTOS["customer_talked"])

    def test_base_dir_existente_y_lock_que_queda_en_disco(self) -> None:
        os.makedirs(self.base)
        ShiftLog(self.base).update("start")
        self.assertTrue(os.path.exists(os.path.join(self.base, ".shift_log.lock")))
        self.assertEqual(ShiftLog(self.base + os.sep).update("collapse"), TEXTOS["collapse"])


class TestDirectorioPorDefecto(BaseTemporal):
    def setUp(self) -> None:
        super().setUp()
        self._cwd = os.getcwd()
        os.chdir(self.tmp)

    def tearDown(self) -> None:
        os.chdir(self._cwd)

    def test_valor_por_defecto_records(self) -> None:
        self.assertEqual(ShiftLog().update("start"), TEXTOS["start"])
        self.assertEqual(self.leer(os.path.join(self.tmp, "records", "shift_log.txt")), TEXTOS["start"].encode("utf-8") + b"\n")


class TestEnlacesSimbolicos(BaseTemporal):
    def test_base_dir_enlace_lanza_y_no_escribe(self) -> None:
        real = os.path.join(self.tmp, "real")
        os.makedirs(real)
        enlace = os.path.join(self.tmp, "enlace")
        _crear_symlink(self, real, enlace, True)
        with self.assertRaises(ValueError):
            ShiftLog(enlace).update("start")
        self.assertEqual(os.listdir(real), [])

    def test_base_dir_enlace_con_barra_final_lanza(self) -> None:
        real = os.path.join(self.tmp, "real")
        os.makedirs(real)
        enlace = os.path.join(self.tmp, "enlace")
        _crear_symlink(self, real, enlace, True)
        for sufijo in (os.sep, "/", os.sep * 2):
            with self.subTest(sufijo=sufijo):
                with self.assertRaises(ValueError):
                    ShiftLog(enlace + sufijo).update("start")
        self.assertEqual(os.listdir(real), [])

    def test_archivo_enlace_lanza_y_no_escribe(self) -> None:
        os.makedirs(self.base)
        victima = os.path.join(self.tmp, "victima.txt")
        with open(victima, "wb") as handle:
            handle.write(b"intacto")
        _crear_symlink(self, victima, self.archivo, False)
        with self.assertRaises(ValueError):
            ShiftLog(self.base).update("collapse")
        self.assertEqual(self.leer(victima), b"intacto")


@unittest.skipIf(os.name == "nt" or (hasattr(os, "geteuid") and os.geteuid() == 0),
                 "permisos de escritura: no aplica en Windows ni como root")
class TestSinPermiso(BaseTemporal):
    def test_base_dir_sin_permiso_de_escritura(self) -> None:
        os.makedirs(self.base)
        os.chmod(self.base, 0o500)
        self.addCleanup(os.chmod, self.base, 0o700)
        with self.assertRaises((OSError, ValueError)):
            ShiftLog(self.base).update("start")
        self.assertFalse(os.path.exists(self.archivo))


class TestConcurrenciaProbabilistica(BaseTemporal):
    """Pruebas probabilísticas: el GIL oculta carreras; se fuerza el cambio de hilo y se repiten muchas veces."""

    def setUp(self) -> None:
        super().setUp()
        self._intervalo = sys.getswitchinterval()
        sys.setswitchinterval(1e-6)
        self.addCleanup(sys.setswitchinterval, self._intervalo)

    def test_probabilistica_ocho_hilos_terminan_en_la_fase_mas_avanzada(self) -> None:
        for iteracion in range(200):
            base = os.path.join(self.tmp, f"h{iteracion}")
            pedidas = [FASES[(iteracion + t) % 3] if t % 4 else FASES[t % 2] for t in range(8)]
            errores = []

            def trabajador(fase: str) -> None:
                try:
                    ShiftLog(base).update(fase)
                except Exception as exc:  # cualquier error de hilo hace fallar la prueba
                    errores.append(exc)

            hilos = [threading.Thread(target=trabajador, args=(f,)) for f in pedidas]
            for h in hilos:
                h.start()
            for h in hilos:
                h.join()
            self.assertEqual(errores, [])
            mas_avanzada = max(pedidas, key=FASES.index)
            self.assertEqual(self.leer(os.path.join(base, "shift_log.txt")), TEXTOS[mas_avanzada].encode("utf-8") + b"\n",
                             f"iteración {iteracion}: {pedidas}")

    def test_probabilistica_ocho_hilos_y_cuatro_procesos_spawn(self) -> None:
        ctx = multiprocessing.get_context("spawn")
        for iteracion in range(3):
            base = os.path.join(self.tmp, f"p{iteracion}")
            os.makedirs(base)
            secuencias = [["start", "customer_talked", "start"] * 5, ["customer_talked", "start"] * 8,
                          ["start"] * 12 + ["collapse"], ["customer_talked"] * 10]
            procesos = [ctx.Process(target=_proceso_trabajador, args=(base, s)) for s in secuencias]
            for p in procesos:
                p.start()
            errores = []

            def trabajador(t: int) -> None:
                try:
                    log = ShiftLog(base)
                    for k in range(6):
                        log.update(FASES[(t + k) % 2])
                except Exception as exc:
                    errores.append(exc)

            hilos = [threading.Thread(target=trabajador, args=(t,)) for t in range(8)]
            for h in hilos:
                h.start()
            for h in hilos:
                h.join()
            for p in procesos:
                p.join(120)
                self.assertEqual(p.exitcode, 0, f"un proceso hijo falló o no terminó (iteración {iteracion})")
            self.assertEqual(errores, [])
            self.assertEqual(self.leer(os.path.join(base, "shift_log.txt")), TEXTOS["collapse"].encode("utf-8") + b"\n")

    def test_probabilistica_lector_en_bucle_ve_siempre_un_texto_valido(self) -> None:
        log = ShiftLog(self.base)
        log.update("start")
        parar = threading.Event()
        malas = []
        lecturas = [0]

        def lector() -> None:
            while not parar.is_set():
                try:
                    with open(self.archivo, "rb") as handle:
                        datos = handle.read()
                except (FileNotFoundError, PermissionError):
                    continue
                lecturas[0] += 1
                if datos not in VALIDOS:
                    malas.append(datos[:60])

        hilo = threading.Thread(target=lector)
        hilo.start()
        try:
            for i in range(2000):
                if i % 3 == 0:
                    _borrar_con_reintentos(self.archivo)
                self.assertEqual(log.update(FASES[i % 3]), TEXTOS[FASES[i % 3]])
        finally:
            parar.set()
            hilo.join()
        self.assertEqual(malas, [], "el lector vio un archivo incompleto o mezclado")
        self.assertGreater(lecturas[0], 0)


if __name__ == "__main__":
    unittest.main()
