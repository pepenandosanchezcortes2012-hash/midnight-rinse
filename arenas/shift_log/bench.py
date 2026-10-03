"""Benchmark de la Arena 7: 1 500 actualizaciones reales (500 ciclos de 3 fases) en un directorio temporal.

Imprime APEX_METRIC=segundos. No deja archivos en el directorio actual.
"""
import os
import tempfile
import time

from shift_log import ShiftLog

FASES = ("start", "customer_talked", "collapse")


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        log = ShiftLog(os.path.join(tmp, "records"))
        archivo = os.path.join(tmp, "records", "shift_log.txt")
        start = time.perf_counter()
        for ciclo in range(500):
            for fase in FASES:
                log.update(fase)
            log.update("start")
            with open(archivo, "wb") as handle:
                handle.write(b"reinicio\n")
        elapsed = time.perf_counter() - start
    print(f"APEX_METRIC={elapsed:.6f}")


if __name__ == "__main__":
    main()
