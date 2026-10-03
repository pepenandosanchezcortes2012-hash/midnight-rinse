"""Bitácora del turno: el archivo shift_log.txt avanza de fase y nunca retrocede.

Solución de referencia de la Arena 7 (no se muestra a los gladiadores). Escritura atómica (archivo temporal en la
misma carpeta + os.replace), candado de archivo entre procesos (fcntl.flock o msvcrt.locking) y candado de hilos
dentro del proceso.
"""
from __future__ import annotations

import os
import tempfile
import threading
import time
from typing import Dict, Optional

try:
    import fcntl
except ImportError:  # Windows
    fcntl = None  # type: ignore[assignment]
try:
    import msvcrt
except ImportError:  # Unix
    msvcrt = None  # type: ignore[assignment]

PHASES = ("start", "customer_talked", "collapse")
TEXTS: Dict[str, str] = {
    "start": "Turno asignado sin incidencias. Recuerde fregar el pasillo central cada 45 minutos.",
    "customer_talked": ("Turno asignado. NO lo mires directamente a la cara. Si te pregunta la hora, "
                        "dile que faltan cinco minutos para las seis."),
    "collapse": "¿Por qué sigues limpiando si sabes que el agua nunca va a volver a ser clara?",
}
_BYTES_TO_PHASE = {text.encode("utf-8") + b"\n": phase for phase, text in TEXTS.items()}
_FILE_NAME = "shift_log.txt"
_LOCK_NAME = ".shift_log.lock"

_registry_guard = threading.Lock()
_thread_locks: Dict[str, threading.Lock] = {}


def _thread_lock_for(path: str) -> threading.Lock:
    """Un candado de hilos por carpeta, compartido por todas las instancias del proceso."""
    key = os.path.normcase(os.path.abspath(path))
    with _registry_guard:
        lock = _thread_locks.get(key)
        if lock is None:
            lock = threading.Lock()
            _thread_locks[key] = lock
        return lock


class _FileLock:
    """Candado exclusivo sobre base_dir/.shift_log.lock (se deja en disco)."""

    def __init__(self, path: str) -> None:
        self._path = path
        self._fd: Optional[int] = None

    def __enter__(self) -> "_FileLock":
        self._fd = os.open(self._path, os.O_RDWR | os.O_CREAT, 0o644)
        if fcntl is not None:
            fcntl.flock(self._fd, fcntl.LOCK_EX)
        elif msvcrt is not None:
            while True:
                try:
                    os.lseek(self._fd, 0, os.SEEK_SET)
                    msvcrt.locking(self._fd, msvcrt.LK_NBLCK, 1)
                    break
                except OSError:
                    time.sleep(0.001)
        return self

    def __exit__(self, *exc: object) -> None:
        fd, self._fd = self._fd, None
        if fd is None:
            return
        try:
            if fcntl is not None:
                fcntl.flock(fd, fcntl.LOCK_UN)
            elif msvcrt is not None:
                os.lseek(fd, 0, os.SEEK_SET)
                msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
        finally:
            os.close(fd)


def _replace_with_retries(src: str, dst: str) -> None:
    """os.replace; en Windows se reintenta hasta 50 veces cada 10 ms si un lector tiene el archivo abierto."""
    attempts = 50 if os.name == "nt" else 1
    for attempt in range(attempts):
        try:
            os.replace(src, dst)
            return
        except PermissionError:
            if attempt == attempts - 1:
                raise
            time.sleep(0.01)


class ShiftLog:
    """Registro de fase del turno en base_dir/shift_log.txt, seguro entre hilos y procesos."""

    def __init__(self, base_dir: str = "./records") -> None:
        self._base_dir = base_dir

    def _paths(self) -> tuple:
        stripped = self._base_dir.rstrip("/\\") or self._base_dir
        if os.path.islink(stripped):
            raise ValueError("base_dir no puede ser un enlace simbólico")
        return stripped, os.path.join(stripped, _FILE_NAME)

    @staticmethod
    def _current(file_path: str) -> Optional[str]:
        try:
            with open(file_path, "rb") as handle:
                data = handle.read()
        except FileNotFoundError:
            return None
        return _BYTES_TO_PHASE.get(data)

    def update(self, phase: str) -> str:
        """Avanza a `phase` si es posterior a la actual y devuelve el texto de la fase vigente (sin salto de línea)."""
        if not isinstance(phase, str) or phase not in TEXTS:
            raise ValueError(f"fase no válida: {phase!r}")
        base, file_path = self._paths()
        os.makedirs(base, exist_ok=True)
        with _thread_lock_for(base), _FileLock(os.path.join(base, _LOCK_NAME)):
            base, file_path = self._paths()
            if os.path.islink(file_path):
                raise ValueError("shift_log.txt no puede ser un enlace simbólico")
            current = self._current(file_path)
            if current is not None and PHASES.index(phase) <= PHASES.index(current):
                return TEXTS[current]
            fd, tmp_path = tempfile.mkstemp(prefix=".shift_log.", suffix=".tmp", dir=base)
            try:
                with os.fdopen(fd, "wb") as handle:
                    handle.write(TEXTS[phase].encode("utf-8") + b"\n")
                    handle.flush()
                    os.fsync(handle.fileno())
                _replace_with_retries(tmp_path, file_path)
            except BaseException:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                raise
            return TEXTS[phase]
