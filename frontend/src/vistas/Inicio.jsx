/**
 * Vista "Inicio": lo más importante de tu día en una sola pantalla.
 * Pide todo junto a /api/inicio y cada tarjeta lleva a su sección.
 */
import { useCallback, useEffect, useState } from "react";

import { api, inicio } from "../api.js";
import AvisoError from "../components/AvisoError.jsx";
import ImagenPrivada from "../components/ImagenPrivada.jsx";
import { aTexto, cuandoEs, fechaBonita, fechaHoraDe, hoy, soles } from "../fechas.js";

// Refranes japoneses (kotowaza). Cada día toca uno distinto.
const REFRANES = [
  ["七転び八起き", "Cae siete veces, levántate ocho."],
  ["千里の道も一歩から", "Un viaje de mil leguas empieza con un paso."],
  ["継続は力なり", "La constancia es fuerza."],
  ["石の上にも三年", "Hasta una piedra se calienta si te sientas tres años en ella."],
  ["一期一会", "Cada encuentro ocurre una sola vez en la vida."],
  ["塵も積もれば山となる", "Hasta el polvo, acumulado, forma una montaña."],
  ["雨降って地固まる", "Después de la lluvia, la tierra se afirma."],
  ["明日は明日の風が吹く", "Mañana soplará el viento de mañana."],
];

function saludo() {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos días";
  return hora < 19 ? "Buenas tardes" : "Buenas noches";
}

/** Anillo de progreso: un círculo SVG cuyo trazo se llena según el porcentaje. */
function Anillo({ porcentaje }) {
  const largo = 2 * Math.PI * 26;
  return (
    <svg className="anillo" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="26" className="anillo-fondo" />
      <circle
        cx="32"
        cy="32"
        r="26"
        className="anillo-trazo"
        strokeDasharray={largo}
        strokeDashoffset={largo * (1 - porcentaje / 100)}
      />
    </svg>
  );
}

export default function Inicio({ usuario, onIr }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await inicio.resumen());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function alternar(tarea) {
    try {
      await api.actualizar(tarea.id, { hecha: !tarea.hecha });
    } catch (e) {
      setError(e.message);
    }
    cargar();
  }

  const diaDelAnio = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86_400_000);
  const [refran, significado] = REFRANES[diaDelAnio % REFRANES.length];

  const ultimosDias = Array.from({ length: 7 }, (_, i) => {
    const dia = new Date();
    dia.setDate(dia.getDate() - 6 + i);
    return aTexto(dia);
  });

  const t = datos?.tareas;
  const g = datos?.gastos;
  const pendientes = t ? t.total - t.hechas : 0;
  const avance = t?.total ? Math.round((t.hechas / t.total) * 100) : 0;
  const usado = g?.presupuesto ? Math.min(100, (g.total / g.presupuesto) * 100) : 0;
  const ahora = new Date();

  return (
    <>
      <section className="portada">
        <p className="portada-fecha">{fechaBonita(hoy())}</p>
        <h2>
          {saludo()}, {usuario.nombre.split(" ")[0]}
        </h2>
        <blockquote>
          <span lang="ja">{refran}</span>
          <small>{significado}</small>
        </blockquote>
      </section>

      {error && <AvisoError mensaje={error} onReintentar={cargar} />}

      {datos && (
        <>
          <div className="indicadores">
            <button className="indicador" onClick={() => onIr("agenda")}>
              <Anillo porcentaje={avance} />
              <span className="indicador-numero">{pendientes}</span>
              <span className="indicador-texto">pendientes hoy</span>
              {t.atrasadas > 0 && <span className="indicador-alerta">{t.atrasadas} atrasadas</span>}
            </button>
            <button className="indicador" onClick={() => onIr("gastos")}>
              <span className="indicador-numero">{soles(g.total)}</span>
              <span className="indicador-texto">gastado este mes</span>
              {g.presupuesto > 0 ? (
                <div className="barra" title={`Presupuesto: ${soles(g.presupuesto)}`}>
                  <div className={`barra-relleno ${usado >= 100 ? "excedida" : ""}`} style={{ width: `${usado}%` }} />
                </div>
              ) : (
                <span className="indicador-pista">Fija un presupuesto</span>
              )}
            </button>
            <button className="indicador" onClick={() => onIr("bitacora")}>
              <span className="indicador-numero">{datos.bitacora.racha}</span>
              <span className="indicador-texto">{datos.bitacora.racha === 1 ? "día seguido" : "días seguidos"}</span>
              <span className="indicador-pista">
                {datos.bitacora.escrito_hoy ? "Hoy ya escribiste" : "Aún no escribes hoy"}
              </span>
            </button>
            <button className="indicador" onClick={() => onIr("fotos")}>
              <span className="indicador-numero">{datos.fotos.total}</span>
              <span className="indicador-texto">{datos.fotos.total === 1 ? "foto guardada" : "fotos guardadas"}</span>
            </button>
          </div>

          <div className="columnas">
            <section className="tarjeta">
              <TituloTarjeta texto="Tu día" onVer={() => onIr("agenda")} />
              {t.lista.length === 0 ? (
                <p className="vacio">Nada pendiente para hoy.</p>
              ) : (
                <ul className="lista-simple">
                  {t.lista.map((tarea) => (
                    <li key={tarea.id} className={tarea.hecha ? "hecha" : ""}>
                      <input
                        type="checkbox"
                        checked={tarea.hecha}
                        onChange={() => alternar(tarea)}
                        aria-label={`Marcar ${tarea.titulo}`}
                      />
                      <span>{tarea.titulo}</span>
                      {tarea.hora && <time>{tarea.hora.slice(0, 5)}</time>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="tarjeta">
              <TituloTarjeta texto="Próximos avisos" onVer={() => onIr("recordatorios")} />
              {datos.recordatorios.length === 0 ? (
                <p className="vacio">No tienes recordatorios.</p>
              ) : (
                <ul className="lista-simple">
                  {datos.recordatorios.map((r) => (
                    <li key={r.id} className={fechaHoraDe(r) <= ahora ? "vencido" : ""}>
                      <span lang="ja" className="mini-kanji" aria-hidden="true">
                        鈴
                      </span>
                      <span>{r.titulo}</span>
                      <time>{cuandoEs(r)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="tarjeta">
            <TituloTarjeta texto="Tu ánimo esta semana" onVer={() => onIr("bitacora")} />
            <div className="semana">
              {ultimosDias.map((dia) => (
                <div key={dia} className={dia === hoy() ? "es-hoy" : ""}>
                  <span className="semana-emoji">{datos.bitacora.animos[dia] ?? "·"}</span>
                  <small>{new Date(`${dia}T12:00`).toLocaleDateString("es", { weekday: "short" })}</small>
                </div>
              ))}
            </div>
          </section>

          {datos.fotos.ultimas.length > 0 && (
            <section className="tarjeta">
              <TituloTarjeta texto="Últimos recuerdos" onVer={() => onIr("fotos")} />
              <div className="fotos-recientes">
                {datos.fotos.ultimas.map((f) => (
                  <ImagenPrivada key={f.id} foto={f} alt={f.descripcion || f.nombre_original} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function TituloTarjeta({ texto, onVer }) {
  return (
    <div className="titulo-tarjeta">
      <h2>{texto}</h2>
      <button className="enlace" onClick={onVer}>
        Ver todo
      </button>
    </div>
  );
}
