"""Modulo shift_log para la gestion atomica y concurrente de turnos."""

from __future__ import annotations

import contextlib
import os
import tempfile
import threading
import time
import typing

try:
    import fcntl
except ImportError:
    fcntl = None  # type: ignore

try:
    import msvcrt
except ImportError:
    msvcrt = None  # type: ignore

PHASE_START: str = "start"
PHASE_CUSTOMER: str = "customer_talked"
PHASE_COLLAPSE: str = "collapse"

TEXT_START: str = (
    "Turno asignado sin incidencias. Recuerde fregar el pasillo central cada 45 minutos."
)
TEXT_CUSTOMER: str = (
    "Turno asignado. NO lo mires directamente a la cara. Si te pregunta la hora, "
    "dile que faltan cinco minutos para las seis."
)
TEXT_COLLAPSE: str = (
    "¿Por qué sigues limpiando si sabes que el agua nunca va a volver a ser clara?"
)

PHASE_TEXTS: typing.Dict[str, str] = {
    PHASE_START: TEXT_START,
    PHASE_CUSTOMER: TEXT_CUSTOMER,
    PHASE_COLLAPSE: TEXT_COLLAPSE,
}

BINARY_TO_PHASE: typing.Dict[bytes, str] = {
    TEXT_START.encode("utf-8") + b"\n": PHASE_START,
    TEXT_CUSTOMER.encode("utf-8") + b"\n": PHASE_CUSTOMER,
    TEXT_COLLAPSE.encode("utf-8") + b"\n": PHASE_COLLAPSE,
}

PHASE_RANKS: typing.Dict[str, int] = {
    PHASE_START: 1,
    PHASE_CUSTOMER: 2,
    PHASE_COLLAPSE: 3,
}

_DIR_LOCKS: typing.Dict[str, threading.Lock] = {}
_DIR_LOCKS_GUARD: threading.Lock = threading.Lock()


def _get_dir_lock(clean_path: str) -> threading.Lock:
    """Obtiene o crea un candado de hilo por directorio normalizado."""
    norm = os.path.abspath(clean_path)
    with _DIR_LOCKS_GUARD:
        lock = _DIR_LOCKS.get(norm)
        if lock is None:
            lock = threading.Lock()
            _DIR_LOCKS[norm] = lock
        return lock


class ShiftLog:
    """Gestor del archivo de registro de turnos."""

    def __init__(self, base_dir: str = "./records") -> None:
        """Inicializa el registro comprobando validez del directorio base."""
        if not isinstance(base_dir, str) or isinstance(base_dir, bool) or not base_dir:
            raise ValueError("base_dir debe ser una cadena no vacia.")
        clean_dir = base_dir.rstrip("/\\")
        if not clean_dir:
            clean_dir = base_dir
        if os.path.islink(clean_dir):
            raise ValueError("base_dir no puede ser un enlace simbolico.")
        file_path = os.path.join(base_dir, "shift_log.txt")
        clean_file = file_path.rstrip("/\\")
        if os.path.islink(clean_file):
            raise ValueError("shift_log.txt no puede ser un enlace simbolico.")
        self._base_dir: str = base_dir
        self._clean_base_dir: str = clean_dir
        self._file_path: str = file_path
        self._lock_path: str = os.path.join(base_dir, ".shift_log.lock")

    @contextlib.contextmanager
    def _lock_context(self) -> typing.Iterator[None]:
        """Adquiere candado de hilo y de archivo para sincronizacion."""
        dir_lock = _get_dir_lock(self._clean_base_dir)
        with dir_lock:
            if os.path.islink(self._clean_base_dir):
                raise ValueError("base_dir es un enlace simbolico.")
            if os.path.islink(self._file_path):
                raise ValueError("shift_log.txt es un enlace simbolico.")
            if os.path.islink(self._lock_path):
                raise ValueError(".shift_log.lock es un enlace simbolico.")
            os.makedirs(self._base_dir, exist_ok=True)
            if os.path.islink(self._clean_base_dir):
                raise ValueError("base_dir es un enlace simbolico.")
            if os.path.islink(self._file_path):
                raise ValueError("shift_log.txt es un enlace simbolico.")
            if os.path.islink(self._lock_path):
                raise ValueError(".shift_log.lock es un enlace simbolico.")

            fd = os.open(self._lock_path, os.O_RDWR | os.O_CREAT, 0o666)
            try:
                if msvcrt is not None:
                    deadline = time.monotonic() + 120.0
                    attempts = 0
                    while True:
                        try:
                            os.lseek(fd, 0, os.SEEK_SET)
                            msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
                            break
                        except OSError:
                            if time.monotonic() > deadline:
                                raise
                            attempts += 1
                            if attempts < 10:
                                time.sleep(0)
                            elif attempts < 50:
                                time.sleep(0.0005)
                            else:
                                time.sleep(0.002)
                elif fcntl is not None:
                    fcntl.flock(fd, fcntl.LOCK_EX)

                try:
                    yield
                finally:
                    if msvcrt is not None:
                        try:
                            os.lseek(fd, 0, os.SEEK_SET)
                            msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
                        except OSError:
                            pass
                    elif fcntl is not None:
                        try:
                            fcntl.flock(fd, fcntl.LOCK_UN)
                        except OSError:
                            pass
            finally:
                try:
                    os.close(fd)
                except OSError:
                    pass

    def _write_atomic(self, payload: bytes) -> None:
        """Escribe datos de forma atomica usando archivo temporal y os.replace."""
        fd, tmp_path = tempfile.mkstemp(
            dir=self._clean_base_dir,
            prefix=".tmp_shift_log_",
            suffix=".tmp",
        )
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(payload)
                f.flush()

            for attempt in range(50):
                try:
                    os.replace(tmp_path, self._file_path)
                    return
                except PermissionError:
                    if attempt == 49:
                        raise
                    time.sleep(0.010)
        except Exception:
            try:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
            except OSError:
                pass
            raise

    def update(self, phase: str) -> str:
        """Avanza la fase del turno de forma idempotente y no regresiva."""
        if not isinstance(phase, str) or isinstance(phase, bool) or phase not in PHASE_TEXTS:
            raise ValueError(f"Fase invalida: {phase!r}")

        clean_dir = self._clean_base_dir
        if os.path.islink(clean_dir):
            raise ValueError("base_dir es un enlace simbolico.")
        if os.path.islink(self._file_path):
            raise ValueError("shift_log.txt es un enlace simbolico.")
        if os.path.islink(self._lock_path):
            raise ValueError(".shift_log.lock es un enlace simbolico.")

        with self._lock_context():
            current_phase: typing.Optional[str] = None
            if os.path.exists(self._file_path):
                try:
                    with open(self._file_path, "rb") as f:
                        raw = f.read()
                    current_phase = BINARY_TO_PHASE.get(raw)
                except OSError:
                    current_phase = None

            should_write = (current_phase is None) or (
                PHASE_RANKS[phase] > PHASE_RANKS[current_phase]
            )

            if should_write:
                payload = PHASE_TEXTS[phase].encode("utf-8") + b"\n"
                self._write_atomic(payload)
                return PHASE_TEXTS[phase]
            else:
                return PHASE_TEXTS[current_phase]
