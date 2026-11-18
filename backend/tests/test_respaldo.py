"""Pruebas de las copias de seguridad (Etapa 6). Usan una base de datos temporal."""
import sqlite3
from contextlib import closing

from app.respaldo import hacer_respaldo


def test_respaldo_copia_los_datos_y_borra_los_viejos(tmp_path):
    origen = tmp_path / "mi_nube.db"
    with closing(sqlite3.connect(origen)) as bd:
        bd.execute("CREATE TABLE nota (texto TEXT)")
        bd.execute("INSERT INTO nota VALUES ('hola')")
        bd.commit()

    carpeta = tmp_path / "respaldos"
    carpeta.mkdir()
    (carpeta / "mi_nube-2020-01-01.db").touch()  # uno viejo que debe desaparecer

    copia = hacer_respaldo(origen, carpeta, conservar=1)

    assert list(carpeta.iterdir()) == [copia]
    with closing(sqlite3.connect(copia)) as leido:
        assert leido.execute("SELECT texto FROM nota").fetchall() == [("hola",)]
