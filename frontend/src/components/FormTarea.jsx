/**
 * Formulario para crear un pendiente.
 *
 * Cada campo es un "estado" (useState). Al enviar, le pasamos los datos
 * al componente padre (App) con la función onCrear, y limpiamos el formulario.
 */
import { useState } from "react";

const CATEGORIAS = ["Trabajo", "Personal", "Casa", "Salud", "Estudio"];

export default function FormTarea({ onCrear, categorias = [] }) {
  const [titulo, setTitulo] = useState("");
  const [hora, setHora] = useState("");
  const [prioridad, setPrioridad] = useState("media");
  const [categoria, setCategoria] = useState("Trabajo");
  const [detalle, setDetalle] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault(); // evita que el navegador recargue la página
    if (!titulo.trim()) return;

    setEnviando(true);
    const ok = await onCrear({
      titulo: titulo.trim(),
      hora: hora || null, // "" no es una hora válida para la API
      prioridad,
      categoria: categoria.trim() || "Trabajo",
      detalle: detalle.trim() || null,
    });
    setEnviando(false);

    if (ok) {
      setTitulo("");
      setHora("");
      setDetalle("");
      setPrioridad("media");
    }
  }

  return (
    <form className="form-tarea tarjeta" onSubmit={enviar}>
      <input
        className="form-titulo"
        placeholder="¿Qué tienes pendiente?"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        maxLength={200}
        autoFocus
      />
      <div className="form-fila">
        <label>
          Hora
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </label>
        <label>
          Prioridad
          <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
            <option value="alta">🔴 Alta</option>
            <option value="media">🟡 Media</option>
            <option value="baja">🟢 Baja</option>
          </select>
        </label>
        <label>
          Categoría
          <input
            list="categorias"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          />
          <datalist id="categorias">
            {/* las de siempre + las que ya inventaste */}
            {[...new Set([...CATEGORIAS, ...categorias])].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
      </div>
      <input
        placeholder="Detalle (opcional)"
        value={detalle}
        onChange={(e) => setDetalle(e.target.value)}
      />
      <button className="boton-principal" disabled={enviando || !titulo.trim()}>
        {enviando ? "Guardando..." : "+ Agregar"}
      </button>
    </form>
  );
}
