"""Módulo de registro de turnos de la Arena 7 (shift_log)."""

from __future__ import annotations

import contextlib
import errno
import os
import sys
import tempfile
import threading
import time
from typing import Dict, Iterator, Optional, Tuple

try:
    import fcntl
except ImportError:
    fcntl = None  # type: ignore

try:
    import msvcrt
except ImportError:
    msvcrt = None  # type: ignore

PHASES: Tuple[str, ...] = ("start", "customer_talked", "collapse")

PHASE_ORDER: Dict[str, int] = {
    "start": 0,
    "customer_talked": 1,
    "collapse": 2,
}

PHASE_TEXTS: Dict[str, str] = {
    "start": "Turno asignado sin incidencias. Recuerde fregar el pasillo central cada 45 minutos.",
    "customer_talked": "Turno asignado. NO lo mires directamente a la cara. Si te pregunta la hora, dile que faltan cinco minutos para las seis.",
    "collapse": "¿Por qué sigues limpiando si sabes que el agua nunca va a volver a ser clara?",
}

_PROCESS_LOCK = threading.RLock()


@contextlib.contextmanager
def _acquire_file_lock(lock_path: str) -> Iterator[None]:
    """Adquiere el candado de archivo para sincronización entre procesos."""
    start_open = time.monotonic()
    fd = -1
    while True:
        try:
            fd = os.open(lock_path, os.O_RDWR | os.O_CREAT, 0o666)
            break
        except OSError:
            if time.monotonic() - start_open > 10.0:
                raise
            time.sleep(0.001)

    locked = False
    try:
        if msvcrt is not None:
            try:
                if os.fstat(fd).st_size == 0:
                    os.write(fd, b"\x00")
            except OSError:
                pass
            start_lock = time.monotonic()
            while True:
                try:
                    os.lseek(fd, 0, os.SEEK_SET)
                    msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
                    locked = True
                    break
                except OSError:
                    if time.monotonic() - start_lock > 120.0:
                        raise
                    time.sleep(0.0005)
        elif fcntl is not None:
            fcntl.flock(fd, fcntl.LOCK_EX)
            locked = True
        yield
    finally:
        if locked:
            try:
                if msvcrt is not None:
                    os.lseek(fd, 0, os.SEEK_SET)
                    msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
                elif fcntl is not None:
                    fcntl.flock(fd, fcntl.LOCK_UN)
            except OSError:
                pass
        if fd >= 0:
            try:
                os.close(fd)
            except OSError:
                pass


def _verify_not_symlink(path: str, label: str) -> None:
    """Verifica que la ruta indicada no sea un enlace simbólico."""
    clean = path.rstrip("/\\")
    if not clean:
        clean = path
    if os.path.islink(clean) or os.path.islink(path):
        raise ValueError(f"{label} no puede ser un enlace simbolico")


class ShiftLog:
    """Gestor del registro de turnos con sincronización concurrente y escrituras atómicas."""

    def __init__(self, base_dir: str = "./records") -> None:
        """Inicializa la instancia con el directorio base."""
        if not isinstance(base_dir, str) or isinstance(base_dir, bool):
            raise ValueError("base_dir debe ser una cadena de texto valida")
        self.base_dir: str = base_dir
        self._base_dir: str = base_dir

    def update(self, phase: str) -> str:
        """Avanza la fase del turno si es posterior a la actual y persiste atómicamente."""
        if not isinstance(phase, str) or isinstance(phase, bool):
            raise ValueError("phase debe ser una cadena de texto")
        if phase not in PHASE_ORDER:
            raise ValueError(f"Fase no reconocida: {phase!r}")

        _verify_not_symlink(self._base_dir, "base_dir")
        target_file = os.path.join(self._base_dir, "shift_log.txt")
        _verify_not_symlink(target_file, "shift_log.txt")

        if self._base_dir and not os.path.exists(self._base_dir):
            os.makedirs(self._base_dir, exist_ok=True)

        _verify_not_symlink(self._base_dir, "base_dir")
        _verify_not_symlink(target_file, "shift_log.txt")

        lock_file = os.path.join(self._base_dir, ".shift_log.lock")
        _verify_not_symlink(lock_file, ".shift_log.lock")

        with _PROCESS_LOCK:
            with _acquire_file_lock(lock_file):
                _verify_not_symlink(self._base_dir, "base_dir")
                _verify_not_symlink(target_file, "shift_log.txt")

                current_phase: Optional[str] = None
                if os.path.exists(target_file):
                    try:
                        with open(target_file, "rb") as handle:
                            content = handle.read()
                        for p, text in PHASE_TEXTS.items():
                            if content == text.encode("utf-8") + b"\n":
                                current_phase = p
                                break
                    except OSError:
                        current_phase = None

                req_order = PHASE_ORDER[phase]
                if current_phase is not None:
                    curr_order = PHASE_ORDER[current_phase]
                    if req_order <= curr_order:
                        return PHASE_TEXTS[current_phase]

                target_text = PHASE_TEXTS[phase]
                payload = target_text.encode("utf-8") + b"\n"
                directory = self._base_dir if self._base_dir else "."

                temp_path: Optional[str] = None
                try:
                    with tempfile.NamedTemporaryFile(
                        mode="wb",
                        dir=directory,
                        prefix=".tmp_shift_log_",
                        delete=False,
                    ) as tf:
                        temp_path = tf.name
                        tf.write(payload)
                        tf.flush()

                    _verify_not_symlink(target_file, "shift_log.txt")

                    for attempt in range(50):
                        try:
                            os.replace(temp_path, target_file)
                            temp_path = None
                            break
                        except PermissionError:
                            if attempt == 49:
                                raise
                            time.sleep(0.01)
                finally:
                    if temp_path is not None and os.path.exists(temp_path):
                        try:
                            os.remove(temp_path)
                        except OSError:
                            pass

                return target_text
