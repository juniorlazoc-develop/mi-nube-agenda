"""Pruebas del panel de inicio, los extras de gastos y la cuenta."""
from datetime import date, timedelta

import jwt

from app import seguridad
from app.routers.inicio import calcular_racha
from tests.conftest import CUENTA

HOY = date(2026, 11, 3)


def test_racha():
    assert calcular_racha(set(), HOY) == 0
    assert calcular_racha({HOY}, HOY) == 1
    dias = {HOY - timedelta(days=n) for n in (1, 2, 3)}  # hoy aún no escribes: no se rompe
    assert calcular_racha(dias, HOY) == 3
    assert calcular_racha({HOY, HOY - timedelta(days=2)}, HOY) == 1  # un hueco la corta


def test_inicio_vacio(client):
    datos = client.get("/api/inicio").json()
    assert datos["tareas"]["total"] == 0
    assert datos["gastos"] == {"total": 0, "presupuesto": 0}
    assert datos["fotos"]["total"] == 0


def test_inicio_con_datos(client):
    hoy = date.today().isoformat()
    ayer = (date.today() - timedelta(days=1)).isoformat()
    client.post("/api/tareas", json={"titulo": "Hoy", "fecha": hoy})
    client.post("/api/tareas", json={"titulo": "Ayer", "fecha": ayer})
    client.post("/api/gastos", json={"descripcion": "Menú", "monto": 12.5, "fecha": hoy})
    client.post("/api/bitacora", json={"texto": "Buen día", "animo": "😀", "fecha": hoy})
    client.post("/api/recordatorios", json={"titulo": "Luz", "fecha": hoy, "hora": "09:00"})

    datos = client.get("/api/inicio").json()
    assert (datos["tareas"]["total"], datos["tareas"]["atrasadas"]) == (1, 1)
    assert datos["gastos"]["total"] == 12.5
    assert datos["bitacora"]["racha"] == 1 and datos["bitacora"]["escrito_hoy"] is True
    assert datos["bitacora"]["animos"] == {hoy: "😀"}
    assert datos["recordatorios"][0]["titulo"] == "Luz"


def test_presupuesto_y_mes_anterior(client):
    client.put("/api/gastos/presupuesto", json={"monto": 800})
    client.post("/api/gastos", json={"descripcion": "A", "monto": 100, "fecha": "2026-10-15"})
    client.post("/api/gastos", json={"descripcion": "B", "monto": 50, "fecha": "2026-11-15"})
    r = client.get("/api/gastos/resumen", params={"mes": "2026-11"}).json()
    assert (r["total"], r["mes_anterior"], r["presupuesto"]) == (50, 100, 800)


def test_presupuesto_invalido(client):
    assert client.put("/api/gastos/presupuesto", json={"monto": -5}).status_code == 422


def test_tendencia_incluye_cada_mes(client):
    mes = date.today().strftime("%Y-%m")
    client.post("/api/gastos", json={"descripcion": "A", "monto": 30, "fecha": date.today().isoformat()})
    datos = client.get("/api/gastos/tendencia", params={"meses": 3}).json()
    assert len(datos) == 3 and datos[-1] == {"mes": mes, "total": 30}


def test_csv_protege_de_formulas(client):
    client.post("/api/gastos", json={"descripcion": "=HYPERLINK(1)", "monto": 12.5, "fecha": "2026-11-15"})
    r = client.get("/api/gastos/csv", params={"mes": "2026-11"})
    assert "attachment" in r.headers["content-disposition"]
    assert "'=HYPERLINK(1)" in r.text and "12,50" in r.text


def test_cambiar_nombre(client):
    assert client.patch("/api/auth/yo", json={"nombre": " Nuevo "}).json()["nombre"] == "Nuevo"


def test_cambiar_clave(client):
    r = client.post("/api/auth/clave", json={"actual": "mal-clave", "nueva": "clave-nueva-456"})
    assert r.status_code == 400
    r = client.post("/api/auth/clave", json={"actual": CUENTA["contrasena"], "nueva": "clave-nueva-456"})
    assert r.status_code == 200
    login = client.post("/api/auth/login", data={"username": "demo", "password": "clave-nueva-456"})
    assert login.status_code == 200


def test_clave_corta_se_rechaza(client):
    r = client.post("/api/auth/clave", json={"actual": CUENTA["contrasena"], "nueva": "corta"})
    assert r.status_code == 422


def test_cambiar_clave_anula_los_tokens_viejos(client):
    client.post("/api/auth/clave", json={"actual": CUENTA["contrasena"], "nueva": "clave-nueva-456"})
    viejo = jwt.encode({"sub": "1", "iat": 1000, "exp": 9999999999}, seguridad.SECRETO, algorithm=seguridad.ALGORITMO)
    r = client.get("/api/auth/yo", headers={"Authorization": f"Bearer {viejo}"})
    assert r.status_code == 401


def test_respaldo_se_descarga(client, tmp_path, monkeypatch):
    origen = tmp_path / "datos"
    origen.mkdir()
    monkeypatch.setattr("app.routers.sistema.CARPETA_DATOS", origen)
    r = client.get("/api/sistema/respaldo")
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]


def test_respaldo_exige_login(anonimo):
    assert anonimo.get("/api/sistema/respaldo").status_code == 401
