"""
Rutas (endpoints) de los pendientes.

Esto es una API REST: cada acción es un verbo HTTP sobre una dirección (URL).

    GET    /api/tareas          -> listar (con filtros opcionales)
    GET    /api/tareas/categorias -> categorías que ya usaste (para los filtros)
    POST   /api/tareas          -> crear
    GET    /api/tareas/{id}     -> ver una
    PATCH  /api/tareas/{id}     -> editar parte de una (ej: marcarla hecha)
    DELETE /api/tareas/{id}     -> eliminar
"""
from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import Tarea, TareaActualizar, TareaCrear, ahora_utc

router = APIRouter(prefix="/api/tareas", tags=["Tareas"])

# Atajo: "SessionDep" = una sesión de BD inyectada por FastAPI.
SessionDep = Annotated[Session, Depends(get_session)]


def obtener_o_404(session: Session, tarea_id: int) -> Tarea:
    tarea = session.get(Tarea, tarea_id)
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return tarea


@router.get("", response_model=list[Tarea])
def listar_tareas(
    session: SessionDep,
    fecha: Optional[date] = None,      # ?fecha=2026-10-31
    hecha: Optional[bool] = None,      # ?hecha=false
    atrasadas: bool = False,           # ?atrasadas=true -> no hechas de días anteriores
    categoria: Optional[str] = None,   # ?categoria=Trabajo
    q: Optional[str] = None,           # ?q=olt -> busca en título y detalle
):
    consulta = select(Tarea)
    if fecha:
        consulta = consulta.where(Tarea.fecha == fecha)
    if hecha is not None:
        consulta = consulta.where(Tarea.hecha == hecha)
    if atrasadas:
        consulta = consulta.where(Tarea.fecha < date.today(), Tarea.hecha == False)  # noqa: E712
    if categoria:
        consulta = consulta.where(Tarea.categoria == categoria)
    if q:
        patron = f"%{q.strip()}%"  # % = "cualquier texto" en SQL (LIKE)
        consulta = consulta.where(Tarea.titulo.ilike(patron) | Tarea.detalle.ilike(patron))
    consulta = consulta.order_by(Tarea.fecha, Tarea.hecha, Tarea.hora)
    return session.exec(consulta).all()


# Va ANTES de "/{tarea_id}" para que FastAPI no crea que "categorias" es un id.
@router.get("/categorias", response_model=list[str])
def listar_categorias(session: SessionDep):
    return sorted(session.exec(select(Tarea.categoria).distinct()).all())


@router.post("", response_model=Tarea, status_code=201)
def crear_tarea(datos: TareaCrear, session: SessionDep):
    tarea = Tarea.model_validate(datos)  # convierte el esquema en una fila de la tabla
    session.add(tarea)
    session.commit()       # guarda en la BD
    session.refresh(tarea) # recarga para obtener el id generado
    return tarea


@router.get("/{tarea_id}", response_model=Tarea)
def ver_tarea(tarea_id: int, session: SessionDep):
    return obtener_o_404(session, tarea_id)


@router.patch("/{tarea_id}", response_model=Tarea)
def actualizar_tarea(tarea_id: int, datos: TareaActualizar, session: SessionDep):
    tarea = obtener_o_404(session, tarea_id)
    cambios = datos.model_dump(exclude_unset=True)  # solo los campos que realmente enviaste

    # Si cambia el estado "hecha", guardamos cuándo se completó.
    if "hecha" in cambios:
        cambios["hecha_en"] = ahora_utc() if cambios["hecha"] else None

    tarea.sqlmodel_update(cambios)
    session.add(tarea)
    session.commit()
    session.refresh(tarea)
    return tarea


@router.delete("/{tarea_id}", status_code=204)
def eliminar_tarea(tarea_id: int, session: SessionDep):
    tarea = obtener_o_404(session, tarea_id)
    session.delete(tarea)
    session.commit()
    # 204 = "No Content": se borró y no hay nada que devolver.
