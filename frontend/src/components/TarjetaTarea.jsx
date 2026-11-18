/**
 * Una fila de la lista: un pendiente con su casilla, datos y botones.
 *
 * Tiene dos "modos": ver y editar (estado "editando").
 * No guarda nada en la API por sí misma: avisa al padre (Agenda) con
 * onAlternar, onEditar, onEliminar y onMoverAHoy, y Agenda habla con la API.
 */
import { useState } from "react";

import { fechaBonita, horaLocal } from "../fechas.js";

export default function TarjetaTarea({ tarea, mostrarFecha, onAlternar, onEditar, onEliminar, onMoverAHoy }) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <li className={`tarea prioridad-${tarea.prioridad}`}>
        <EditorTarea
          tarea={tarea}
          onGuardar={async (cambios) => {
            if (await onEditar(tarea, cambios)) setEditando(false);
          }}
          onCancelar={() => setEditando(false)}
        />
      </li>
    );
  }

  return (
    <li className={`tarea prioridad-${tarea.prioridad} ${tarea.hecha ? "hecha" : ""}`}>
      <input
        type="checkbox"
        checked={tarea.hecha}
        onChange={() => onAlternar(tarea)}
        aria-label={tarea.hecha ? "Marcar como pendiente" : "Marcar como hecha"}
      />

      <div className="tarea-cuerpo" onDoubleClick={() => setEditando(true)}>
        <div className="tarea-titulo">
          {tarea.hora && <span className="tarea-hora">{tarea.hora.slice(0, 5)}</span>}
          {tarea.titulo}
        </div>
        {tarea.detalle && <div className="tarea-detalle">{tarea.detalle}</div>}
        <div className="tarea-meta">
          <span className="chip">{tarea.categoria}</span>
          {mostrarFecha && <span>de {fechaBonita(tarea.fecha)}</span>}
          {tarea.hecha_en && <span>✔ hecha a las {horaLocal(tarea.hecha_en)}</span>}
        </div>
      </div>

      <div className="tarea-acciones">
        {onMoverAHoy && (
          <button className="boton-chico" onClick={() => onMoverAHoy(tarea)} title="Pasar a hoy">
            → Hoy
          </button>
        )}
        <button className="boton-icono" onClick={() => setEditando(true)} title="Editar">
          ✏️
        </button>
        <button className="boton-icono" onClick={() => onEliminar(tarea)} title="Eliminar">
          🗑
        </button>
      </div>
    </li>
  );
}

/** Formulario chiquito dentro de la fila. Solo envía a la API los campos que cambiaron. */
function EditorTarea({ tarea, onGuardar, onCancelar }) {
  const [titulo, setTitulo] = useState(tarea.titulo);
  const [detalle, setDetalle] = useState(tarea.detalle ?? "");
  const [hora, setHora] = useState(tarea.hora?.slice(0, 5) ?? "");
  const [prioridad, setPrioridad] = useState(tarea.prioridad);
  const [categoria, setCategoria] = useState(tarea.categoria);
  const [fecha, setFecha] = useState(tarea.fecha);

  function guardar(evento) {
    evento.preventDefault();
    if (!titulo.trim()) return;
    const nuevos = {
      titulo: titulo.trim(),
      detalle: detalle.trim() || null,
      hora: hora || null,
      prioridad,
      categoria: categoria.trim() || "Trabajo",
      fecha,
    };
    const antes = { ...tarea, hora: tarea.hora?.slice(0, 5) ?? null };
    const cambios = Object.fromEntries(Object.entries(nuevos).filter(([k, v]) => v !== antes[k]));
    if (Object.keys(cambios).length === 0) return onCancelar();
    onGuardar(cambios);
  }

  return (
    <form
      className="editor-tarea"
      onSubmit={guardar}
      onKeyDown={(e) => e.key === "Escape" && onCancelar()}
    >
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} autoFocus />
      <input placeholder="Detalle (opcional)" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
      <div className="editor-fila">
        <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
          <option value="alta">🔴 Alta</option>
          <option value="media">🟡 Media</option>
          <option value="baja">🟢 Baja</option>
        </select>
        <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Categoría" />
      </div>
      <div className="editor-botones">
        <button type="button" className="boton-chico" onClick={onCancelar}>
          Cancelar
        </button>
        <button className="boton-principal" disabled={!titulo.trim()}>
          Guardar
        </button>
      </div>
    </form>
  );
}
