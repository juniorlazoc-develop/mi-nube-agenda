/**
 * Vista "Ajustes": tu cuenta, la apariencia, los avisos y las copias de seguridad.
 * El tema y el sonido se guardan en localStorage, porque son gustos de cada equipo.
 */
import { useState } from "react";

import { auth, descargar, sesion } from "../api.js";
import { guardarTema, temaActual } from "../tema.js";

export default function Ajustes({ usuario, onUsuario, onSalir }) {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [claves, setClaves] = useState({ actual: "", nueva: "", repetir: "" });
  const [tema, setTema] = useState(temaActual());
  const [sonido, setSonido] = useState(localStorage.getItem("mi-nube-sonido") !== "no");
  const [permiso, setPermiso] = useState("Notification" in window ? Notification.permission : "no-disponible");
  const [mensaje, setMensaje] = useState(null); // { seccion, texto, error }

  const avisar = (seccion, texto, error = false) => setMensaje({ seccion, texto, error });
  const Aviso = ({ seccion }) =>
    mensaje?.seccion === seccion && (
      <p className={`mensaje ${mensaje.error ? "con-error" : ""}`} role="status">
        {mensaje.texto}
      </p>
    );

  async function guardarNombre(evento) {
    evento.preventDefault();
    try {
      onUsuario(await auth.actualizar({ nombre: nombre.trim() }));
      avisar("perfil", "Nombre actualizado.");
    } catch (e) {
      avisar("perfil", e.message, true);
    }
  }

  async function cambiarClave(evento) {
    evento.preventDefault();
    if (claves.nueva !== claves.repetir) return avisar("clave", "Las contraseñas nuevas no coinciden.", true);
    try {
      const r = await auth.cambiarClave({ actual: claves.actual, nueva: claves.nueva });
      sesion.guardar(r.access_token); // este equipo sigue dentro con el pase nuevo
      setClaves({ actual: "", nueva: "", repetir: "" });
      avisar("clave", "Contraseña cambiada. Se cerró la sesión en tus otros equipos.");
    } catch (e) {
      avisar("clave", e.message, true);
    }
  }

  function elegirTema(valor) {
    setTema(valor);
    guardarTema(valor);
  }

  function alternarSonido() {
    localStorage.setItem("mi-nube-sonido", sonido ? "no" : "si");
    setSonido(!sonido);
  }

  async function descargarRespaldo() {
    try {
      await descargar("/api/sistema/respaldo", "mi-nube-respaldo.db");
      avisar("respaldo", "Copia descargada. Guárdala en un lugar seguro.");
    } catch (e) {
      avisar("respaldo", e.message, true);
    }
  }

  const cambiarClaveCampo = (campo) => (e) => setClaves({ ...claves, [campo]: e.target.value });

  return (
    <>
      <form className="tarjeta form-ajustes" onSubmit={guardarNombre}>
        <h2 className="titulo-seccion">Tu perfil</h2>
        <label>
          Usuario
          <input value={usuario.usuario} disabled />
        </label>
        <label>
          Nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} autoComplete="name" />
        </label>
        <Aviso seccion="perfil" />
        <button className="boton-principal" disabled={!nombre.trim() || nombre.trim() === usuario.nombre}>
          Guardar nombre
        </button>
      </form>

      <form className="tarjeta form-ajustes" onSubmit={cambiarClave}>
        <h2 className="titulo-seccion">Contraseña</h2>
        {/* El campo de usuario oculto ayuda a los gestores de contraseñas a guardar la nueva. */}
        <input type="text" value={usuario.usuario} autoComplete="username" readOnly hidden />
        <label>
          Contraseña actual
          <input type="password" value={claves.actual} onChange={cambiarClaveCampo("actual")} autoComplete="current-password" />
        </label>
        <label>
          Contraseña nueva (mínimo 8 caracteres)
          <input type="password" value={claves.nueva} onChange={cambiarClaveCampo("nueva")} autoComplete="new-password" />
        </label>
        <label>
          Repite la contraseña nueva
          <input type="password" value={claves.repetir} onChange={cambiarClaveCampo("repetir")} autoComplete="new-password" />
        </label>
        <Aviso seccion="clave" />
        <button className="boton-principal" disabled={!claves.actual || claves.nueva.length < 8 || !claves.repetir}>
          Cambiar contraseña
        </button>
      </form>

      <section className="tarjeta form-ajustes">
        <h2 className="titulo-seccion">Apariencia</h2>
        <div className="opciones-tema">
          {[
            ["noche", "Noche", "Índigo y glicinias"],
            ["dia", "Día", "Papel washi"],
          ].map(([valor, titulo, detalle]) => (
            <button
              key={valor}
              className={`opcion-tema ${valor} ${tema === valor ? "activa" : ""}`}
              onClick={() => elegirTema(valor)}
              aria-pressed={tema === valor}
            >
              <strong>{titulo}</strong>
              <span>{detalle}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="tarjeta form-ajustes">
        <h2 className="titulo-seccion">Avisos</h2>
        <label className="interruptor">
          <input type="checkbox" checked={sonido} onChange={alternarSonido} />
          Sonar una campanita al llegar un recordatorio
        </label>
        {permiso === "default" && (
          <button
            className="boton-chico"
            onClick={async () => setPermiso(await Notification.requestPermission())}
          >
            Activar notificaciones
          </button>
        )}
        {permiso === "granted" && <p className="pista izquierda">Notificaciones activadas en este navegador.</p>}
        {permiso === "denied" && (
          <p className="pista izquierda">Bloqueadas. Actívalas desde el candado de la barra de direcciones.</p>
        )}
        <p className="pista izquierda">Los avisos funcionan mientras Mi Nube esté abierta en el navegador.</p>
      </section>

      <section className="tarjeta form-ajustes">
        <h2 className="titulo-seccion">Copia de seguridad</h2>
        <p className="pista izquierda">
          Descarga tus pendientes, bitácora, gastos y recordatorios en un archivo. Las imágenes de tus fotos no van
          incluidas.
        </p>
        <Aviso seccion="respaldo" />
        <button className="boton-chico" onClick={descargarRespaldo}>
          Descargar copia
        </button>
      </section>

      <button className="boton-chico peligro" onClick={onSalir}>
        Cerrar sesión
      </button>
    </>
  );
}
