"""
Rutas de gastos.

    GET    /api/gastos?mes=2026-11          -> gastos del mes
    GET    /api/gastos/resumen?mes=2026-11  -> total, categorías, presupuesto y mes anterior
    GET    /api/gastos/tendencia?meses=6    -> total de cada uno de los últimos meses
    GET    /api/gastos/csv?mes=2026-11      -> descarga el mes para abrirlo en Excel
    PUT    /api/gastos/presupuesto          -> fija cuánto quieres gastar al mes
    POST   /api/gastos                      -> registrar gasto
    DELETE /api/gastos/{id}                 -> eliminar gasto
"""
import csv
from datetime import date
from io import StringIO
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlmodel import Session, func, select

from app import ajustes
from app.database import get_session
from app.models import Gasto, GastoCrear, PresupuestoDatos

router = APIRouter(prefix="/api/gastos", tags=["Gastos"])

SessionDep = Annotated[Session, Depends(get_session)]

# ?mes= debe tener la forma AAAA-MM (si no, FastAPI responde 422 solo).
MesQuery = Annotated[str, Query(pattern=r"^\d{4}-\d{2}$", examples=["2026-11"])]


def rango_mes(mes: str) -> tuple[date, date]:
    """'2026-11' -> (1 de noviembre, 1 de diciembre). El fin NO se incluye."""
    a, m = map(int, mes.split("-"))
    if not 1 <= m <= 12:
        raise HTTPException(status_code=422, detail="Mes inválido")
    inicio = date(a, m, 1)
    fin = date(a + 1, 1, 1) if m == 12 else date(a, m + 1, 1)
    return inicio, fin


def mover_mes(anio: int, mes: int, cantidad: int) -> tuple[int, int]:
    """Suma o resta meses: (2026, 1) - 1 -> (2025, 12)."""
    total = anio * 12 + (mes - 1) + cantidad
    return total // 12, total % 12 + 1


def total_del_rango(session: Session, inicio: date, fin: date) -> float:
    consulta = select(func.coalesce(func.sum(Gasto.monto), 0)).where(Gasto.fecha >= inicio, Gasto.fecha < fin)
    return round(session.exec(consulta).one(), 2)


def texto_seguro(texto: str) -> str:
    """
    Excel ejecuta como fórmula lo que empieza con = + - @. Con una comilla al inicio
    lo trata como texto, y una descripción maliciosa no puede hacer nada al abrir el archivo.
    """
    return f"'{texto}" if texto[:1] in ("=", "+", "-", "@") else texto


@router.get("", response_model=list[Gasto])
def listar_gastos(session: SessionDep, mes: MesQuery):
    inicio, fin = rango_mes(mes)
    consulta = (
        select(Gasto)
        .where(Gasto.fecha >= inicio, Gasto.fecha < fin)
        .order_by(Gasto.fecha.desc(), Gasto.creado_en.desc())
    )
    return session.exec(consulta).all()


# Va ANTES de "/{gasto_id}" para que FastAPI no crea que "resumen" es un id.
@router.get("/resumen")
def resumen_gastos(session: SessionDep, mes: MesQuery):
    inicio, fin = rango_mes(mes)
    # GROUP BY: la BD suma los montos de cada categoría por nosotros.
    consulta = (
        select(Gasto.categoria, func.sum(Gasto.monto), func.count())
        .where(Gasto.fecha >= inicio, Gasto.fecha < fin)
        .group_by(Gasto.categoria)
        .order_by(func.sum(Gasto.monto).desc())
    )
    filas = session.exec(consulta).all()
    por_categoria = [
        {"categoria": c, "total": round(t, 2), "cantidad": n} for c, t, n in filas
    ]
    a, m = mover_mes(inicio.year, inicio.month, -1)
    return {
        "mes": mes,
        "total": round(sum(x["total"] for x in por_categoria), 2),
        "por_categoria": por_categoria,
        "mes_anterior": total_del_rango(session, date(a, m, 1), inicio),
        "presupuesto": float(ajustes.leer(session, "presupuesto") or 0),
    }


@router.get("/tendencia")
def tendencia(session: SessionDep, meses: Annotated[int, Query(ge=2, le=24)] = 6):
    hoy = date.today()
    salida = []
    for atras in range(meses - 1, -1, -1):
        a, m = mover_mes(hoy.year, hoy.month, -atras)
        mes = f"{a}-{m:02d}"
        salida.append({"mes": mes, "total": total_del_rango(session, *rango_mes(mes))})
    return salida


@router.get("/csv")
def exportar_csv(session: SessionDep, mes: MesQuery):
    salida = StringIO()
    salida.write("\ufeff")  # marca BOM: así Excel respeta las tildes
    # Punto y coma: en Perú Excel usa la coma para los decimales.
    escritor = csv.writer(salida, delimiter=";")
    escritor.writerow(["Fecha", "Descripción", "Categoría", "Monto (S/)"])
    for g in reversed(listar_gastos(session, mes)):
        monto = f"{g.monto:.2f}".replace(".", ",")
        escritor.writerow([g.fecha.isoformat(), texto_seguro(g.descripcion), texto_seguro(g.categoria), monto])
    cabecera = {"Content-Disposition": f'attachment; filename="gastos-{mes}.csv"'}
    return Response(salida.getvalue(), media_type="text/csv; charset=utf-8", headers=cabecera)


@router.put("/presupuesto")
def fijar_presupuesto(datos: PresupuestoDatos, session: SessionDep):
    ajustes.guardar(session, "presupuesto", str(round(datos.monto, 2)))
    return {"presupuesto": round(datos.monto, 2)}


@router.post("", response_model=Gasto, status_code=201)
def crear_gasto(datos: GastoCrear, session: SessionDep):
    gasto = Gasto.model_validate(datos)
    gasto.monto = round(gasto.monto, 2)
    session.add(gasto)
    session.commit()
    session.refresh(gasto)
    return gasto


@router.delete("/{gasto_id}", status_code=204)
def eliminar_gasto(gasto_id: int, session: SessionDep):
    gasto = session.get(Gasto, gasto_id)
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    session.delete(gasto)
    session.commit()
