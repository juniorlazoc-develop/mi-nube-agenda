"""
Rutas de acceso (login).

    GET  /api/auth/estado    -> ¿ya existe la cuenta? (para mostrar "Entrar" o "Crear cuenta")
    POST /api/auth/registro  -> crea TU cuenta (solo funciona si aún no hay ninguna)
    POST /api/auth/login     -> usuario + contraseña -> token
    GET  /api/auth/yo        -> quién soy (requiere token)
    PATCH /api/auth/yo       -> cambiar tu nombre
    POST /api/auth/clave     -> cambiar tu contraseña (pide la actual)

"Mi Nube" es personal: solo se permite UNA cuenta. Después de crearla,
el registro queda cerrado y nadie más puede inscribirse.

En producción el registro web está SIEMPRE cerrado: si no, entre publicar la
página y crear tu cuenta, un desconocido podría crearla primero y quedarse con todo.
Allí la cuenta llega junto con tu base de datos (ver GUIA.md, sección F).
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, func, select

from app import seguridad
from app.database import get_session
from app.limitador import limitador
from app.models import ClaveCambiar, PerfilActualizar, Token, Usuario, UsuarioCrear, UsuarioPublico
from app.seguridad import UsuarioDep, crear_token, hashear, registrar_cambio_de_clave, verificar

router = APIRouter(prefix="/api/auth", tags=["Acceso"])

SessionDep = Annotated[Session, Depends(get_session)]


def hay_usuarios(session: Session) -> bool:
    return session.exec(select(func.count()).select_from(Usuario)).one() > 0


def respuesta_token(usuario: Usuario) -> Token:
    return Token(access_token=crear_token(usuario), usuario=UsuarioPublico.model_validate(usuario))


@router.get("/estado")
def estado(session: SessionDep):
    return {"hay_usuario": hay_usuarios(session)}


@router.post("/registro", response_model=Token, status_code=201)
def registro(datos: UsuarioCrear, session: SessionDep):
    if seguridad.PRODUCCION:
        raise HTTPException(status_code=403, detail="El registro está cerrado en este servidor.")
    if hay_usuarios(session):
        raise HTTPException(status_code=403, detail="Ya existe una cuenta. Solo su dueño puede entrar.")
    usuario = Usuario(
        usuario=datos.usuario.lower(),
        nombre=datos.nombre.strip(),
        hash_contrasena=hashear(datos.contrasena),
    )
    session.add(usuario)
    session.commit()
    session.refresh(usuario)
    return respuesta_token(usuario)


@router.post("/login", response_model=Token)
def login(
    formulario: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: SessionDep,
    peticion: Request,
):
    ip = peticion.client.host if peticion.client else "desconocida"
    # Se revisa ANTES de comprobar la clave: un bloqueado no puede seguir probando.
    if limitador.bloqueada(ip):
        raise HTTPException(status_code=429, detail="Demasiados intentos. Espera 15 minutos.")

    # Se recibe como formulario (no JSON) porque es el estándar OAuth2:
    # así también funciona el botón "Authorize" de /docs.
    usuario = session.exec(
        select(Usuario).where(Usuario.usuario == formulario.username.lower())
    ).first()
    # Mismo mensaje si falla el usuario o la contraseña: no damos pistas a un intruso.
    if not usuario or not verificar(formulario.password, usuario.hash_contrasena):
        limitador.registrar_fallo(ip)
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")
    limitador.perdonar(ip)
    return respuesta_token(usuario)


@router.get("/yo", response_model=UsuarioPublico)
def yo(usuario: UsuarioDep):
    return usuario


@router.patch("/yo", response_model=UsuarioPublico)
def actualizar_perfil(datos: PerfilActualizar, usuario: UsuarioDep, session: SessionDep):
    usuario.nombre = datos.nombre.strip()
    session.add(usuario)
    session.commit()
    session.refresh(usuario)
    return usuario


@router.post("/clave", response_model=Token)
def cambiar_clave(datos: ClaveCambiar, usuario: UsuarioDep, session: SessionDep, peticion: Request):
    """Devuelve un token nuevo: este equipo sigue dentro y los demás deben volver a entrar."""
    ip = peticion.client.host if peticion.client else "desconocida"
    if limitador.bloqueada(ip):
        raise HTTPException(status_code=429, detail="Demasiados intentos. Espera 15 minutos.")
    if not verificar(datos.actual, usuario.hash_contrasena):
        limitador.registrar_fallo(ip)
        # 400 y no 401: la sesión sigue siendo válida, solo falló la clave escrita.
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta.")
    limitador.perdonar(ip)
    usuario.hash_contrasena = hashear(datos.nueva)
    session.add(usuario)
    session.commit()
    registrar_cambio_de_clave(session)
    return respuesta_token(usuario)
