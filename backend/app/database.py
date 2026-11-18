"""
Conexión a la base de datos.

Usamos SQLite: una base de datos que vive en UN solo archivo (data/mi_nube.db).
No hay que instalar ningún servidor de base de datos. Más adelante, si quieres,
se puede cambiar a PostgreSQL modificando solo la URL de conexión.
"""
import os
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine

# Carpeta donde se guardan los datos: backend/data/
# (se puede cambiar con la variable de entorno MI_NUBE_DATOS, por ejemplo para pruebas)
CARPETA_DATOS = Path(os.getenv("MI_NUBE_DATOS") or Path(__file__).resolve().parent.parent / "data")
CARPETA_DATOS.mkdir(parents=True, exist_ok=True)

URL_BD = f"sqlite:///{CARPETA_DATOS / 'mi_nube.db'}"

# El "engine" es el objeto que sabe hablar con la base de datos.
# check_same_thread=False es necesario en SQLite porque FastAPI atiende
# peticiones en varios hilos.
engine = create_engine(URL_BD, connect_args={"check_same_thread": False})


def crear_tablas() -> None:
    """Crea las tablas que aún no existen (según los modelos con table=True)."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """
    Entrega una sesión (una "conversación" con la BD) a cada petición.
    FastAPI la inyecta automáticamente con Depends(get_session) y la cierra
    al terminar la petición gracias al "with".
    """
    with Session(engine) as session:
        yield session
