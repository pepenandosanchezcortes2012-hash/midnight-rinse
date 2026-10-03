"""Benchmark de la Arena 5: 150 000 drags mezclados (vibraciones, arrastres y vueltas). Imprime APEX_METRIC=segundos."""
import random
import time

from detent_dial import DetentDial


def main() -> None:
    rng = random.Random(11)
    pasos = []
    for _ in range(150000):
        r = rng.random()
        if r < 0.6:
            pasos.append(rng.choice([-1, 1]) * rng.randrange(1, 9) / 8)
        elif r < 0.95:
            pasos.append(rng.choice([-1, 1]) * rng.randrange(8, 400) / 4)
        else:
            pasos.append(rng.choice([-1, 1]) * rng.randrange(720, 2880))
    dial = DetentDial(15.0, 0.5, 3.0)
    fino = DetentDial(2.5, 0.25, 1.0)
    start = time.perf_counter()
    for paso in pasos:
        dial.drag(paso)
        fino.drag(paso)
    elapsed = time.perf_counter() - start
    print(f"APEX_METRIC={elapsed:.6f}")


if __name__ == "__main__":
    main()
