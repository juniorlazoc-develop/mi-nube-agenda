/**
 * Ayudas para fechas.
 *
 * El backend usa fechas como texto "AAAA-MM-DD". Las armamos a mano con la
 * fecha LOCAL, porque toISOString() usa UTC y de noche te daría el día siguiente.
 */
export function aTexto(fecha) {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${a}-${m}-${d}`;
}

export function hoy() {
  return aTexto(new Date());
}

export function sumarDias(texto, dias) {
  const [a, m, d] = texto.split("-").map(Number);
  return aTexto(new Date(a, m - 1, d + dias));
}

/** "2026-10-31" -> "sábado, 31 de octubre" */
export function fechaBonita(texto) {
  const [a, m, d] = texto.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Convierte una hora UTC del backend (ej: hecha_en) a tu hora local: "17:46" */
export function horaLocal(textoUTC) {
  return new Date(textoUTC).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

/** "2026-11-01" -> "2026-11" (el mes, como lo pide el backend) */
export function mesDe(texto) {
  return texto.slice(0, 7);
}

/** Suma (o resta) meses a "2026-11" -> "2026-12" */
export function sumarMeses(mes, cantidad) {
  const [a, m] = mes.split("-").map(Number);
  return aTexto(new Date(a, m - 1 + cantidad, 1)).slice(0, 7);
}

/** "2026-11" -> "noviembre de 2026" */
export function mesBonito(mes) {
  const [a, m] = mes.split("-").map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString("es", { month: "long", year: "numeric" });
}

/** 12.5 -> "S/ 12.50" (soles peruanos) */
export function soles(monto) {
  return "S/ " + monto.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Une la fecha y la hora de un recordatorio en un Date local. */
export function fechaHoraDe(recordatorio) {
  return new Date(`${recordatorio.fecha}T${recordatorio.hora}`);
}

/** "Hoy, 09:00" · "Mañana, 18:30" · "lun 20 nov, 09:00" */
export function cuandoEs(recordatorio) {
  const hora = recordatorio.hora.slice(0, 5);
  if (recordatorio.fecha === hoy()) return `Hoy, ${hora}`;
  if (recordatorio.fecha === sumarDias(hoy(), 1)) return `Mañana, ${hora}`;
  if (recordatorio.fecha === sumarDias(hoy(), -1)) return `Ayer, ${hora}`;
  const texto = new Date(`${recordatorio.fecha}T12:00`).toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${texto}, ${hora}`;
}

/** "2026-11-03T15:20:00" -> "3 nov 2026" */
export function fechaCorta(texto) {
  return new Date(texto).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

/** 1536000 -> "1.5 MB" */
export function tamanoLegible(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
