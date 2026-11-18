"""
Copia de seguridad de la base de datos (Etapa 6).

    python -m app.respaldo

Crea data/respaldos/mi_nube-AAAA-MM-DD.db y conserva solo las 14 más recientes.
Se puede ejecutar con la agenda encendida: usamos la función "backup" de SQLite,
que copia bien aunque alguien esté escribiendo. Copiar el archivo a mano no sería seguro.
"""
import sqlite3
from contextlib import closing
from datetime import date
from pathlib import Path

from app.database import CARPETA_DATOS

CONSERVAR = 14


def hacer_respaldo(origen: Path, carpeta: Path, conservar: int = CONSERVAR) -> Path:
    carpeta.mkdir(parents=True, exist_ok=True)
    destino = carpeta / f"mi_nube-{date.today().isoformat()}.db"
    with closing(sqlite3.connect(origen)) as fuente, closing(sqlite3.connect(destino)) as copia:
        fuente.backup(copia)
    # La fecha va en el nombre, así que ordenar por nombre es ordenar por antigüedad.
    for viejo in sorted(carpeta.glob("mi_nube-*.db"))[:-conservar]:
        viejo.unlink()
    return destino


if __name__ == "__main__":
    print(f"✅ Respaldo creado: {hacer_respaldo(CARPETA_DATOS / 'mi_nube.db', CARPETA_DATOS / 'respaldos')}")
