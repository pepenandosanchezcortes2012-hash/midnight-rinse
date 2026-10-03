"""Benchmark de la Arena 1: programar y disparar 200 000 eventos con prioridades mezcladas. Imprime APEX_METRIC=segundos."""
import random
import time

from blind_spot_dispatcher import Dispatcher


def main() -> None:
    rng = random.Random(7)
    prioridades = [rng.randrange(-100, 100) for _ in range(200000)]
    d = Dispatcher()
    start = time.perf_counter()
    for ronda in range(4):
        base = ronda * 50000
        for i in range(50000):
            d.schedule(f"e{base + i}", {"i": i}, priority=prioridades[base + i])
            if i % 1000 == 0:
                d.tick(0.75)
        d.tick(0.0)
    elapsed = time.perf_counter() - start
    print(f"APEX_METRIC={elapsed:.6f}")


if __name__ == "__main__":
    main()
