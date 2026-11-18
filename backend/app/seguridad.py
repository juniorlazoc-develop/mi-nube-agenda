"""
Seguridad: contraseñas y tokens (Etapa 3).

1. CONTRASEÑAS: nunca se guardan tal cual. Guardamos un "hash" (huella) hecho con
   Argon2. Es de una sola vía: con el hash NO se puede recuperar la contraseña,
   pero sí comprobar si una contraseña escrita coincide.

2. TOKENS JWT: al entrar, el backend te da un "pase" firmado (token). El navegador
   lo envía en cada petición en la cabecera:  Authorization: Bearer <token>
   Si alguien lo modifica, la firma deja de cuadrar y se rechaza.
"""
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash
from sqlmodel import Session

from app import ajustes
from app.database import CARPETA_DATOS, get_session
from app.models import Usuario, ahora_utc

ALGORITMO = "HS256"
DURACION_TOKEN = timedelta(days=7)  # después de 7 días hay que volver a entrar

# En el servidor se activa con MI_NUBE_PRODUCCION=1: cierra el registro y oculta /docs.
PRODUCCION = os.getenv("MI_NUBE_PRODUCCION") == "1"

hasher = PasswordHash.recommended()  # Argon2, el algoritmo recomendado hoy


def _cargar_secreto() -> str:
    """
    Clave con la que se firman los tokens. Si alguien la conoce, puede fabricar tokens.
    Se toma de la variable de entorno MI_NUBE_SECRETO o, si no existe, se genera una vez
    y se guarda en data/secreto.key (que no se sube a Git).
    """
    if os.getenv("MI_NUBE_SECRETO"):
        return os.environ["MI_NUBE_SECRETO"]
    archivo = CARPETA_DATOS / "secreto.key"
    if not archivo.exists():
        archivo.write_text(secrets.token_urlsafe(48))
    return archivo.read_text().strip()


SECRETO = _cargar_secreto()


def hashear(contrasena: str) -> str:
    return hasher.hash(contrasena)


def verificar(contrasena: str, hash_guardado: str) -> bool:
    return hasher.verify(contrasena, hash_guardado)


def crear_token(usuario: Usuario) -> str:
    ahora = ahora_utc()
    # iat = "emitido en": sirve para anular los pases anteriores a un cambio de contraseña.
    datos = {"sub": str(usuario.id), "iat": ahora, "exp": ahora + DURACION_TOKEN}
    return jwt.encode(datos, SECRETO, algorithm=ALGORITMO)


def registrar_cambio_de_clave(session: Session) -> None:
    """Cierra las sesiones abiertas en otros equipos: sus tokens dejan de valer."""
    ajustes.guardar(session, "clave_cambiada_en", str(int(datetime.now(timezone.utc).timestamp())))


# Le dice a FastAPI (y a /docs) dónde se obtiene el token y que lo lea de la cabecera.
esquema_oauth = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def usuario_actual(
    token: Annotated[str, Depends(esquema_oauth)],
    session: Annotated[Session, Depends(get_session)],
) -> Usuario:
    """Dependencia: abre el token y devuelve al usuario. Si algo falla -> 401."""
    error = HTTPException(
        status_code=401,
        detail="Tu sesión expiró o no es válida. Vuelve a entrar.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        datos = jwt.decode(token, SECRETO, algorithms=[ALGORITMO])
        usuario = session.get(Usuario, int(datos["sub"]))
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise error
    if not usuario:
        raise error
    if datos.get("iat", 0) < int(ajustes.leer(session, "clave_cambiada_en") or 0):
        raise error
    return usuario


UsuarioDep = Annotated[Usuario, Depends(usuario_actual)]
