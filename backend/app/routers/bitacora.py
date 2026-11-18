"""
Rutas de la bitácora ("lo que hice").

    GET    /api/bitacora?fecha=2026-11-01  -> notas de un día
    GET    /api/bitacora/dias?mes=2026-11  -> qué días del mes tienen notas
    POST   /api/bitacora                   -> agregar nota
    DELETE /api/bitacora/{id}              -> eliminar nota
"""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models import Nota, NotaCrear
from app.routers.gastos import rango_mes

router = APIRouter(prefix="/api/bitacora", tags=["Bitácora"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("", response_model=list[Nota])
def listar_notas(session: SessionDep, fecha: date):
    consulta = select(Nota).where(Nota.fecha == fecha).order_by(Nota.creada_en)
    return session.exec(consulta).all()


@router.get("/dias", response_model=list[date])
def dias_con_notas(session: SessionDep, mes: Annotated[str, Query(pattern=r"^\d{4}-\d{2}$")]):
    inicio, fin = rango_mes(mes)
    consulta = select(Nota.fecha).where(Nota.fecha >= inicio, Nota.fecha < fin).distinct()
    return sorted(session.exec(consulta).all())


@router.post("", response_model=Nota, status_code=201)
def crear_nota(datos: NotaCrear, session: SessionDep):
    nota = Nota.model_validate(datos)
    session.add(nota)
    session.commit()
    session.refresh(nota)
    return nota


@router.delete("/{nota_id}", status_code=204)
def eliminar_nota(nota_id: int, session: SessionDep):
    nota = session.get(Nota, nota_id)
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    session.delete(nota)
    session.commit()
