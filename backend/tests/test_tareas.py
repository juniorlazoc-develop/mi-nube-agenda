"""
Pruebas automáticas de la API de tareas.

Ejecutar (desde la carpeta backend, con el entorno virtual activado):
    pytest -v

Los "fixtures" client y anonimo están en conftest.py.
"""
from datetime import date, timedelta


def test_salud(client):
    r = client.get("/api/salud")
    assert r.status_code == 200
    assert r.json()["estado"] == "ok"


def test_crear_y_listar(client):
    r = client.post("/api/tareas", json={"titulo": "Revisar OLT", "prioridad": "alta", "hora": "09:30"})
    assert r.status_code == 201
    t = r.json()
    assert t["id"] > 0 and t["hecha"] is False and t["fecha"] == date.today().isoformat()

    r = client.get("/api/tareas", params={"fecha": date.today().isoformat()})
    assert [x["titulo"] for x in r.json()] == ["Revisar OLT"]


def test_validaciones(client):
    assert client.post("/api/tareas", json={"titulo": ""}).status_code == 422
    assert client.post("/api/tareas", json={"titulo": "X", "prioridad": "urgente"}).status_code == 422


def test_marcar_hecha(client):
    t = client.post("/api/tareas", json={"titulo": "Llamar soporte"}).json()
    r = client.patch(f"/api/tareas/{t['id']}", json={"hecha": True})
    assert r.json()["hecha"] is True and r.json()["hecha_en"] is not None
    r = client.patch(f"/api/tareas/{t['id']}", json={"hecha": False})
    assert r.json()["hecha_en"] is None


def test_atrasadas(client):
    ayer = (date.today() - timedelta(days=1)).isoformat()
    client.post("/api/tareas", json={"titulo": "Vieja", "fecha": ayer})
    client.post("/api/tareas", json={"titulo": "De hoy"})
    r = client.get("/api/tareas", params={"atrasadas": True})
    assert [x["titulo"] for x in r.json()] == ["Vieja"]


def test_eliminar(client):
    t = client.post("/api/tareas", json={"titulo": "Borrar"}).json()
    assert client.delete(f"/api/tareas/{t['id']}").status_code == 204
    assert client.get(f"/api/tareas/{t['id']}").status_code == 404


def test_filtros_categoria_y_busqueda(client):
    client.post("/api/tareas", json={"titulo": "Revisar OLT", "categoria": "Trabajo"})
    client.post("/api/tareas", json={"titulo": "Comprar pan", "categoria": "Casa", "detalle": "integral"})
    r = client.get("/api/tareas", params={"categoria": "Casa"})
    assert [x["titulo"] for x in r.json()] == ["Comprar pan"]
    r = client.get("/api/tareas", params={"q": "olt"})  # no distingue mayúsculas
    assert [x["titulo"] for x in r.json()] == ["Revisar OLT"]
    r = client.get("/api/tareas", params={"q": "integral"})  # también busca en el detalle
    assert [x["titulo"] for x in r.json()] == ["Comprar pan"]
    assert client.get("/api/tareas/categorias").json() == ["Casa", "Trabajo"]


def test_editar_titulo(client):
    t = client.post("/api/tareas", json={"titulo": "Mal escrito"}).json()
    r = client.patch(f"/api/tareas/{t['id']}", json={"titulo": "Bien escrito", "prioridad": "alta"})
    assert r.json()["titulo"] == "Bien escrito" and r.json()["prioridad"] == "alta"
