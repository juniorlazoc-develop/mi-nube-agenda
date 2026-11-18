"""Pruebas de las fotos. Las imágenes se crean aquí mismo y van a una carpeta temporal."""
from io import BytesIO

from PIL import Image

from app.routers import fotos

URL = "/api/fotos"


def imagen(formato="JPEG", tamano=(1200, 800), exif=None):
    salida = BytesIO()
    extra = {"exif": exif} if exif else {}
    Image.new("RGB", tamano, (120, 80, 200)).save(salida, formato, **extra)
    return salida.getvalue()


def subir(cliente, contenido=None, nombre="viaje.jpg", album=None):
    datos = {"album": album} if album else {}
    return cliente.post(URL, files={"archivo": (nombre, contenido or imagen())}, data=datos)


def test_subir_crea_imagen_y_miniatura(client):
    r = subir(client, album="  Viajes ")
    assert r.status_code == 201
    foto = r.json()
    assert (foto["ancho"], foto["alto"], foto["album"]) == (1200, 800, "Viajes")
    assert foto["archivo"] != "viaje.jpg"  # el nombre lo ponemos nosotros

    original = client.get(f"{URL}/{foto['id']}/imagen")
    assert original.status_code == 200 and original.headers["content-type"] == "image/jpeg"
    mini = Image.open(BytesIO(client.get(f"{URL}/{foto['id']}/miniatura").content))
    assert max(mini.size) == fotos.LADO_MINIATURA


def test_png_transparente(client):
    salida = BytesIO()
    Image.new("RGBA", (50, 50), (0, 0, 0, 0)).save(salida, "PNG")
    assert subir(client, salida.getvalue(), "logo.png").status_code == 201


def test_rechaza_lo_que_no_es_imagen(client):
    r = subir(client, b"MZ esto es un programa disfrazado", "foto.jpg")
    assert r.status_code == 415
    assert client.get(URL).json() == []


def test_rechaza_formato_no_permitido(client):
    assert subir(client, imagen("BMP"), "foto.jpg").status_code == 415


def test_rechaza_lo_que_pesa_demasiado(client, monkeypatch):
    monkeypatch.setattr(fotos, "LIMITE_BYTES", 100)
    assert subir(client).status_code == 413


def test_usa_la_fecha_de_la_camara(client):
    exif = Image.Exif()
    exif[306] = "2021:07:28 10:30:00"
    foto = subir(client, imagen(exif=exif)).json()
    assert foto["fecha"].startswith("2021-07-28")


def test_albumes_y_favoritas(client):
    a = subir(client, album="Viajes").json()
    subir(client, album="Viajes")
    subir(client, album="Familia")
    subir(client)
    assert client.get(f"{URL}/albumes").json() == [
        {"nombre": "Familia", "cantidad": 1},
        {"nombre": "Viajes", "cantidad": 2},
    ]
    assert len(client.get(URL, params={"album": "Viajes"}).json()) == 2

    client.patch(f"{URL}/{a['id']}", json={"favorita": True, "descripcion": "Playa"})
    favoritas = client.get(URL, params={"favoritas": True}).json()
    assert [f["descripcion"] for f in favoritas] == ["Playa"]


def test_quitar_album(client):
    foto = subir(client, album="Viajes").json()
    assert client.patch(f"{URL}/{foto['id']}", json={"album": "  "}).json()["album"] is None


def test_eliminar_borra_los_archivos(client):
    foto = subir(client).json()
    assert len(list(fotos.CARPETA_FOTOS.iterdir())) == 2
    assert client.delete(f"{URL}/{foto['id']}").status_code == 204
    assert list(fotos.CARPETA_FOTOS.iterdir()) == []


def test_sin_login_no_se_ve_ninguna_foto(client, anonimo):
    foto = subir(client).json()
    del anonimo.headers["Authorization"]  # "client" y "anonimo" son el mismo objeto
    assert anonimo.get(f"{URL}/{foto['id']}/imagen").status_code == 401
    assert anonimo.get(f"{URL}/{foto['id']}/miniatura").status_code == 401
