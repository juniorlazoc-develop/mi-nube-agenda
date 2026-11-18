"""Pruebas de la bitácora y los gastos."""
from datetime import date


def test_bitacora(client):
    r = client.post("/api/bitacora", json={"fecha": "2026-11-01", "texto": "Configuré la OLT", "animo": "😀"})
    assert r.status_code == 201
    client.post("/api/bitacora", json={"fecha": "2026-11-05", "texto": "Reunión"})
    notas = client.get("/api/bitacora", params={"fecha": "2026-11-01"}).json()
    assert [n["texto"] for n in notas] == ["Configuré la OLT"]
    assert client.get("/api/bitacora/dias", params={"mes": "2026-11"}).json() == ["2026-11-01", "2026-11-05"]
    assert client.delete(f"/api/bitacora/{notas[0]['id']}").status_code == 204
    assert client.post("/api/bitacora", json={"texto": ""}).status_code == 422


def test_gastos_y_resumen(client):
    client.post("/api/gastos", json={"fecha": "2026-11-02", "descripcion": "Almuerzo", "monto": 15.5, "categoria": "Comida"})
    client.post("/api/gastos", json={"fecha": "2026-11-03", "descripcion": "Cena", "monto": 20, "categoria": "Comida"})
    client.post("/api/gastos", json={"fecha": "2026-11-03", "descripcion": "Pasaje", "monto": 3.2, "categoria": "Transporte"})
    client.post("/api/gastos", json={"fecha": "2026-10-31", "descripcion": "De octubre", "monto": 99})

    assert len(client.get("/api/gastos", params={"mes": "2026-11"}).json()) == 3
    r = client.get("/api/gastos/resumen", params={"mes": "2026-11"}).json()
    assert r["total"] == 38.7
    assert r["por_categoria"][0] == {"categoria": "Comida", "total": 35.5, "cantidad": 2}


def test_gastos_validaciones(client):
    assert client.post("/api/gastos", json={"descripcion": "Gratis", "monto": 0}).status_code == 422
    assert client.post("/api/gastos", json={"descripcion": "Negativo", "monto": -5}).status_code == 422
    assert client.get("/api/gastos", params={"mes": "noviembre"}).status_code == 422
    g = client.post("/api/gastos", json={"descripcion": "Café", "monto": 4}).json()
    assert g["fecha"] == date.today().isoformat()
    assert client.delete(f"/api/gastos/{g['id']}").status_code == 204
    assert client.delete(f"/api/gastos/{g['id']}").status_code == 404
