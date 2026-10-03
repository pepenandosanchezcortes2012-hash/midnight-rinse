"""Benchmark de la Arena 2: cuantiza 4 cuadros de 320x240 (307 200 píxeles). Imprime APEX_METRIC=segundos."""
import time

from bayer_rgb555 import quantize


def main() -> None:
    colores = [((i % 97) / 96, (i % 61) / 60, (i % 37) / 36) for i in range(4096)]
    start = time.perf_counter()
    k = 0
    for _ in range(4):
        for y in range(240):
            for x in range(320):
                quantize(colores[k & 4095], x, y)
                k += 1
    elapsed = time.perf_counter() - start
    print(f"APEX_METRIC={elapsed:.6f}")


if __name__ == "__main__":
    main()
