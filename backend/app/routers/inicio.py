"""
Panel de inicio: junta en UNA respuesta lo más importante de cada sección.

    GET /api/inicio
"""
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from app import ajustes
from app.database import get_session
from app.models import Foto, Gasto, Nota, Recordatorio, Tarea
from app.routers.gastos import rango_mes

router = APIRouter(prefix="/api/inicio", tags=["Inicio"])

SessionDep = Annotated[Session, Depends(get_session)]


def calcular_racha(fechas: set[date], hoy: date) -> int:
    """Días seguidos escribiendo en la bitácora. Si hoy aún no escribes, cuenta desde ayer."""
    dia = hoy if hoy in fechas else hoy - timedelta(days=1)
    racha = 0
    while dia in fechas:
        racha += 1
        dia -= timedelta(days=1)
    return racha


@router.get("")
def resumen_inicio(session: SessionDep):
    hoy = date.today()
    inicio_mes, fin_mes = rango_mes(hoy.strftime("%Y-%m"))

    tareas_hoy = session.exec(select(Tarea).where(Tarea.fecha == hoy).order_by(Tarea.hecha, Tarea.hora)).all()
    atrasadas = session.exec(
        select(func.count()).select_from(Tarea).where(Tarea.fecha < hoy, Tarea.hecha == False)  # noqa: E712
    ).one()
    recordatorios = session.exec(
        select(Recordatorio)
        .where(Recordatorio.hecho == False)  # noqa: E712
        .order_by(Recordatorio.fecha, Recordatorio.hora)
        .limit(5)
    ).all()
    gastado = session.exec(
        select(func.coalesce(func.sum(Gasto.monto), 0)).where(Gasto.fecha >= inicio_mes, Gasto.fecha < fin_mes)
    ).one()
    fechas_notas = set(session.exec(select(Nota.fecha).distinct()).all())
    notas_semana = session.exec(
        select(Nota).where(Nota.fecha > hoy - timedelta(days=7)).order_by(Nota.fecha, Nota.creada_en)
    ).all()
    ultimas_fotos = session.exec(select(Foto).order_by(Foto.fecha.desc(), Foto.id.desc()).limit(4)).all()

    return {
        "hoy": hoy,
        "tareas": {
            "lista": tareas_hoy[:5],
            "total": len(tareas_hoy),
            "hechas": sum(t.hecha for t in tareas_hoy),
            "atrasadas": atrasadas,
        },
        "recordatorios": recordatorios,
        "gastos": {
            "total": round(gastado, 2),
            "presupuesto": float(ajustes.leer(session, "presupuesto") or 0),
        },
        "bitacora": {
            "racha": calcular_racha(fechas_notas, hoy),
            "escrito_hoy": hoy in fechas_notas,
            # El último ánimo de cada día de la semana, para dibujar la franja de emojis.
            "animos": {n.fecha.isoformat(): n.animo for n in notas_semana if n.animo},
        },
        "fotos": {
            "total": session.exec(select(func.count()).select_from(Foto)).one(),
            "ultimas": ultimas_fotos,
        },
    }
