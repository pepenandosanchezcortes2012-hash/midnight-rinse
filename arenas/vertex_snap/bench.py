"""Benchmark de la Arena 3: 400 000 vértices ajustados a 320x240. Imprime APEX_METRIC=segundos."""
import random
import time

from vertex_snap import snap


def main() -> None:
    rng = random.Random(3)
    vertices = []
    for _ in range(4096):
        w = rng.uniform(0.1, 50.0)
        vertices.append((rng.uniform(-1.2, 1.2) * w, rng.uniform(-1.2, 1.2) * w, rng.uniform(0.0, 1.0), w))
    start = time.perf_counter()
    for i in range(400000):
        snap(vertices[i & 4095])
    elapsed = time.perf_counter() - start
    print(f"APEX_METRIC={elapsed:.6f}")


if __name__ == "__main__":
    main()
