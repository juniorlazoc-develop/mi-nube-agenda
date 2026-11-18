/**
 * Vista "Recordatorios": cosas que deben avisarte en una fecha y hora.
 * Pueden repetirse cada día, semana, mes o año.
 *
 * El aviso en sí lo da components/AvisosRecordatorio.jsx. Cuando algo cambia aquí, se
 * lanza un evento para que ese vigilante vuelva a mirar sin esperar 30 segundos.
 */
import { useCallback, useEffect, useState } from "react";

import { avisarCambioRecordatorios, recordatorios, RECORDATORIOS_CAMBIARON } from "../api.js";
import AvisoError from "../components/AvisoError.jsx";
import { aTexto, cuandoEs, fechaHoraDe, hoy, sumarDias } from "../fechas.js";

const REPETICIONES = {
  nunca: "Una sola vez",
  diaria: "Cada día",
  semanal: "Cada semana",
  mensual: "Cada mes",
  anual: "Cada año",
};

const horaActualMas = (minutos) => {
  const d = new Date(Date.now() + minutos * 60_000);
  return { fecha: aTexto(d), hora: d.toTimeString().slice(0, 5) };
};

// Atajos para no tener que elegir fecha y hora a mano.
const ATAJOS = [
  { texto: "En 1 hora", valor: () => horaActualMas(60) },
  { texto: "Esta noche", valor: () => ({ fecha: hoy(), hora: "20:00" }) },
  { texto: "Mañana 9:00", valor: () => ({ fecha: sumarDias(hoy(), 1), hora: "09:00" }) },
  { texto: "En una semana", valor: () => ({ fecha: sumarDias(hoy(), 7), hora: "09:00" }) },
];

const FORMULARIO_VACIO = () => ({ titulo: "", nota: "", repetir: "nunca", ...horaActualMas(60) });

/** Separa la lista en los grupos que se muestran en pantalla. */
function agrupar(lista) {
  const ahora = new Date();
  const manana = sumarDias(hoy(), 1);
  const grupos = { vencidos: [], hoy: [], manana: [], despues: [] };
  for (const r of lista) {
    if (fechaHoraDe(r) <= ahora) grupos.vencidos.push(r);
    else if (r.fecha === hoy()) grupos.hoy.push(r);
    else if (r.fecha === manana) grupos.manana.push(r);
    else grupos.despues.push(r);
  }
  return grupos;
}

