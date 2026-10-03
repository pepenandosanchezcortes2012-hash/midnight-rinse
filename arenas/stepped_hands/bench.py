"""Benchmark de la Arena 4: 1 200 000 muestras (t = i / 60) en tres retenedores. Imprime APEX_METRIC=segundos."""
import time

from stepped_hands import SteppedHold


def main() -> None:
    holds = [SteppedHold(15), SteppedHold(12), SteppedHold(30)]
    poses = [{"frame": i} for i in range(64)]
    start = time.perf_counter()
    for h in holds:
        for i in range(400000):
            h.sample(i / 60, poses[i & 63])
    elapsed = time.perf_counter() - start
    print(f"APEX_METRIC={elapsed:.6f}")


if __name__ == "__main__":
    main()
