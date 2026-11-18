/**
 * Vista "Bitácora": lo que hiciste cada día, como un diario.
 *
 * Escribes una nota (con un emoji de ánimo opcional) y queda guardada en ese día.
 * Abajo, un mini calendario del mes marca con un punto los días que tienen notas.
 */
import { useCallback, useEffect, useState } from "react";

import { bitacora } from "../api.js";
import AvisoError from "../components/AvisoError.jsx";
import NavegadorFecha from "../components/NavegadorFecha.jsx";
import { aTexto, hoy, horaLocal, mesBonito, mesDe } from "../fechas.js";

const ANIMOS = ["😀", "🙂", "😐", "😩", "😡", "🤒"];
const DIAS_SEMANA = ["L", "M", "M", "J", "V", "S", "D"];

export default function Bitacora() {
  const [fecha, setFecha] = useState(hoy());
  const [notas, setNotas] = useState([]);
  const [diasConNotas, setDiasConNotas] = useState([]);
  const [texto, setTexto] = useState("");
  const [animo, setAnimo] = useState(null);
  const [error, setError] = useState(null);

  const mes = mesDe(fecha);

  const cargar = useCallback(async () => {
    try {
      const [n, d] = await Promise.all([bitacora.listar(fecha), bitacora.dias(mes)]);
      setNotas(n);
      setDiasConNotas(d);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [fecha, mes]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar(evento) {
    evento.preventDefault();
    if (!texto.trim()) return;
    try {
      await bitacora.crear({ fecha, texto: texto.trim(), animo });
      setTexto("");
      setAnimo(null);
    } catch (e) {
      setError(e.message);
    }
    cargar();
  }

  async function eliminar(nota) {
    if (!confirm("¿Eliminar esta nota?")) return;
    try {
      await bitacora.eliminar(nota.id);
    } catch (e) {
      setError(e.message);
    }
    cargar();
  }

  return (
    <>
      <NavegadorFecha fecha={fecha} onCambiar={setFecha} />
      {error && <AvisoError mensaje={error} onReintentar={cargar} />}

      <form className="tarjeta form-nota" onSubmit={guardar}>
        <textarea
          placeholder="¿Qué hiciste hoy? Logros, problemas resueltos, ideas..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={2000}
          rows={3}
          // Ctrl + Enter también guarda
          onKeyDown={(e) => e.key === "Enter" && e.ctrlKey && guardar(e)}
        />
        <div className="form-nota-pie">
          <div className="animos" role="radiogroup" aria-label="¿Cómo te sentiste?">
            {ANIMOS.map((a) => (
              <button
                type="button"
                key={a}
                className={`animo ${animo === a ? "activo" : ""}`}
                onClick={() => setAnimo(animo === a ? null : a)}
                aria-pressed={animo === a}
              >
                {a}
              </button>
            ))}
          </div>
          <button className="boton-principal" disabled={!texto.trim()}>
            Guardar nota
          </button>
        </div>
      </form>

      <section className="tarjeta">
        {notas.length === 0 ? (
          <p className="vacio">Sin notas este día. Escribe arriba lo que hiciste 📝</p>
        ) : (
          <ul className="lista notas">
            {notas.map((n) => (
              <li key={n.id} className="nota">
                <span className="nota-animo">{n.animo ?? "📝"}</span>
                <div className="tarea-cuerpo">
                  <div className="nota-texto">{n.texto}</div>
                  <div className="tarea-meta">
                    <span>escrita a las {horaLocal(n.creada_en)}</span>
                  </div>
                </div>
                <button className="boton-icono" onClick={() => eliminar(n)} title="Eliminar">
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="tarjeta">
        <h2 className="titulo-seccion">📅 {mesBonito(mes)}</h2>
        <MiniCalendario mes={mes} marcados={diasConNotas} elegido={fecha} onElegir={setFecha} />
      </section>
    </>
  );
}

/** Cuadrícula del mes. Los días con notas llevan un punto. */
function MiniCalendario({ mes, marcados, elegido, onElegir }) {
  const [a, m] = mes.split("-").map(Number);
  const totalDias = new Date(a, m, 0).getDate(); // día 0 del mes siguiente = último de este
  const huecos = (new Date(a, m - 1, 1).getDay() + 6) % 7; // para que la semana empiece en lunes
  const dias = Array.from({ length: totalDias }, (_, i) => aTexto(new Date(a, m - 1, i + 1)));

  return (
    <div className="calendario">
      {DIAS_SEMANA.map((d, i) => (
        <span key={i} className="cal-cabecera">
          {d}
        </span>
      ))}
      {Array.from({ length: huecos }, (_, i) => (
        <span key={`h${i}`} />
      ))}
      {dias.map((d) => (
        <button
          key={d}
          className={`cal-dia ${d === elegido ? "elegido" : ""} ${d === hoy() ? "es-hoy" : ""} ${
            marcados.includes(d) ? "marcado" : ""
          }`}
          onClick={() => onElegir(d)}
        >
          {Number(d.slice(8))}
        </button>
      ))}
    </div>
  );
}
