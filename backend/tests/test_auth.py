"""Pruebas del login (Etapa 3)."""
from app import seguridad
from app.limitador import MAX_FALLOS, VENTANA_SEGUNDOS, limitador
from tests.conftest import CUENTA


def entrar(cliente, usuario, contrasena):
    # El login recibe un FORMULARIO (data=), no JSON, como pide el estándar OAuth2.
    return cliente.post("/api/auth/login", data={"username": usuario, "password": contrasena})


def test_sin_token_no_se_entra(anonimo):
    assert anonimo.get("/api/tareas").status_code == 401
    assert anonimo.get("/api/gastos", params={"mes": "2026-11"}).status_code == 401
    assert anonimo.get("/api/salud").status_code == 200  # esta sí es pública


def test_registro_y_login(anonimo):
    assert anonimo.get("/api/auth/estado").json() == {"hay_usuario": False}
    r = anonimo.post("/api/auth/registro", json=CUENTA)
    assert r.status_code == 201 and r.json()["usuario"]["nombre"] == "Demo"
    assert "contrasena" not in r.text and "hash" not in r.text  # nunca se devuelve
    assert anonimo.get("/api/auth/estado").json() == {"hay_usuario": True}

    r = entrar(anonimo, "DEMO", CUENTA["contrasena"])  # el usuario no distingue mayúsculas
    assert r.status_code == 200
    token = r.json()["access_token"]
    r = anonimo.get("/api/auth/yo", headers={"Authorization": f"Bearer {token}"})
    assert r.json()["usuario"] == "demo"


def test_contrasena_incorrecta(anonimo):
    anonimo.post("/api/auth/registro", json=CUENTA)
    assert entrar(anonimo, "demo", "otra-clave").status_code == 401
    assert entrar(anonimo, "nadie", "otra-clave").status_code == 401


def test_solo_una_cuenta(anonimo):
    anonimo.post("/api/auth/registro", json=CUENTA)
    r = anonimo.post("/api/auth/registro", json={**CUENTA, "usuario": "intruso"})
    assert r.status_code == 403


def test_token_falso(anonimo):
    r = anonimo.get("/api/tareas", headers={"Authorization": "Bearer inventado.123.abc"})
    assert r.status_code == 401


def test_contrasena_corta(anonimo):
    r = anonimo.post("/api/auth/registro", json={**CUENTA, "contrasena": "123"})
    assert r.status_code == 422


def test_bloquea_tras_muchos_fallos(anonimo):
    anonimo.post("/api/auth/registro", json=CUENTA)
    for _ in range(MAX_FALLOS):
        assert entrar(anonimo, "demo", "otra-clave").status_code == 401
    # Bloqueado: ni siquiera la clave correcta entra, así no puede seguir probando.
    assert entrar(anonimo, "demo", CUENTA["contrasena"]).status_code == 429


def test_entrar_bien_borra_los_fallos(anonimo):
    anonimo.post("/api/auth/registro", json=CUENTA)
    for _ in range(MAX_FALLOS - 1):
        entrar(anonimo, "demo", "otra-clave")
    assert entrar(anonimo, "demo", CUENTA["contrasena"]).status_code == 200
    assert entrar(anonimo, "demo", "otra-clave").status_code == 401  # contador en cero otra vez


def test_el_bloqueo_se_vence(anonimo, monkeypatch):
    anonimo.post("/api/auth/registro", json=CUENTA)
    for _ in range(MAX_FALLOS):
        entrar(anonimo, "demo", "otra-clave")
    # Simulamos que pasó el tiempo adelantando el reloj del limitador.
    ahora = VENTANA_SEGUNDOS + max(limitador.fallos["testclient"]) + 1
    monkeypatch.setattr("app.limitador.monotonic", lambda: ahora)
    assert entrar(anonimo, "demo", CUENTA["contrasena"]).status_code == 200


def test_produccion_cierra_el_registro(anonimo, monkeypatch):
    monkeypatch.setattr(seguridad, "PRODUCCION", True)
    assert anonimo.post("/api/auth/registro", json=CUENTA).status_code == 403
    assert anonimo.get("/api/auth/estado").json() == {"hay_usuario": False}
