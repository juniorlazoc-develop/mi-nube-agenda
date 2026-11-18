/** Caja roja de error, con pista si el backend está apagado y botón Reintentar. */
export default function AvisoError({ mensaje, onReintentar }) {
  return (
    <div className="aviso-error" role="alert">
      <strong>⚠ {mensaje}</strong>
      {mensaje.includes("conexión") && (
        <span>
          {" "}
          ¿Está corriendo el backend? En <code>mi-nube\backend</code>: <code>fastapi dev app/main.py</code>
        </span>
      )}
      {onReintentar && (
        <button className="boton-chico" onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}
