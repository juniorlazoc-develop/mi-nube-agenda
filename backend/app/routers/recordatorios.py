"""
Rutas de los recordatorios.

    GET    /api/recordatorios?estado=pendientes  -> lista (pendientes | hechos)
    POST   /api/recordatorios                    -> crear
    PATCH  /api/recordatorios/{id}               -> editar
    POST   /api/recordatorios/{id}/completar     -> marcar hecho (si se repite, pasa al siguiente)
    POST   /api/recordatorios/{id}/posponer      -> avisar de nuevo dentro de X minutos
    DELETE /api/recordatorios/{id}               -> eliminar

El backend solo guarda las fechas. Quien avisa es el navegador: cada 30 segundos
compara esta lista con la hora actual (ver components/AvisosRecordatorio.jsx).
"""
import calendar
from datetime import date, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import (
    Posponer,
    Recordatorio,
    RecordatorioActualizar,
    RecordatorioCrear,
    ahora_utc,
)

router = APIRouter(prefix="/api/recordatorios", tags=["Recordatorios"])

SessionDep = Annotated[Session, Depends(get_session)]


def siguiente_fecha(fecha: date, repetir: str, dia_ancla: int) -> date:
    """La fecha de la próxima repetición."""
    if repetir == "diaria":
        return fecha + timedelta(days=1)
    if repetir == "semanal":
        return fecha + timedelta(days=7)

    # Mensual y anual: no todos los meses tienen 31 días, por eso se ajusta al último.
    anio, mes = fecha.year, fecha.month
    if repetir == "anual":
        anio += 1
    else:
        anio, mes = (anio + 1, 1) if mes == 12 else (anio, mes + 1)
    return date(anio, mes, min(dia_ancla, calendar.monthrange(anio, mes)[1]))


def obtener_o_404(session: Session, recordatorio_id: int) -> Recordatorio:
    recordatorio = session.get(Recordatorio, recordatorio_id)
    if not recordatorio:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    return recordatorio


def guardar(session: Session, recordatorio: Recordatorio) -> Recordatorio:
    session.add(recordatorio)
    session.commit()
    session.refresh(recordatorio)
    return recordatorio


@router.get("", response_model=list[Recordatorio])
def listar(session: SessionDep, estado: Literal["pendientes", "hechos"] = "pendientes"):
    consulta = select(Recordatorio).where(Recordatorio.hecho == (estado == "hechos"))
    if estado == "hechos":
        return session.exec(consulta.order_by(Recordatorio.hecho_en.desc()).limit(50)).all()
    return session.exec(consulta.order_by(Recordatorio.fecha, Recordatorio.hora)).all()


@router.post("", response_model=Recordatorio, status_code=201)
def crear(datos: RecordatorioCrear, session: SessionDep):
    recordatorio = Recordatorio.model_validate(datos, update={"dia_ancla": datos.fecha.day})
    return guardar(session, recordatorio)


@router.patch("/{recordatorio_id}", response_model=Recordatorio)
def actualizar(recordatorio_id: int, datos: RecordatorioActualizar, session: SessionDep):
    recordatorio = obtener_o_404(session, recordatorio_id)
    cambios = datos.model_dump(exclude_unset=True)
    if "fecha" in cambios:
        cambios["dia_ancla"] = cambios["fecha"].day
    recordatorio.sqlmodel_update(cambios)
    return guardar(session, recordatorio)


@router.post("/{recordatorio_id}/completar", response_model=Recordatorio)
def completar(recordatorio_id: int, session: SessionDep):
    recordatorio = obtener_o_404(session, recordatorio_id)
    if recordatorio.repetir == "nunca":
        recordatorio.hecho = True
        recordatorio.hecho_en = ahora_utc()
        return guardar(session, recordatorio)

    # Se repite: salta a la próxima fecha futura (por si estuvo varios días sin atenderse).
    fecha = recordatorio.fecha
    while fecha <= date.today():
        fecha = siguiente_fecha(fecha, recordatorio.repetir, recordatorio.dia_ancla)
    recordatorio.fecha = fecha
    return guardar(session, recordatorio)


@router.post("/{recordatorio_id}/posponer", response_model=Recordatorio)
def posponer(recordatorio_id: int, datos: Posponer, session: SessionDep):
    recordatorio = obtener_o_404(session, recordatorio_id)
    nuevo = datetime.now() + timedelta(minutes=datos.minutos)
    recordatorio.fecha = nuevo.date()
    recordatorio.hora = nuevo.time().replace(second=0, microsecond=0)
    return guardar(session, recordatorio)


@router.delete("/{recordatorio_id}", status_code=204)
def eliminar(recordatorio_id: int, session: SessionDep):
    session.delete(obtener_o_404(session, recordatorio_id))
    session.commit()
