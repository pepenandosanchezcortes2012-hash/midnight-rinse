"""Modulo para la gestion sincronizada del registro de turnos."""
from __future__ import annotations

import contextlib
import errno
import os
import sys
import tempfile
import threading
import time
from typing import Optional

try:
    import fcntl
except ImportError:
    fcntl = None

try:
    import msvcrt
except ImportError:
    msvcrt = None

_PHASE_START = "start"
_PHASE_CUSTOMER = "customer_talked"
_PHASE_COLLAPSE = "collapse"

_PHASE_ORDER = {
    _PHASE_START: 0,
    _PHASE_CUSTOMER: 1,
    _PHASE_COLLAPSE: 2,
}

_PHASE_TEXTS = {
    _PHASE_START: "Turno asignado sin incidencias. Recuerde fregar el pasillo central cada 45 minutos.",
    _PHASE_CUSTOMER: (
        "Turno asignado. NO lo mires directamente a la cara. Si te pregunta la hora, "
        "dile que faltan cinco minutos para las seis."
    ),
    _PHASE_COLLAPSE: "¿Por qué sigues limpiando si sabes que el agua nunca va a volver a ser clara?",
}

_PHASE_BYTES = {
    _PHASE_START: _PHASE_TEXTS[_PHASE_START].encode("utf-8") + b"\n",
    _PHASE_CUSTOMER: _PHASE_TEXTS[_PHASE_CUSTOMER].encode("utf-8") + b"\n",
    _PHASE_COLLAPSE: _PHASE_TEXTS[_PHASE_COLLAPSE].encode("utf-8") + b"\n",
}

_BYTES_TO_PHASE = {
    _PHASE_BYTES[_PHASE_START]: _PHASE_START,
    _PHASE_BYTES[_PHASE_CUSTOMER]: _PHASE_CUSTOMER,
    _PHASE_BYTES[_PHASE_COLLAPSE]: _PHASE_COLLAPSE,
}

_DIR_LOCKS: dict[str, threading.Lock] = {}
_META_LOCK = threading.Lock()


def _get_thread_lock(path: str) -> threading.Lock:
    """Obtiene o crea un candado de hilo por directorio."""
    with _META_LOCK:
        lock = _DIR_LOCKS.get(path)
        if lock is None:
            lock = threading.Lock()
            _DIR_LOCKS[path] = lock
        return lock


@contextlib.contextmanager
def _process_file_lock(lock_path: str):
    """Adquiere un candado a nivel de sistema operativo para coordinar procesos."""
    fd = os.open(lock_path, os.O_RDWR | os.O_CREAT, 0o666)
    locked = False
    try:
        if fcntl is not None:
            fcntl.flock(fd, fcntl.LOCK_EX)
            locked = True
        elif msvcrt is not None:
            try:
                if os.fstat(fd).st_size == 0:
                    os.write(fd, b"\x00")
            except OSError:
                _err = None
            start_time = time.monotonic()
            delay = 0.0002
            while True:
                try:
                    os.lseek(fd, 0, os.SEEK_SET)
                    msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
                    locked = True
                    break
                except OSError:
                    if time.monotonic() - start_time > 180.0:
                        raise TimeoutError("Tiempo de espera agotado al adquirir candado")
                    time.sleep(delay)
                    if delay < 0.002:
                        delay *= 1.5
        yield
    finally:
        if locked:
            try:
                if fcntl is not None:
                    fcntl.flock(fd, fcntl.LOCK_UN)
                elif msvcrt is not None:
                    os.lseek(fd, 0, os.SEEK_SET)
                    msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
            except OSError:
                _err = None
        try:
            os.close(fd)
        except OSError:
            _err = None


class ShiftLog:
    """Manejador del archivo de registro de turnos."""

    def __init__(self, base_dir: str = "./records") -> None:
        """Configura la ruta base del registro."""
        if not isinstance(base_dir, str) or isinstance(base_dir, bool):
            raise ValueError("base_dir debe ser una cadena de texto valida")
        self.base_dir: str = base_dir

    def update(self, phase: str) -> str:
        """Actualiza la fase respetando la progresion monotona y atomicidad."""
        if not isinstance(phase, str) or phase not in _PHASE_ORDER:
            raise ValueError(f"Fase invalida: {phase!r}")

        clean_base = self.base_dir
        while len(clean_base) > 1 and clean_base.endswith(("/", "\\")):
            if len(clean_base) == 3 and clean_base[1] == ":" and clean_base[0].isalpha():
                break
            clean_base = clean_base[:-1]
        if not clean_base:
            clean_base = "."

        if os.path.islink(clean_base):
            raise ValueError("base_dir es un enlace simbolico")

        file_path = os.path.join(clean_base, "shift_log.txt")
        if os.path.islink(file_path):
            raise ValueError("shift_log.txt es un enlace simbolico")

        lock_path = os.path.join(clean_base, ".shift_log.lock")
        if os.path.islink(lock_path):
            raise ValueError(".shift_log.lock es un enlace simbolico")

        os.makedirs(clean_base, exist_ok=True)
        if os.path.islink(clean_base):
            raise ValueError("base_dir es un enlace simbolico")

        norm_key = os.path.abspath(clean_base)
        thread_lock = _get_thread_lock(norm_key)

        with thread_lock:
            with _process_file_lock(lock_path):
                if os.path.islink(clean_base):
                    raise ValueError("base_dir es un enlace simbolico")
                if os.path.islink(file_path):
                    raise ValueError("shift_log.txt es un enlace simbolico")

                data: Optional[bytes] = None
                for _ in range(20):
                    try:
                        with open(file_path, "rb") as handle:
                            data = handle.read()
                        break
                    except FileNotFoundError:
                        data = None
                        break
                    except (PermissionError, OSError) as exc:
                        is_perm = isinstance(exc, PermissionError) or exc.errno in (errno.EACCES, errno.EPERM)
                        if is_perm:
                            time.sleep(0.002)
                            continue
                        raise

                current_phase = _BYTES_TO_PHASE.get(data)
                target_order = _PHASE_ORDER[phase]

                if current_phase is not None:
                    current_order = _PHASE_ORDER[current_phase]
                    if target_order <= current_order:
                        return _PHASE_TEXTS[current_phase]

                temp_fd, temp_path = tempfile.mkstemp(dir=clean_base, prefix=".tmp_shift_")
                try:
                    with os.fdopen(temp_fd, "wb") as handle:
                        handle.write(_PHASE_BYTES[phase])
                        handle.flush()

                    for attempt in range(50):
                        try:
                            os.replace(temp_path, file_path)
                            break
                        except (PermissionError, OSError) as exc:
                            is_perm = isinstance(exc, PermissionError) or exc.errno in (errno.EACCES, errno.EPERM)
                            if not is_perm or attempt == 49:
                                raise
                            time.sleep(0.01)

                    return _PHASE_TEXTS[phase]
                except Exception:
                    if os.path.exists(temp_path):
                        try:
                            os.unlink(temp_path)
                        except OSError:
                            _err = None
                    raise
