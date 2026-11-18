"""Pruebas de los recordatorios."""
from datetime import date, timedelta

import pytest

from app.routers.recordatorios import siguiente_fecha

URL = "/api/recordatorios"


def crear(cliente, **datos):
    base = {"titulo": "Pagar la luz", "fecha": "2026-11-20", "hora": "09:00"}
    return cliente.post(URL, json={**base, **datos}).json()


@pytest.mark.parametrize(
    "fecha, repetir, ancla, esperado",
    [
        (date(2026, 11, 3), "diaria", 3, date(2026, 11, 4)),
        (date(2026, 11, 3), "semanal", 3, date(2026, 11, 10)),
        (date(2026, 12, 15), "mensual", 15, date(2027, 1, 15)),  # cambia de año
        (date(2027, 1, 31), "mensual", 31, date(2027, 2, 28)),   # febrero no tiene 31
        (date(2027, 2, 28), "mensual", 31, date(2027, 3, 31)),   # vuelve al 31 original
        (date(2028, 2, 29), "anual", 29, date(2029, 2, 28)),     # año bisiesto
    ],
)
def test_siguiente_fecha(fecha, repetir, ancla, esperado):
    assert siguiente_fecha(fecha, repetir, ancla) == esperado


def test_crear_y_listar_en_orden(client):
    crear(client, titulo="Después", fecha="2026-12-01")
    crear(client, titulo="Antes", fecha="2026-11-01")
    assert [r["titulo"] for r in client.get(URL).json()] == ["Antes", "Después"]


def test_rechaza_repeticion_invalida(client):
    r = client.post(URL, json={"titulo": "x", "fecha": "2026-11-20", "hora": "09:00", "repetir": "a veces"})
    assert r.status_code == 422


def test_completar_uno_simple(client):
    r = crear(client)
    assert client.post(f"{URL}/{r['id']}/completar").json()["hecho"] is True
    assert client.get(URL).json() == []
    assert len(client.get(URL, params={"estado": "hechos"}).json()) == 1


def test_completar_uno_repetido_salta_al_futuro(client):
    hace_diez = date.today() - timedelta(days=10)
    r = crear(client, fecha=hace_diez.isoformat(), repetir="semanal")
    actualizado = client.post(f"{URL}/{r['id']}/completar").json()
    assert actualizado["hecho"] is False
    assert date.fromisoformat(actualizado["fecha"]) == hace_diez + timedelta(days=14)


def test_posponer(client):
    r = crear(client, fecha="2020-01-01")
    actualizado = client.post(f"{URL}/{r['id']}/posponer", json={"minutos": 60}).json()
    assert date.fromisoformat(actualizado["fecha"]) >= date.today()


def test_editar_fecha_actualiza_el_dia_ancla(client):
    r = crear(client, repetir="mensual")
    actualizado = client.patch(f"{URL}/{r['id']}", json={"fecha": "2026-12-31"}).json()
    assert actualizado["dia_ancla"] == 31


def test_eliminar(client):
    r = crear(client)
    assert client.delete(f"{URL}/{r['id']}").status_code == 204
    assert client.delete(f"{URL}/{r['id']}").status_code == 404


def test_exige_login(anonimo):
    assert anonimo.get(URL).status_code == 401
