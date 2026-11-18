"""
Modelos de datos.

Con SQLModel, una misma clase sirve para dos cosas:
  - Con table=True  -> es una TABLA de la base de datos.
  - Sin table=True  -> es un "esquema": define qué datos acepta la API
                       y los valida automáticamente (si algo está mal,
                       FastAPI responde 422 con el detalle del error).
"""
from datetime import date, datetime, time, timezone
from typing import Literal, Optional

from sqlmodel import Field, SQLModel


def ahora_utc() -> datetime:
    """Hora actual en UTC (con zona horaria). El frontend la muestra en tu hora local."""
    return datetime.now(timezone.utc)

# Solo se aceptan estos tres valores. Cualquier otro -> error 422.
Prioridad = Literal["alta", "media", "baja"]


class Tarea(SQLModel, table=True):
    """Tabla 'tarea': cada fila es un pendiente."""

    id: Optional[int] = Field(default=None, primary_key=True)  # lo pone la BD
    titulo: str = Field(max_length=200)
    detalle: Optional[str] = None
    fecha: date = Field(default_factory=date.today, index=True)  # index = búsquedas rápidas por fecha
    hora: Optional[time] = None
    prioridad: str = "media"
    categoria: str = "Trabajo"
    hecha: bool = False
    creada_en: datetime = Field(default_factory=ahora_utc)
    hecha_en: Optional[datetime] = None


class TareaCrear(SQLModel):
    """Lo que el cliente ENVÍA para crear una tarea (sin id ni fechas internas)."""

    titulo: str = Field(min_length=1, max_length=200)
    detalle: Optional[str] = None
    fecha: date = Field(default_factory=date.today)
    hora: Optional[time] = None
    prioridad: Prioridad = "media"
    categoria: str = "Trabajo"


class TareaActualizar(SQLModel):
    """Para editar: todos los campos son opcionales, solo se cambia lo que envíes."""

    titulo: Optional[str] = Field(default=None, min_length=1, max_length=200)
    detalle: Optional[str] = None
    fecha: Optional[date] = None
    hora: Optional[time] = None
    prioridad: Optional[Prioridad] = None
    categoria: Optional[str] = None
    hecha: Optional[bool] = None


# ===================== Etapa 3: usuarios =====================

class Usuario(SQLModel, table=True):
    """Tabla 'usuario'. Guarda el HASH de la contraseña, nunca la contraseña."""

    id: Optional[int] = Field(default=None, primary_key=True)
    usuario: str = Field(max_length=40, unique=True, index=True)
    nombre: str = Field(max_length=80)
    hash_contrasena: str
    creado_en: datetime = Field(default_factory=ahora_utc)


class UsuarioCrear(SQLModel):
    usuario: str = Field(min_length=3, max_length=40, regex=r"^[a-zA-Z0-9_.-]+$")
    nombre: str = Field(min_length=1, max_length=80)
    contrasena: str = Field(min_length=8, max_length=128)


class UsuarioPublico(SQLModel):
    """Lo que la API devuelve de un usuario (sin el hash)."""

    id: int
    usuario: str
    nombre: str


class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioPublico


# ===================== Bitácora: "lo que hice" =====================

class Nota(SQLModel, table=True):
    """Tabla 'nota': una entrada de la bitácora de un día."""

    id: Optional[int] = Field(default=None, primary_key=True)
    fecha: date = Field(default_factory=date.today, index=True)
    texto: str = Field(max_length=2000)
    animo: Optional[str] = None  # un emoji opcional: 😀 😐 😩 ...
    creada_en: datetime = Field(default_factory=ahora_utc)


class NotaCrear(SQLModel):
    fecha: date = Field(default_factory=date.today)
    texto: str = Field(min_length=1, max_length=2000)
    animo: Optional[str] = Field(default=None, max_length=8)


# ===================== Gastos =====================

class Gasto(SQLModel, table=True):
    """Tabla 'gasto': cada fila es un gasto con su monto en soles."""

    id: Optional[int] = Field(default=None, primary_key=True)
    fecha: date = Field(default_factory=date.today, index=True)
    descripcion: str = Field(max_length=200)
    monto: float
    categoria: str = "Otros"
    creado_en: datetime = Field(default_factory=ahora_utc)


class GastoCrear(SQLModel):
    fecha: date = Field(default_factory=date.today)
    descripcion: str = Field(min_length=1, max_length=200)
    monto: float = Field(gt=0, le=1_000_000)  # gt = mayor que 0
    categoria: str = Field(default="Otros", min_length=1, max_length=40)


class PresupuestoDatos(SQLModel):
    monto: float = Field(ge=0, le=1_000_000)  # 0 = sin presupuesto


# ===================== Ajustes: valores sueltos del sistema =====================

class Ajuste(SQLModel, table=True):
    """Tabla 'ajuste': pares clave -> valor (por ejemplo, el presupuesto mensual)."""

    clave: str = Field(primary_key=True, max_length=40)
    valor: str


# ===================== Cuenta =====================

class PerfilActualizar(SQLModel):
    nombre: str = Field(min_length=1, max_length=80)


class ClaveCambiar(SQLModel):
    actual: str = Field(min_length=1, max_length=128)
    nueva: str = Field(min_length=8, max_length=128)


# ===================== Recordatorios =====================

Repeticion = Literal["nunca", "diaria", "semanal", "mensual", "anual"]


class Recordatorio(SQLModel, table=True):
    """Tabla 'recordatorio': algo que debe avisarte en una fecha y hora."""

    id: Optional[int] = Field(default=None, primary_key=True)
    titulo: str = Field(max_length=200)
    nota: Optional[str] = None
    fecha: date = Field(index=True)
    hora: time
    repetir: str = "nunca"
    # El día del mes original: si eliges el 31, en febrero cae 28 pero en marzo vuelve a 31.
    dia_ancla: int = 1
    hecho: bool = False
    hecho_en: Optional[datetime] = None
    creado_en: datetime = Field(default_factory=ahora_utc)


class RecordatorioCrear(SQLModel):
    titulo: str = Field(min_length=1, max_length=200)
    nota: Optional[str] = Field(default=None, max_length=1000)
    fecha: date
    hora: time
    repetir: Repeticion = "nunca"


class RecordatorioActualizar(SQLModel):
    titulo: Optional[str] = Field(default=None, min_length=1, max_length=200)
    nota: Optional[str] = Field(default=None, max_length=1000)
    fecha: Optional[date] = None
    hora: Optional[time] = None
    repetir: Optional[Repeticion] = None


class Posponer(SQLModel):
    minutos: int = Field(ge=1, le=10_080)  # 10 080 minutos = una semana


# ===================== Fotos =====================

class Foto(SQLModel, table=True):
    """Tabla 'foto'. La imagen vive en data/fotos/; aquí solo van sus datos."""

    id: Optional[int] = Field(default=None, primary_key=True)
    archivo: str = Field(max_length=60)  # nombre generado por nosotros, nunca el del usuario
    nombre_original: str = Field(max_length=200)
    descripcion: Optional[str] = None
    album: Optional[str] = Field(default=None, index=True)
    favorita: bool = False
    ancho: int
    alto: int
    bytes: int
    fecha: datetime = Field(default_factory=ahora_utc, index=True)  # cuándo se tomó, si se sabe
    subida_en: datetime = Field(default_factory=ahora_utc)


class FotoActualizar(SQLModel):
    descripcion: Optional[str] = Field(default=None, max_length=500)
    album: Optional[str] = Field(default=None, max_length=60)
    favorita: Optional[bool] = None
