/**
 * Funciones para hablar con el backend (FastAPI).
 *
 * Todo pasa por "pedir()", que hace el fetch, agrega el token del login,
 * revisa el código HTTP y convierte la respuesta JSON en objetos de JavaScript.
 */

// ===== Token del login =====
// Se guarda en localStorage (memoria del navegador) para que no tengas que
// entrar cada vez que recargas. Dura 7 días; luego el backend responde 401.
const CLAVE_TOKEN = "mi-nube-token";

export const sesion = {
  token: () => localStorage.getItem(CLAVE_TOKEN),
  guardar: (token) => localStorage.setItem(CLAVE_TOKEN, token),
  cerrar: () => localStorage.removeItem(CLAVE_TOKEN),
};

// App se suscribe aquí para volver al login si el token deja de servir.
let alExpirar = () => {};
export function cuandoExpire(funcion) {
  alExpirar = funcion;
}

async function pedir(url, opciones = {}) {
  // Con archivos (FormData) el navegador pone él mismo el tipo y sus separadores.
  const esArchivo = opciones.body instanceof FormData;
  const cabeceras = { ...(esArchivo ? {} : { "Content-Type": "application/json" }), ...opciones.headers };
  const token = sesion.token();
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  let respuesta;
  try {
    respuesta = await fetch(url, { ...opciones, headers: cabeceras });
  } catch {
    throw new Error("No hay conexión con el backend.");
  }

  if (!respuesta.ok) {
    // 502/504 = el proxy de Vite no encontró a FastAPI (está apagado).
    if (respuesta.status === 502 || respuesta.status === 504) {
      throw new Error("No hay conexión con el backend.");
    }
    let detalle = `Error ${respuesta.status}`;
    try {
      const cuerpo = await respuesta.json();
      if (typeof cuerpo.detail === "string") detalle = cuerpo.detail;
      // 422: FastAPI manda una lista de errores; mostramos el primero.
      else if (Array.isArray(cuerpo.detail)) detalle = cuerpo.detail[0]?.msg ?? detalle;
    } catch {
      // la respuesta no era JSON: nos quedamos con "Error XXX"
    }
    // 401 en una ruta protegida = token vencido o inválido -> de vuelta al login.
    if (respuesta.status === 401 && token && !url.startsWith("/api/auth/login")) {
      sesion.cerrar();
      alExpirar();
    }
    throw new Error(detalle);
  }

  if (opciones.comoArchivo) return respuesta.blob();
  // 204 = "No Content" (por ejemplo al eliminar): no hay JSON que leer.
  return respuesta.status === 204 ? null : respuesta.json();
}

/** Baja un archivo protegido por el login y abre la ventana de "guardar". */
export async function descargar(url, nombre) {
  const blob = await pedir(url, { comoArchivo: true });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

const json = (metodo, datos) => ({ method: metodo, body: JSON.stringify(datos) });

export const auth = {
  estado: () => pedir("/api/auth/estado"),
  yo: () => pedir("/api/auth/yo"),
  actualizar: (datos) => pedir("/api/auth/yo", json("PATCH", datos)),
  cambiarClave: (datos) => pedir("/api/auth/clave", json("POST", datos)),
  registro: (datos) => pedir("/api/auth/registro", json("POST", datos)),
  // El login va como formulario (estándar OAuth2), no como JSON.
  login: (usuario, contrasena) =>
    pedir("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: usuario, password: contrasena }),
    }),
};

const TAREAS = "/api/tareas";
export const api = {
  listar: (filtros) => pedir(`${TAREAS}?${new URLSearchParams(filtros)}`),
  categorias: () => pedir(`${TAREAS}/categorias`),
  crear: (datos) => pedir(TAREAS, json("POST", datos)),
  actualizar: (id, cambios) => pedir(`${TAREAS}/${id}`, json("PATCH", cambios)),
  eliminar: (id) => pedir(`${TAREAS}/${id}`, { method: "DELETE" }),
};

export const bitacora = {
  listar: (fecha) => pedir(`/api/bitacora?fecha=${fecha}`),
  dias: (mes) => pedir(`/api/bitacora/dias?mes=${mes}`),
  crear: (datos) => pedir("/api/bitacora", json("POST", datos)),
  eliminar: (id) => pedir(`/api/bitacora/${id}`, { method: "DELETE" }),
};

export const gastos = {
  listar: (mes) => pedir(`/api/gastos?mes=${mes}`),
  resumen: (mes) => pedir(`/api/gastos/resumen?mes=${mes}`),
  tendencia: () => pedir("/api/gastos/tendencia"),
  presupuesto: (monto) => pedir("/api/gastos/presupuesto", json("PUT", { monto })),
  crear: (datos) => pedir("/api/gastos", json("POST", datos)),
  eliminar: (id) => pedir(`/api/gastos/${id}`, { method: "DELETE" }),
};

export const inicio = {
  resumen: () => pedir("/api/inicio"),
};

// Aviso interno: "cambió algún recordatorio". Lo escuchan las partes que muestran la lista.
export const RECORDATORIOS_CAMBIARON = "mi-nube:recordatorios";
export const avisarCambioRecordatorios = () => window.dispatchEvent(new Event(RECORDATORIOS_CAMBIARON));

const RECORDATORIOS = "/api/recordatorios";
export const recordatorios = {
  listar: (estado = "pendientes") => pedir(`${RECORDATORIOS}?estado=${estado}`),
  crear: (datos) => pedir(RECORDATORIOS, json("POST", datos)),
  actualizar: (id, cambios) => pedir(`${RECORDATORIOS}/${id}`, json("PATCH", cambios)),
  completar: (id) => pedir(`${RECORDATORIOS}/${id}/completar`, { method: "POST" }),
  posponer: (id, minutos) => pedir(`${RECORDATORIOS}/${id}/posponer`, json("POST", { minutos })),
  eliminar: (id) => pedir(`${RECORDATORIOS}/${id}`, { method: "DELETE" }),
};

const FOTOS = "/api/fotos";
export const fotos = {
  listar: (filtros) => pedir(`${FOTOS}?${new URLSearchParams(filtros)}`),
  albumes: () => pedir(`${FOTOS}/albumes`),
  subir: (archivo, album) => {
    const formulario = new FormData();
    formulario.append("archivo", archivo);
    if (album) formulario.append("album", album);
    return pedir(FOTOS, { method: "POST", body: formulario });
  },
  archivo: (id, tipo) => pedir(`${FOTOS}/${id}/${tipo}`, { comoArchivo: true }),
  actualizar: (id, cambios) => pedir(`${FOTOS}/${id}`, json("PATCH", cambios)),
  eliminar: (id) => pedir(`${FOTOS}/${id}`, { method: "DELETE" }),
};
