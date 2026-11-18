"""
Herramientas del sistema.

    GET /api/sistema/respaldo -> descarga una copia de la base de datos

La copia incluye pendientes, bitácora, gastos, recordatorios y la lista de fotos.
Las imágenes no van dentro: esas viven como archivos en data/fotos.
"""
import shutil
from datetime import date
from pathlib import Path
from tempfile import mkdtemp

from fastapi import APIRouter
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.database import CARPETA_DATOS
from app.respaldo import hacer_respaldo

router = APIRouter(prefix="/api/sistema", tags=["Sistema"])


@router.get("/respaldo")
def descargar_respaldo():
    carpeta = Path(mkdtemp(prefix="mi-nube-"))
    copia = hacer_respaldo(CARPETA_DATOS / "mi_nube.db", carpeta)
    return FileResponse(
        copia,
        media_type="application/vnd.sqlite3",
        filename=f"mi-nube-{date.today().isoformat()}.db",
        # Cuando termina la descarga, se borra la copia temporal.
        background=BackgroundTask(shutil.rmtree, carpeta, ignore_errors=True),
    )
