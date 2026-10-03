"""Modulo shift_log para la gestion atomica y concurrente de turnos."""
from __future__ import annotations

import contextlib
import os
import random
import sys
import tempfile
import threading
import time
import typing

try:
    import fcntl
except ImportError:
    fcntl = None

try:
    import msvcrt
except ImportError:
    msvcrt = None

PHASES: typing.Dict[str, str] = {
    "start": (
        "Turno asignado sin incidencias. Recuerde fregar el pasillo central cada 45 minutos."
    ),
    "customer_talked": (
        "Turno asignado. NO lo mires directamente a la cara. Si te pregunta la hora, "
        "dile que faltan cinco minutos para las seis."
    ),
    "collapse": (
        "¿Por qué sigues limpiando si sabes que el agua nunca va a volver a ser clara?"
    ),
}

PHASE_ORDER: typing.Dict[str, int] = {
    "start": 0,
    "customer_talked": 1,
    "collapse": 2,
}

TEXT_TO_PHASE: typing.Dict[bytes, str] = {
    texto.encode("utf-8") + b"\n": fase for fase, texto in PHASES.items()
}

_DIR_LOCKS: typing.Dict[str, threading.Lock] = {}
_DIR_LOCKS_GUARD = threading.Lock()


def _get_dir_lock(canonical_dir: str) -> threading.Lock:
    """Obtiene o crea un cerrojo de hilo por cada directorio canonico."""
    with _DIR_LOCKS_GUARD:
        lock = _DIR_LOCKS.get(canonical_dir)
        if lock is None:
            lock = threading.Lock()
            _DIR_LOCKS[canonical_dir] = lock
        return lock


@contextlib.contextmanager
def _interprocess_file_lock(lock_path: str) -> typing.Iterator[None]:
    """Gestiona el candado interproceso usando fcntl en Unix o msvcrt en Windows."""
    if fcntl is not None:
        file_desc = os.open(lock_path, os.O_RDWR | os.O_CREAT, 0o666)
        try:
            fcntl.flock(file_desc, fcntl.LOCK_EX)
            try:
                yield
            finally:
                try:
                    fcntl.flock(file_desc, fcntl.LOCK_UN)
                except OSError:
                    pass
        finally:
            os.close(file_desc)
    elif msvcrt is not None:
        file_desc = os.open(lock_path, os.O_RDWR | os.O_CREAT, 0o666)
        is_locked = False
        try:
            try:
                if os.lseek(file_desc, 0, os.SEEK_END) == 0:
                    os.write(file_desc, b"\0")
            except OSError:
                pass

            delay = 0.001
            start_time = time.monotonic()
            while True:
                try:
                    os.lseek(file_desc, 0, os.SEEK_SET)
                    msvcrt.locking(file_desc, msvcrt.LK_NBLCK, 1)
                    is_locked = True
                    break
                except OSError:
                    if time.monotonic() - start_time > 120.0:
                        raise TimeoutError("Tiempo de espera agotado al adquirir candado")
                    jitter = random.uniform(0.5, 1.5)
                    time.sleep(delay * jitter)
                    delay = min(0.02, delay * 1.5)
            try:
                yield
            finally:
                if is_locked:
                    try:
                        os.lseek(file_desc, 0, os.SEEK_SET)
                        msvcrt.locking(file_desc, msvcrt.LK_UNLCK, 1)
                    except OSError:
                        pass
        finally:
            os.close(file_desc)
    else:
        yield


class ShiftLog:
    """Controlador del archivo de turnos con garantia de atomicidad y no regresion."""

    def __init__(self, base_dir: str = "./records") -> None:
        """Inicializa la instancia comprobando la validez basica de base_dir."""
        if isinstance(base_dir, bool) or not isinstance(base_dir, str):
            raise ValueError("base_dir debe ser una cadena de texto valida")
        if not base_dir.strip():
            raise ValueError("base_dir no puede ser una cadena vacia")
        if "\0" in base_dir:
            raise ValueError("base_dir no puede contener bytes nulos")

        clean_base = base_dir.rstrip("/\\") or base_dir
        if os.path.islink(clean_base):
            raise ValueError("base_dir no puede ser un enlace simbolico")

        self.base_dir = base_dir
        self._file_path = os.path.join(base_dir, "shift_log.txt")
        self._lock_path = os.path.join(base_dir, ".shift_log.lock")

    def _validate_symlinks(self) -> None:
        """Verifica que ni base_dir ni el archivo objetivo sean enlaces simbolicos."""
        clean_base = self.base_dir.rstrip("/\\") or self.base_dir
        if os.path.islink(clean_base):
            raise ValueError("base_dir no puede ser un enlace simbolico")

        clean_file = self._file_path.rstrip("/\\") or self._file_path
        if os.path.islink(clean_file):
            raise ValueError("shift_log.txt no puede ser un enlace simbolico")

    def update(self, phase: str) -> str:
        """Actualiza la fase del turno de forma atomica y sin retroceso."""
        if isinstance(phase, bool) or not isinstance(phase, str) or phase not in PHASES:
            raise ValueError(f"Fase no permitida o invalida: {phase!r}")

        self._validate_symlinks()

        if not os.path.exists(self.base_dir):
            os.makedirs(self.base_dir, exist_ok=True)

        self._validate_symlinks()

        canonical_dir = os.path.abspath(os.path.normpath(self.base_dir))
        thread_lock = _get_dir_lock(canonical_dir)

        with thread_lock:
            with _interprocess_file_lock(self._lock_path):
                self._validate_symlinks()

                current_phase: typing.Optional[str] = None
                if os.path.isfile(self._file_path):
                    try:
                        with open(self._file_path, "rb") as reader:
                            content = reader.read()
                        current_phase = TEXT_TO_PHASE.get(content)
                    except OSError:
                        current_phase = None

                if current_phase is not None:
                    current_rank = PHASE_ORDER[current_phase]
                    requested_rank = PHASE_ORDER[phase]
                    if requested_rank <= current_rank:
                        return PHASES[current_phase]

                payload = PHASES[phase].encode("utf-8") + b"\n"
                temp_fd, temp_path = tempfile.mkstemp(
                    dir=self.base_dir,
                    prefix=".shift_log_",
                    suffix=".tmp",
                )
                try:
                    with os.fdopen(temp_fd, "wb") as temp_file:
                        temp_file.write(payload)
                        temp_file.flush()
                except BaseException:
                    try:
                        os.unlink(temp_path)
                    except OSError:
                        pass
                    raise

                replaced = False
                max_attempts = 50 if sys.platform == "win32" else 1
                try:
                    for attempt in range(max_attempts):
                        try:
                            os.replace(temp_path, self._file_path)
                            replaced = True
                            break
                        except PermissionError:
                            if attempt == max_attempts - 1:
                                raise
                            time.sleep(0.01)
                finally:
                    if not replaced:
                        try:
                            os.unlink(temp_path)
                        except OSError:
                            pass

                return PHASES[phase]