export default function Recordatorios() {
  const [lista, setLista] = useState([]);
  const [hechos, setHechos] = useState([]);
  const [verHechos, setVerHechos] = useState(false);
  const [form, setForm] = useState(FORMULARIO_VACIO);
  const [editando, setEditando] = useState(null); // id del que se edita
  const [error, setError] = useState(null);
  const [permiso, setPermiso] = useState("Notification" in window ? Notification.permission : "no-disponible");

  const cargar = useCallback(async () => {
    try {
      const [pendientes, terminados] = await Promise.all([recordatorios.listar(), recordatorios.listar("hechos")]);
      setLista(pendientes);
      setHechos(terminados);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    cargar();
    window.addEventListener(RECORDATORIOS_CAMBIARON, cargar);
    return () => window.removeEventListener(RECORDATORIOS_CAMBIARON, cargar);
  }, [cargar]);

  async function accion(promesa) {
    try {
      await promesa;
      avisarCambioRecordatorios(); // recarga esta lista y al vigilante
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  async function guardar(evento) {
    evento.preventDefault();
    const datos = { ...form, titulo: form.titulo.trim(), nota: form.nota.trim() || null };
    if (!datos.titulo) return;
    const promesa = editando ? recordatorios.actualizar(editando, datos) : recordatorios.crear(datos);
    if (await accion(promesa)) cancelar();
  }

  function editar(r) {
    setEditando(r.id);
    setForm({ titulo: r.titulo, nota: r.nota ?? "", repetir: r.repetir, fecha: r.fecha, hora: r.hora.slice(0, 5) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelar() {
    setEditando(null);
    setForm(FORMULARIO_VACIO());
  }

  async function pedirPermiso() {
    setPermiso(await Notification.requestPermission());
  }

  const eliminar = (r) => {
    if (confirm(`¿Eliminar "${r.titulo}"?`)) accion(recordatorios.eliminar(r.id));
  };

  const grupos = agrupar(lista);
  const secciones = [
    ["Vencidos", grupos.vencidos, "vencidos"],
    ["Hoy", grupos.hoy],
    ["Mañana", grupos.manana],
    ["Más adelante", grupos.despues],
  ].filter(([, items]) => items.length > 0);

  return (
    <>
      {error && <AvisoError mensaje={error} onReintentar={cargar} />}

      {permiso === "default" && (
        <div className="franja">
          <span>Activa las notificaciones para que te avise aunque estés en otra pestaña.</span>
          <button className="boton-chico primario" onClick={pedirPermiso}>
            Activar
          </button>
        </div>
      )}
      {permiso === "denied" && (
        <div className="franja">
          <span>Las notificaciones están bloqueadas en este navegador. Puedes activarlas desde el candado de la barra de direcciones.</span>
        </div>
      )}

      <form className="tarjeta form-tarea" onSubmit={guardar}>
        <input
          className="form-titulo"
          placeholder="¿Qué debo recordarte?"
          value={form.titulo}
          onChange={cambiar("titulo")}
          maxLength={200}
          aria-label="Qué debo recordarte"
        />
        <div className="chips-filtro">
          {ATAJOS.map((a) => (
            <button
              key={a.texto}
              type="button"
              className="chip-filtro"
              onClick={() => setForm({ ...form, ...a.valor() })}
            >
              {a.texto}
            </button>
          ))}
        </div>
        <div className="form-fila">
          <label>
            Fecha
            <input type="date" value={form.fecha} onChange={cambiar("fecha")} required />
          </label>
          <label>
            Hora
            <input type="time" value={form.hora} onChange={cambiar("hora")} required />
          </label>
          <label>
            Repetir
            <select value={form.repetir} onChange={cambiar("repetir")}>
              {Object.entries(REPETICIONES).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </label>
        </div>
        <input placeholder="Nota (opcional)" value={form.nota} onChange={cambiar("nota")} maxLength={1000} aria-label="Nota" />
        <div className="editor-botones">
          {editando && (
            <button type="button" className="boton-chico" onClick={cancelar}>
              Cancelar
            </button>
          )}
          <button className="boton-principal" disabled={!form.titulo.trim() || !form.fecha || !form.hora}>
            {editando ? "Guardar cambios" : "+ Crear recordatorio"}
          </button>
        </div>
      </form>

      {secciones.length === 0 ? (
        <section className="tarjeta">
          <p className="vacio">No tienes recordatorios pendientes.</p>
        </section>
      ) : (
        secciones.map(([titulo, items, tono]) => (
          <section key={titulo} className={`tarjeta ${tono ?? ""}`}>
            <h2 className="titulo-seccion">
              {titulo} <small>({items.length})</small>
            </h2>
            <ul className="lista">
              {items.map((r) => (
                <li key={r.id} className="recordatorio">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => accion(recordatorios.completar(r.id))}
                    aria-label={`Completar ${r.titulo}`}
                  />
                  <div className="tarea-cuerpo">
                    <div className="tarea-titulo">{r.titulo}</div>
                    {r.nota && <div className="tarea-detalle">{r.nota}</div>}
                    <div className="tarea-meta">
                      <time>{cuandoEs(r)}</time>
                      {r.repetir !== "nunca" && <span className="chip">{REPETICIONES[r.repetir]}</span>}
                    </div>
                  </div>
                  <div className="tarea-acciones">
                    <button className="boton-chico" onClick={() => accion(recordatorios.posponer(r.id, 60))} title="Posponer una hora">
                      +1 h
                    </button>
                    <button className="boton-icono" onClick={() => editar(r)} aria-label={`Editar ${r.titulo}`}>
                      ✏️
                    </button>
                    <button className="boton-icono" onClick={() => eliminar(r)} aria-label={`Eliminar ${r.titulo}`}>
                      🗑
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {hechos.length > 0 && (
        <section className="tarjeta">
          <button className="enlace" onClick={() => setVerHechos(!verHechos)} aria-expanded={verHechos}>
            {verHechos ? "Ocultar" : "Ver"} los ya hechos ({hechos.length})
          </button>
          {verHechos && (
            <ul className="lista">
              {hechos.map((r) => (
                <li key={r.id} className="recordatorio hecho">
                  <div className="tarea-cuerpo">
                    <div className="tarea-titulo">{r.titulo}</div>
                    <div className="tarea-meta">
                      <time>{cuandoEs(r)}</time>
                    </div>
                  </div>
                  <button className="boton-icono" onClick={() => eliminar(r)} aria-label={`Eliminar ${r.titulo}`}>
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
