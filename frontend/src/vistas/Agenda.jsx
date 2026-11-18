/**
 * Vista "Agenda": los pendientes del día.
 *
 * Es el "dueño" de los datos de tareas: las pide a la API cuando cambia la fecha
 * o un filtro (useEffect) y se las pasa a los componentes hijos para que las muestren.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../api.js";
import AvisoError from "../components/AvisoError.jsx";
import FormTarea from "../components/FormTarea.jsx";
import NavegadorFecha from "../components/NavegadorFecha.jsx";
import TarjetaTarea from "../components/TarjetaTarea.jsx";
import { hoy } from "../fechas.js";

export default function Agenda() {
  const [fecha, setFecha] = useState(hoy());
  const [tareas, setTareas] = useState([]);
  const [atrasadas, setAtrasadas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState(""); // "" = todas
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const buscando = busqueda.trim().length > 0;
  const ultimaPeticion = useRef(0); // para ignorar respuestas viejas al escribir rápido

  // Pide a la API las tareas del día (o el resultado de la búsqueda) y las atrasadas.
  const cargar = useCallback(async () => {
    const filtros = filtroCategoria ? { categoria: filtroCategoria } : {};
    const numero = ++ultimaPeticion.current;
    try {
      const [delDia, viejas, cats] = await Promise.all([
        // Al buscar, buscamos en TODOS los días; si no, solo en el día elegido.
        api.listar(buscando ? { ...filtros, q: busqueda.trim() } : { ...filtros, fecha }),
        api.listar({ atrasadas: true }),
        api.categorias(),
      ]);
      if (numero !== ultimaPeticion.current) return; // llegó otra más nueva: esta ya no sirve
      setTareas(delDia);
      setAtrasadas(viejas);
      setCategorias(cats);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [fecha, filtroCategoria, busqueda, buscando]);

  // Se ejecuta al abrir la vista y cada vez que cambia la fecha o un filtro.
  // El setTimeout espera 300 ms a que dejes de escribir antes de buscar.
  useEffect(() => {
    const espera = setTimeout(cargar, buscando ? 300 : 0);
    return () => clearTimeout(espera);
  }, [cargar, buscando]);

  // Envuelve cada acción: si falla, muestra el error; siempre recarga la lista.
  async function accion(promesa) {
    try {
      await promesa;
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      await cargar();
    }
  }

  const crear = (datos) => accion(api.crear({ ...datos, fecha }));
  const alternar = (t) => accion(api.actualizar(t.id, { hecha: !t.hecha }));
  const editar = (t, cambios) => accion(api.actualizar(t.id, cambios));
  const moverAHoy = (t) => accion(api.actualizar(t.id, { fecha: hoy() }));
  const eliminar = (t) => {
    if (confirm(`¿Eliminar "${t.titulo}"?`)) accion(api.eliminar(t.id));
  };

  const hechas = tareas.filter((t) => t.hecha).length;
  const porcentaje = tareas.length ? Math.round((hechas / tareas.length) * 100) : 0;
  const props = { onAlternar: alternar, onEliminar: eliminar, onEditar: editar };

  return (
    <>
      <NavegadorFecha fecha={fecha} onCambiar={setFecha} />

      {error && <AvisoError mensaje={error} onReintentar={cargar} />}

      <FormTarea onCrear={crear} categorias={categorias} />

      <section className="tarjeta">
        <div className="filtros">
          <input
            type="search"
            className="buscador"
            placeholder="🔎 Buscar en todos los días..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <div className="chips-filtro">
            {["", ...categorias].map((c) => (
              <button
                key={c || "todas"}
                className={`chip-filtro ${filtroCategoria === c ? "activo" : ""}`}
                onClick={() => setFiltroCategoria(c)}
              >
                {c || "Todas"}
              </button>
            ))}
          </div>
        </div>

        {buscando ? (
          <div className="resumen">
            <span>
              <strong>{tareas.length}</strong> resultado{tareas.length === 1 ? "" : "s"} para “{busqueda.trim()}”
            </span>
          </div>
        ) : (
          <>
            <div className="resumen">
              <span>
                <strong>{tareas.length - hechas}</strong> pendientes · <strong>{hechas}</strong> hechas
              </span>
              <span>{porcentaje}%</span>
            </div>
            <div className="barra">
              <div className="barra-relleno" style={{ width: `${porcentaje}%` }} />
            </div>
          </>
        )}

        {cargando ? (
          <p className="vacio">Cargando...</p>
        ) : tareas.length === 0 ? (
          <p className="vacio">
            {buscando || filtroCategoria
              ? "Nada coincide con el filtro."
              : "No hay pendientes para este día. ¡Agrega uno arriba! ✨"}
          </p>
        ) : (
          <ul className="lista">
            {tareas.map((t) => (
              <TarjetaTarea key={t.id} tarea={t} mostrarFecha={buscando} {...props} />
            ))}
          </ul>
        )}
        <p className="pista">Doble clic en un pendiente (o ✏️) para editarlo.</p>
      </section>

      {atrasadas.length > 0 && (
        <section className="tarjeta atrasadas">
          <h2>⏰ Atrasadas ({atrasadas.length})</h2>
          <ul className="lista">
            {atrasadas.map((t) => (
              <TarjetaTarea key={t.id} tarea={t} mostrarFecha onMoverAHoy={moverAHoy} {...props} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
