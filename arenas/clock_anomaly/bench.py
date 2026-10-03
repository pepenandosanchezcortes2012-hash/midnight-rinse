"""Benchmark de la Arena 6: 4 000 000 de consultas (multiplicador y susurros) a lo largo del día. Imprime APEX_METRIC=segundos."""
import datetime as dt
import time

from clock_anomaly import anomaly_multiplier, whispers_active


def main() -> None:
    zona = dt.timezone(dt.timedelta(hours=-6))
    momentos = [dt.datetime(2026, 10, 2, (i // 60) % 24, i % 60, i % 60, (i * 7919) % 1000000, tzinfo=zona if i % 3 == 0 else None)
                for i in range(1440)]
    start = time.perf_counter()
    for k in range(2000000):
        m = momentos[k % 1440]
        anomaly_multiplier(m)
        whispers_active(m)
    elapsed = time.perf_counter() - start
    print(f"APEX_METRIC={elapsed:.6f}")


if __name__ == "__main__":
    main()
