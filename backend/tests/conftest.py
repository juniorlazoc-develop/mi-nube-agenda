"""
Preparación compartida por todas las pruebas (pytest lee este archivo solo).

Usan una base de datos EN MEMORIA, así nunca tocan tus datos reales.
  - "anonimo": un cliente SIN token (para probar el login).
  - "client":  un cliente que ya creó la cuenta y envía su token en cada petición.
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.database import get_session
from app.limitador import limitador
from app.main import app
from app.routers import fotos

engine_prueba = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)

CUENTA = {"usuario": "demo", "nombre": "Demo", "contrasena": "clave-segura-123"}


@pytest.fixture(name="anonimo")
def anonimo_fixture(tmp_path, monkeypatch):
    monkeypatch.setattr(fotos, "CARPETA_FOTOS", tmp_path / "fotos")  # nunca tocan tus fotos reales
    SQLModel.metadata.create_all(engine_prueba)

    def sesion_de_prueba():
        with Session(engine_prueba) as session:
            yield session

    # Reemplazamos la BD real por la de prueba.
    app.dependency_overrides[get_session] = sesion_de_prueba
    limitador.fallos.clear()  # cada prueba empieza sin intentos fallidos
    yield TestClient(app)
    app.dependency_overrides.clear()
    SQLModel.metadata.drop_all(engine_prueba)


@pytest.fixture(name="client")
def client_fixture(anonimo):
    token = anonimo.post("/api/auth/registro", json=CUENTA).json()["access_token"]
    anonimo.headers["Authorization"] = f"Bearer {token}"
    return anonimo
