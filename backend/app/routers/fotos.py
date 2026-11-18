"""
Rutas de las fotos (Etapa 4).

    GET    /api/fotos?album=Viajes&favoritas=true  -> lista
    GET    /api/fotos/albumes                      -> álbumes con su cantidad de fotos
    POST   /api/fotos                              -> subir (formulario con el archivo)
    GET    /api/fotos/{id}/miniatura               -> imagen pequeña, para la galería
    GET    /api/fotos/{id}/imagen                  -> imagen original
    PATCH  /api/fotos/{id}                         -> descripción, álbum o favorita
    DELETE /api/fotos/{id}                         -> eliminar

Cada imagen pasa por Pillow antes de guardarse. No basta con mirar la extensión:
alguien podría renombrar un programa a "foto.jpg". Si Pillow no logra abrirla, se rechaza.
"""
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Annotated, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlmodel import Session, func, select

from app.database import CARPETA_DATOS, get_session
from app.models import Foto, FotoActualizar

router = APIRouter(prefix="/api/fotos", tags=["Fotos"])

SessionDep = Annotated[Session, Depends(get_session)]

CARPETA_FOTOS = CARPETA_DATOS / "fotos"
LIMITE_BYTES = 15 * 1024 * 1024  # 15 MB
LADO_MINIATURA = 600

# Formato que detecta Pillow -> (extensión, tipo que se envía al navegador)
FORMATOS = {
    "JPEG": (".jpg", "image/jpeg"),
    "PNG": (".png", "image/png"),
    "WEBP": (".webp", "image/webp"),
    "GIF": (".gif", "image/gif"),
}
TIPOS = {extension: tipo for extension, tipo in FORMATOS.values()}


def ruta_miniatura(archivo: str) -> Path:
    return CARPETA_FOTOS / f"mini-{Path(archivo).stem}.jpg"


def fecha_de_captura(imagen: Image.Image) -> Optional[datetime]:
    """Lee del EXIF (los datos que guarda la cámara) cuándo se tomó la foto."""
    exif = imagen.getexif()
    texto = exif.get_ifd(0x8769).get(36867) or exif.get(306)  # DateTimeOriginal o DateTime
    try:
        return datetime.strptime(str(texto), "%Y:%m:%d %H:%M:%S")
    except ValueError:
        return None


def crear_miniatura(imagen: Image.Image) -> bytes:
    copia = imagen.convert("RGBA")
    # Las zonas transparentes de un PNG se vuelven del color de fondo: JPEG no tiene transparencia.
    fondo = Image.new("RGBA", copia.size, (20, 22, 40, 255))
    fondo.alpha_composite(copia)
    fondo.thumbnail((LADO_MINIATURA, LADO_MINIATURA))
    salida = BytesIO()
    fondo.convert("RGB").save(salida, "JPEG", quality=82, optimize=True)
    return salida.getvalue()


def limpiar_album(album: Optional[str]) -> Optional[str]:
    return (album or "").strip()[:60] or None


def obtener_o_404(session: Session, foto_id: int) -> Foto:
    foto = session.get(Foto, foto_id)
    if not foto:
        raise HTTPException(status_code=404, detail="Foto no encontrada")
    return foto


def entregar(ruta: Path, tipo: str) -> FileResponse:
    if not ruta.exists():
        raise HTTPException(status_code=404, detail="El archivo de la foto ya no existe")
    # private: solo tu navegador puede guardarla, nunca un servidor intermedio.
    return FileResponse(ruta, media_type=tipo, headers={"Cache-Control": "private, max-age=86400"})


@router.get("", response_model=list[Foto])
def listar(session: SessionDep, album: Optional[str] = None, favoritas: bool = False):
    consulta = select(Foto)
    if album:
        consulta = consulta.where(Foto.album == album)
    if favoritas:
        consulta = consulta.where(Foto.favorita == True)  # noqa: E712
    return session.exec(consulta.order_by(Foto.fecha.desc(), Foto.id.desc())).all()


# Va ANTES de las rutas con {foto_id} para que "albumes" no se tome como un id.
@router.get("/albumes")
def listar_albumes(session: SessionDep):
    consulta = (
        select(Foto.album, func.count())
        .where(Foto.album.is_not(None))
        .group_by(Foto.album)
        .order_by(Foto.album)
    )
    return [{"nombre": nombre, "cantidad": n} for nombre, n in session.exec(consulta).all()]


# Es "def" y no "async def": así Pillow trabaja en otro hilo sin frenar al servidor.
@router.post("", response_model=Foto, status_code=201)
def subir(
    session: SessionDep,
    archivo: Annotated[UploadFile, File()],
    album: Annotated[Optional[str], Form()] = None,
):
    contenido = archivo.file.read(LIMITE_BYTES + 1)
    if len(contenido) > LIMITE_BYTES:
        raise HTTPException(status_code=413, detail="La foto pesa más de 15 MB.")

    try:
        imagen = Image.open(BytesIO(contenido))
        formato = imagen.format
        if formato not in FORMATOS:
            raise UnidentifiedImageError
        tomada = fecha_de_captura(imagen)
        imagen = ImageOps.exif_transpose(imagen)  # endereza las fotos del celular
        miniatura = crear_miniatura(imagen)
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError):
        raise HTTPException(status_code=415, detail="El archivo no es una imagen válida (JPG, PNG, WEBP o GIF).")

    extension = FORMATOS[formato][0]
    nombre = f"{uuid4().hex}{extension}"  # nunca usamos el nombre que envió el usuario
    CARPETA_FOTOS.mkdir(parents=True, exist_ok=True)
    (CARPETA_FOTOS / nombre).write_bytes(contenido)
    ruta_miniatura(nombre).write_bytes(miniatura)

    foto = Foto(
        archivo=nombre,
        nombre_original=(archivo.filename or "foto")[:200],
        album=limpiar_album(album),
        ancho=imagen.width,
        alto=imagen.height,
        bytes=len(contenido),
    )
    if tomada:
        foto.fecha = tomada.astimezone()  # la cámara no guarda zona horaria: usamos la del servidor
    session.add(foto)
    session.commit()
    session.refresh(foto)
    return foto


@router.get("/{foto_id}/miniatura")
def ver_miniatura(foto_id: int, session: SessionDep):
    return entregar(ruta_miniatura(obtener_o_404(session, foto_id).archivo), "image/jpeg")


@router.get("/{foto_id}/imagen")
def ver_imagen(foto_id: int, session: SessionDep):
    foto = obtener_o_404(session, foto_id)
    return entregar(CARPETA_FOTOS / foto.archivo, TIPOS[Path(foto.archivo).suffix])


@router.patch("/{foto_id}", response_model=Foto)
def actualizar(foto_id: int, datos: FotoActualizar, session: SessionDep):
    foto = obtener_o_404(session, foto_id)
    cambios = datos.model_dump(exclude_unset=True)
    if "album" in cambios:
        cambios["album"] = limpiar_album(cambios["album"])
    foto.sqlmodel_update(cambios)
    session.add(foto)
    session.commit()
    session.refresh(foto)
    return foto


@router.delete("/{foto_id}", status_code=204)
def eliminar(foto_id: int, session: SessionDep):
    foto = obtener_o_404(session, foto_id)
    (CARPETA_FOTOS / foto.archivo).unlink(missing_ok=True)
    ruta_miniatura(foto.archivo).unlink(missing_ok=True)
    session.delete(foto)
    session.commit()
