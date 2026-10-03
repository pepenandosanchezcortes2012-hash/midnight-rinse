"""Prueba oculta común: sintaxis de Python 3.9, `from __future__ import annotations` e imports permitidos."""
import ast
import os
import tempfile
import unittest

import midnight_rinse_core.vertex_snap as modulo

FUENTE = os.path.abspath(modulo.__file__)
PERMITIDOS = ['__future__', 'typing', 'math', 'os', 'sys', 'threading', 'tempfile', 'errno', 'datetime', 'time', 'heapq', 'collections', 'itertools', 'functools', 'enum', 'dataclasses', 'numbers', 'pathlib', 'io', 'contextlib', 'stat', 'copy', 'bisect', 'abc', 'weakref', 'operator', 'random', 'fcntl', 'msvcrt']


class TestRestriccionesDeEntrega(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        with open(FUENTE, encoding="utf-8") as handle:
            self.codigo = handle.read()

    def test_sintaxis_python_3_9(self) -> None:
        ast.parse(self.codigo, feature_version=(3, 9))

    def test_from_future_annotations(self) -> None:
        self.assertIn("from __future__ import annotations", self.codigo)

    def test_imports_permitidos(self) -> None:
        arbol = ast.parse(self.codigo)
        for nodo in ast.walk(arbol):
            if isinstance(nodo, ast.Import):
                for alias in nodo.names:
                    self.assertIn(alias.name.split(".")[0], PERMITIDOS, f"import no permitido: {alias.name}")
            elif isinstance(nodo, ast.ImportFrom):
                self.assertEqual(nodo.level, 0, "imports relativos no permitidos")
                self.assertIn((nodo.module or "").split(".")[0], PERMITIDOS, f"import no permitido: {nodo.module}")


if __name__ == "__main__":
    unittest.main()
