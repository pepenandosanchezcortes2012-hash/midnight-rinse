"""Bitácora del turno: base_dir/shift_log.txt avanza de fase y nunca retrocede.

Origen: campeón de Gemini G007 (Arena 7, lote 7), refactorizado. Se conserva su sincronización
(candado de hilos por carpeta + candado de archivo entre procesos con espera progresiva), la escritura atómica
con reintentos y la comprobación de enlaces simbólicos. Correcciones:
- Si la lectura del estado falla de forma persistente (PermissionError en Windows), ahora se propaga el error.
  Antes se trataba como "contenido ajeno" y podía sobrescribir una fase más avanzada, rompiendo la regla de
  no retroceder.
- Se sustituyen los `except: _err = None` por `contextlib.suppress`, y se agrega fsync antes del renombrado.
"""
from __future__ import annotations

import contextlib
import errno
import os
import tempfile
import threading
import time
from typing import Dict, Iterator, Optional

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
_ORDER = {phase: index for index, phase in enumerate(PHASES)}
_BYTES_TO_PHASE = {text.encode("utf-8") + b"\n": phase for phase, text in TEXTS.items()}
_FILE_NAME = "shift_log.txt"
_LOCK_NAME = ".shift_log.lock"
_LOCK_TIMEOUT_S = 120.0

_registry_guard = threading.Lock()
_dir_locks: Dict[str, threading.Lock] = {}


def _dir_lock(path: str) -> threading.Lock:
    """Un candado de hilos por carpeta canónica, compartido por todas las instancias del proceso."""
    key = os.path.normcase(os.path.abspath(path))
    with _registry_guard:
        return _dir_locks.setdefault(key, threading.Lock())


def _is_permission_error(exc: OSError) -> bool:
    return isinstance(exc, PermissionError) or exc.errno in (errno.EACCES, errno.EPERM)


@contextlib.contextmanager
def _process_lock(lock_path: str) -> Iterator[None]:
    """Candado exclusivo entre procesos: fcntl.flock en Unix, msvcrt.locking no bloqueante con espera en Windows."""
    fd = os.open(lock_path, os.O_RDWR | os.O_CREAT, 0o666)
    locked = False
    try:
        if fcntl is not None:
            fcntl.flock(fd, fcntl.LOCK_EX)
            locked = True
        elif msvcrt is not None:
            started = time.monotonic()
            delay = 0.0002
            while True:
                try:
                    os.lseek(fd, 0, os.SEEK_SET)
                    msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
                    locked = True
                    break
                except OSError:
                    if time.monotonic() - started > _LOCK_TIMEOUT_S:
                        raise TimeoutError("tiempo agotado al adquirir el candado de shift_log")
                    time.sleep(delay)
                    delay = min(0.002, delay * 1.5)
        yield
    finally:
        if locked:
            with contextlib.suppress(OSError):
                if fcntl is not None:
                    fcntl.flock(fd, fcntl.LOCK_UN)
                elif msvcrt is not None:
                    os.lseek(fd, 0, os.SEEK_SET)
                    msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
        with contextlib.suppress(OSError):
            os.close(fd)


def _strip_separators(path: str) -> str:
    """Quita separadores finales sin convertir una raíz ("/" o "C:\\") en otra ruta."""
    clean = path
    while len(clean) > 1 and clean.endswith(("/", "\\")):
        if len(clean) == 3 and clean[1] == ":" and clean[0].isalpha():
            break
        clean = clean[:-1]
    return clean or "."


def _read_with_retries(file_path: str) -> Optional[bytes]:
    """Contenido del archivo, None si no existe. Reintenta PermissionError (lectores en Windows) y luego lo propaga."""
    for attempt in range(50):
        try:
            with open(file_path, "rb") as handle:
                return handle.read()
        except FileNotFoundError:
            return None
        except OSError as exc:
            if not _is_permission_error(exc) or attempt == 49:
                raise
            time.sleep(0.002)
    return None


def _replace_with_retries(src: str, dst: str) -> None:
    """os.replace; en Windows se reintenta hasta 50 veces cada 10 ms si un lector tiene el archivo abierto."""
    attempts = 50 if os.name == "nt" else 1
    for attempt in range(attempts):
        try:
            os.replace(src, dst)
            return
        except OSError as exc:
            if not _is_permission_error(exc) or attempt == attempts - 1:
                raise
            time.sleep(0.01)


class ShiftLog:
    """Registro de fase del turno, atómico, monótono y seguro entre hilos y procesos."""

    def __init__(self, base_dir: str = "./records") -> None:
        if isinstance(base_dir, bool) or not isinstance(base_dir, str):
            raise ValueError("base_dir debe ser un str")
        self.base_dir = base_dir

    def update(self, phase: str) -> str:
        """Avanza a `phase` si es posterior a la actual y devuelve el texto de la fase vigente (sin salto de línea)."""
        if not isinstance(phase, str) or phase not in TEXTS:
            raise ValueError(f"fase no válida: {phase!r}")
        base = _strip_separators(self.base_dir)
        file_path = os.path.join(base, _FILE_NAME)
        lock_path = os.path.join(base, _LOCK_NAME)
        self._reject_symlinks(base, file_path, lock_path)
        os.makedirs(base, exist_ok=True)
        with _dir_lock(base), _process_lock(lock_path):
            self._reject_symlinks(base, file_path, lock_path)
            current = _BYTES_TO_PHASE.get(_read_with_retries(file_path))
            if current is not None and _ORDER[phase] <= _ORDER[current]:
                return TEXTS[current]
            fd, tmp_path = tempfile.mkstemp(dir=base, prefix=".shift_log.", suffix=".tmp")
            try:
                with os.fdopen(fd, "wb") as handle:
                    handle.write(TEXTS[phase].encode("utf-8") + b"\n")
                    handle.flush()
                    os.fsync(handle.fileno())
                _replace_with_retries(tmp_path, file_path)
            except BaseException:
                with contextlib.suppress(OSError):
                    os.unlink(tmp_path)
                raise
            return TEXTS[phase]

    @staticmethod
    def _reject_symlinks(base: str, file_path: str, lock_path: str) -> None:
        if os.path.islink(base):
            raise ValueError("base_dir no puede ser un enlace simbólico")
        if os.path.islink(file_path):
            raise ValueError("shift_log.txt no puede ser un enlace simbólico")
        if os.path.islink(lock_path):
            raise ValueError(".shift_log.lock no puede ser un enlace simbólico")
