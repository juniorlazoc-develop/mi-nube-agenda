/**
 * Vista "Gastos": registra en qué gastas y mira el total del mes.
 *
 * El gráfico de barras no usa ninguna librería: cada barra es un <div> cuyo
 * ancho es el porcentaje de esa categoría respecto a la más grande.
 * También muestra cuánto queda del presupuesto y la tendencia de los últimos 6 meses.
 */
import { useCallback, useEffect, useState } from "react";

import { descargar, gastos } from "../api.js";
import AvisoError from "../components/AvisoError.jsx";
import { fechaBonita, hoy, mesBonito, mesDe, soles, sumarMeses } from "../fechas.js";

const CATEGORIAS = ["Comida", "Transporte", "Casa", "Servicios", "Salud", "Ocio", "Estudio", "Otros"];
const ICONOS = {
  Comida: "🍽️", Transporte: "🚌", Casa: "🏠", Servicios: "💡",
  Salud: "💊", Ocio: "🎉", Estudio: "📚", Otros: "📦",
};
const icono = (c) => ICONOS[c] ?? "🏷️";

export default function Gastos() {
  const [mes, setMes] = useState(mesDe(hoy()));
  const [lista, setLista] = useState([]);
  const [resumen, setResumen] = useState({ total: 0, por_categoria: [], mes_anterior: 0, presupuesto: 0 });
  const [tendencia, setTendencia] = useState([]);
  const [editandoTope, setEditandoTope] = useState(false);
  const [tope, setTope] = useState("");
  const [error, setError] = useState(null);

  // Formulario
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("Comida");
  const [fecha, setFecha] = useState(hoy());

  const cargar = useCallback(async () => {
    try {
      const [l, r, t] = await Promise.all([gastos.listar(mes), gastos.resumen(mes), gastos.tendencia()]);
      setLista(l);
      setResumen(r);
      setTendencia(t);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [mes]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const montoNumero = Number(monto.replace(",", ".")); // acepta 12,50 y 12.50
  const valido = descripcion.trim() && montoNumero > 0;

  async function guardar(evento) {
    evento.preventDefault();
    if (!valido) return;
    try {
      await gastos.crear({ descripcion: descripcion.trim(), monto: montoNumero, categoria, fecha });
      setDescripcion("");
      setMonto("");
      setMes(mesDe(fecha)); // salta al mes del gasto para que lo veas
    } catch (e) {
      setError(e.message);
    }
    cargar();
  }

  async function eliminar(g) {
    if (!confirm(`¿Eliminar "${g.descripcion}" (${soles(g.monto)})?`)) return;
    try {
      await gastos.eliminar(g.id);
    } catch (e) {
      setError(e.message);
    }
    cargar();
  }

  async function guardarTope(evento) {
    evento.preventDefault();
    try {
      await gastos.presupuesto(Number(tope.replace(",", ".")) || 0);
      setEditandoTope(false);
    } catch (e) {
      setError(e.message);
    }
    cargar();
  }

  async function exportar() {
    try {
      await descargar(`/api/gastos/csv?mes=${mes}`, `gastos-${mes}.csv`);
    } catch (e) {
      setError(e.message);
    }
  }

  const mayor = resumen.por_categoria[0]?.total ?? 0;
  const esMesActual = mes === mesDe(hoy());
  const usado = resumen.presupuesto ? (resumen.total / resumen.presupuesto) * 100 : 0;
  const queda = resumen.presupuesto - resumen.total;
  const diferencia = resumen.total - resumen.mes_anterior;
  const mayorMes = Math.max(...tendencia.map((t) => t.total), 1);

  return (
    <>
      <nav className="navegador-fecha">
        <button className="boton-icono" onClick={() => setMes(sumarMeses(mes, -1))} title="Mes anterior">
          ◀
        </button>
        <div className="fecha-actual">
          <strong>{mesBonito(mes)}</strong>
        </div>
        <button className="boton-icono" onClick={() => setMes(sumarMeses(mes, 1))} title="Mes siguiente">
          ▶
        </button>
        {!esMesActual && (
          <button className="boton-chico" onClick={() => setMes(mesDe(hoy()))}>
            Este mes
          </button>
        )}
      </nav>

      {error && <AvisoError mensaje={error} onReintentar={cargar} />}

      <form className="tarjeta form-gasto" onSubmit={guardar}>
        <input
          className="form-titulo"
          placeholder="¿En qué gastaste?"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          maxLength={200}
        />
        <div className="form-fila">
          <label>
            Monto (S/)
            <input inputMode="decimal" placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value)} />
          </label>
          <label>
            Categoría
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {icono(c)} {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha
            <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
          </label>
        </div>
        <button className="boton-principal" disabled={!valido}>
          + Registrar gasto
        </button>
      </form>

      <section className="tarjeta">
        <div className="total-mes">
          <span>Total del mes</span>
          <strong>{soles(resumen.total)}</strong>
        </div>
        {resumen.mes_anterior > 0 && (
          <p className="comparacion">
            {soles(Math.abs(diferencia))} {diferencia > 0 ? "más" : "menos"} que el mes anterior
          </p>
        )}

        {resumen.presupuesto > 0 && !editandoTope && (
          <div className="presupuesto">
            <div className="barra">
              <div className={`barra-relleno ${usado >= 100 ? "excedida" : ""}`} style={{ width: `${Math.min(usado, 100)}%` }} />
            </div>
            <span>
              {queda >= 0 ? `Te quedan ${soles(queda)}` : `Te pasaste por ${soles(-queda)}`} de {soles(resumen.presupuesto)}
            </span>
          </div>
        )}
        {editandoTope ? (
          <form className="fila-tope" onSubmit={guardarTope}>
            <input
              inputMode="decimal"
              placeholder="Presupuesto mensual (S/)"
              value={tope}
              onChange={(e) => setTope(e.target.value)}
              aria-label="Presupuesto mensual en soles"
              autoFocus
            />
            <button className="boton-chico primario">Guardar</button>
            <button type="button" className="boton-chico" onClick={() => setEditandoTope(false)}>
              Cancelar
            </button>
          </form>
        ) : (
          <div className="acciones-gastos">
            <button
              className="enlace"
              onClick={() => {
                setTope(resumen.presupuesto ? String(resumen.presupuesto) : "");
                setEditandoTope(true);
              }}
            >
              {resumen.presupuesto ? "Cambiar presupuesto" : "Fijar presupuesto mensual"}
            </button>
            {lista.length > 0 && (
              <button className="enlace" onClick={exportar}>
                Descargar para Excel
              </button>
            )}
          </div>
        )}

        {resumen.por_categoria.length > 0 && (
          <ul className="grafico">
            {resumen.por_categoria.map((c) => (
              <li key={c.categoria}>
                <span className="grafico-etiqueta">
                  {icono(c.categoria)} {c.categoria}
                </span>
                <div className="grafico-pista">
                  <div className="grafico-barra" style={{ width: `${(c.total / mayor) * 100}%` }} />
                </div>
                <span className="grafico-valor">
                  {soles(c.total)}
                  <small> {Math.round((c.total / resumen.total) * 100)}%</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {tendencia.some((t) => t.total > 0) && (
        <section className="tarjeta">
          <h2 className="titulo-seccion">Últimos 6 meses</h2>
          <div className="tendencia">
            {tendencia.map((t) => (
              <button
                key={t.mes}
                className={t.mes === mes ? "elegido" : ""}
                onClick={() => setMes(t.mes)}
                title={`${mesBonito(t.mes)}: ${soles(t.total)}`}
              >
                <small>{t.total > 0 ? Math.round(t.total) : ""}</small>
                <span style={{ height: `${Math.max((t.total / mayorMes) * 100, 2)}%` }} />
                <em>{new Date(`${t.mes}-15T12:00`).toLocaleDateString("es", { month: "short" })}</em>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="tarjeta">
        {lista.length === 0 ? (
          <p className="vacio">No hay gastos en {mesBonito(mes)} 💸</p>
        ) : (
          <ul className="lista">
            {lista.map((g) => (
              <li key={g.id} className="gasto">
                <span className="gasto-icono">{icono(g.categoria)}</span>
                <div className="tarea-cuerpo">
                  <div className="tarea-titulo">{g.descripcion}</div>
                  <div className="tarea-meta">
                    <span className="chip">{g.categoria}</span>
                    <span>{fechaBonita(g.fecha)}</span>
                  </div>
                </div>
                <strong className="gasto-monto">{soles(g.monto)}</strong>
                <button className="boton-icono" onClick={() => eliminar(g)} title="Eliminar">
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
