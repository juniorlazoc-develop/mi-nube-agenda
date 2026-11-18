"""Leer y guardar valores sueltos en la tabla 'ajuste'."""
from typing import Optional

from sqlmodel import Session

from app.models import Ajuste


def leer(session: Session, clave: str) -> Optional[str]:
    fila = session.get(Ajuste, clave)
    return fila.valor if fila else None


def guardar(session: Session, clave: str, valor: str) -> None:
    fila = session.get(Ajuste, clave) or Ajuste(clave=clave, valor=valor)
    fila.valor = valor
    session.add(fila)
    session.commit()
