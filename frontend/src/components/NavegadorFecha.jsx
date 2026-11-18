/**
 * Barra para cambiar de día: ◀ fecha ▶, calendario y "Ir a hoy".
 * La usan la Agenda y la Bitácora.
 */
import { fechaBonita, hoy, sumarDias } from "../fechas.js";

export default function NavegadorFecha({ fecha, onCambiar }) {
  const esHoy = fecha === hoy();
  return (
    <nav className="navegador-fecha">
      <button className="boton-icono" onClick={() => onCambiar(sumarDias(fecha, -1))} title="Día anterior">
        ◀
      </button>
      <div className="fecha-actual">
        <strong>{esHoy ? "Hoy" : fechaBonita(fecha)}</strong>
        {esHoy && <span>{fechaBonita(fecha)}</span>}
      </div>
      <button className="boton-icono" onClick={() => onCambiar(sumarDias(fecha, 1))} title="Día siguiente">
        ▶
      </button>
      <input
        type="date"
        value={fecha}
        onChange={(e) => e.target.value && onCambiar(e.target.value)}
        aria-label="Elegir fecha"
      />
      {!esHoy && (
        <button className="boton-chico" onClick={() => onCambiar(hoy())}>
          Ir a hoy
        </button>
      )}
    </nav>
  );
}
