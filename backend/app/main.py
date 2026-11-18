"""
Punto de entrada del backend "Mi Nube".

Arrancar en modo desarrollo (se recarga solo al guardar cambios):
    fastapi dev app/main.py

Luego abre:
    http://127.0.0.1:8000/docs   -> documentación interactiva para probar la API
"""
import os
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import crear_tablas
from app.routers import auth, bitacora, fotos, gastos, inicio, recordatorios, sistema, tareas
from app.seguridad import PRODUCCION, usuario_actual


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Esto se ejecuta UNA vez al arrancar el servidor.
    crear_tablas()
    yield
    # (Aquí iría código para ejecutar al apagar el servidor.)


app = FastAPI(
    title="Mi Nube",
    description="Mi sistema personal: pendientes, bitácora, gastos, recordatorios y fotos.",
    version="0.6.0",
    lifespan=lifespan,
    # En internet no mostramos la documentación: es un mapa de la API para un intruso.
    docs_url=None if PRODUCCION else "/docs",
    redoc_url=None if PRODUCCION else "/redoc",
    openapi_url=None if PRODUCCION else "/openapi.json",
)

# CORS: permite que el frontend de React (Etapa 2, en el puerto 5173)
# pueda llamar a esta API, que corre en otro puerto (8000).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/salud", tags=["Sistema"])
def salud():
    """Para comprobar rápidamente que el servidor está vivo."""
    return {"estado": "ok", "hora_servidor": datetime.now()}


# Aquí "enchufamos" cada grupo de rutas.
# El login queda abierto; todo lo demás exige un token válido (usuario_actual).
# Si no lo traes, FastAPI responde 401 antes de tocar la base de datos.
protegido = [Depends(usuario_actual)]

app.include_router(auth.router)
app.include_router(tareas.router, dependencies=protegido)
app.include_router(bitacora.router, dependencies=protegido)
app.include_router(gastos.router, dependencies=protegido)
app.include_router(inicio.router, dependencies=protegido)
app.include_router(recordatorios.router, dependencies=protegido)
app.include_router(fotos.router, dependencies=protegido)
app.include_router(sistema.router, dependencies=protegido)

# En producción no existe Vite: FastAPI entrega también la página de React ya compilada
# (la carpeta dist). Va AL FINAL porque "/" atrapa todo lo que no sea una ruta de arriba.
# Así frontend y backend viven en la misma dirección y no hace falta CORS.
if carpeta_web := os.getenv("MI_NUBE_WEB"):
    app.mount("/", StaticFiles(directory=carpeta_web, html=True), name="web")
