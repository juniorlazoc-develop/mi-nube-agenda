/**
 * Pantalla de acceso.
 *
 * Tiene dos modos según lo que diga el backend (/api/auth/estado):
 *   - "registro": todavía no hay cuenta -> la creas (solo pasa UNA vez).
 *   - "entrar":   ya hay cuenta -> usuario + contraseña.
 *
 * Diseño: a la izquierda, la presentación de la app sobre un fondo oscuro con luces
 * de color difuminadas que se mueven despacio; a la derecha, la tarjeta del formulario.
 * En el celular solo queda la tarjeta. Las animaciones están en login.css.
 */
import { useEffect, useState } from "react";

import { auth, sesion } from "../api.js";
import { Icono, Logo } from "./Iconos.jsx";
import "./login.css";

/** Puntaje 0-4 de qué tan fuerte es la contraseña (solo para la barrita de colores). */
function fuerza(clave) {
  let p = 0;
  if (clave.length >= 8) p++;
  if (clave.length >= 12) p++;
  if (/[A-Z]/.test(clave) && /[a-z]/.test(clave)) p++;
  if (/\d/.test(clave) && /[^A-Za-z0-9]/.test(clave)) p++;
  return p;
}
const NIVELES = ["Muy débil", "Débil", "Aceptable", "Buena", "Excelente"];

// Lo que se ve en el panel de presentación: ícono y texto de cada función.
const FUNCIONES = [
  ["agenda", "Pendientes y recordatorios del día"],
  ["gastos", "Gastos del mes con presupuesto"],
  ["bitacora", "Una nota diaria con tu ánimo"],
  ["fotos", "Galería de fotos privada"],
];

export default function Login({ onEntrar }) {
  const [modo, setModo] = useState(null); // null = preguntando al backend
  const [usuario, setUsuario] = useState("");
  const [nombre, setNombre] = useState("");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [temblor, setTemblor] = useState(0); // cambia el "key" para repetir la animación
  const [exito, setExito] = useState(null);

  // ¿Ya existe la cuenta? Así sabemos si mostrar "Entrar" o "Crear cuenta".
  useEffect(() => {
    auth
      .estado()
      .then((e) => setModo(e.hay_usuario ? "entrar" : "registro"))
      .catch((e) => {
        setError(e.message);
        setModo("entrar");
      });
  }, []);

  const esRegistro = modo === "registro";
  const puntos = fuerza(clave);
  const puedeEnviar =
    usuario.trim().length >= 3 && clave.length >= (esRegistro ? 8 : 1) && (!esRegistro || nombre.trim());

  async function enviar(evento) {
    evento.preventDefault();
    if (!puedeEnviar || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const r = esRegistro
        ? await auth.registro({ usuario: usuario.trim(), nombre: nombre.trim(), contrasena: clave })
        : await auth.login(usuario.trim(), clave);
      sesion.guardar(r.access_token);
      setExito(r.usuario);
      // Un momento para ver la marca de "listo" antes de entrar.
      setTimeout(() => onEntrar(r.usuario), 1100);
    } catch (e) {
      setError(e.message);
      setTemblor((n) => n + 1);
      setEnviando(false);
    }
  }

  return (
    <div className={`login-escena ${exito ? "con-exito" : ""}`}>
      <div className="login-fondo" aria-hidden="true">
        <span className="luz luz-1" />
        <span className="luz luz-2" />
        <span className="luz luz-3" />
        <div className="rejilla" />
      </div>

      <div className="login-contenido">
        <aside className="login-presentacion">
          <div className="login-marca">
            <Logo />
            <strong>Mi Nube</strong>
          </div>
          <h2>
            Tu día, tus gastos y tus recuerdos, <span>en un solo lugar.</span>
          </h2>
          <ul className="login-funciones">
            {FUNCIONES.map(([icono, texto], i) => (
              <li key={icono} style={{ "--orden": i }}>
                <span className="login-funcion-icono">
                  <Icono nombre={icono} tamano={18} />
                </span>
                {texto}
              </li>
            ))}
          </ul>
          <p className="login-privado">
            <Icono nombre="candado" tamano={16} />
            Tus datos se guardan solo en tu equipo.
          </p>
        </aside>

        <main className={`login-tarjeta ${exito ? "saliendo" : ""}`} key={temblor} data-temblor={temblor > 0}>
          {exito ? (
            <div className="login-exito">
              <span className="exito-check">
                <Icono nombre="check" tamano={30} />
              </span>
              <h2>Bienvenido, {exito.nombre}</h2>
              <p>Abriendo tu nube...</p>
            </div>
          ) : (
            <>
              <Logo className="login-logo-movil" />
              <h1 className="login-titulo">{esRegistro ? "Crea tu cuenta" : "Inicia sesión"}</h1>
              <p className="login-sub">
                {modo === null
                  ? "Conectando..."
                  : esRegistro
                  ? "Solo se hace una vez. Después entras con tu usuario."
                  : "Qué bueno verte de vuelta."}
              </p>

              <form onSubmit={enviar} className="login-form" noValidate>
                {esRegistro && (
                  <Campo etiqueta="Tu nombre" valor={nombre} onCambio={setNombre} autoComplete="name" orden={1} />
                )}
                <Campo
                  etiqueta="Usuario"
                  valor={usuario}
                  onCambio={setUsuario}
                  autoComplete="username"
                  autoFocus
                  orden={2}
                />
                <Campo
                  etiqueta="Contraseña"
                  tipo={verClave ? "text" : "password"}
                  valor={clave}
                  onCambio={setClave}
                  autoComplete={esRegistro ? "new-password" : "current-password"}
                  onKeyUp={(e) => setMayusculas(e.getModifierState?.("CapsLock"))}
                  orden={3}
                  extra={
                    <button
                      type="button"
                      className="ver-clave"
                      onClick={() => setVerClave(!verClave)}
                      aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      <Icono nombre={verClave ? "ojo-tachado" : "ojo"} />
                    </button>
                  }
                />

                {mayusculas && <p className="login-aviso">Tienes activadas las mayúsculas</p>}

                {esRegistro && clave && (
                  <div className="fuerza" data-nivel={puntos}>
                    <div className="fuerza-barras">
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} className={i < puntos ? "llena" : ""} />
                      ))}
                    </div>
                    <span>{clave.length < 8 ? `Mínimo 8 caracteres (${clave.length}/8)` : NIVELES[puntos]}</span>
                  </div>
                )}

                {error && (
                  <p className="login-error" role="alert">
                    {error}
                  </p>
                )}

                <button className="login-boton" disabled={!puedeEnviar || enviando || modo === null}>
                  {enviando ? <span className="girando" aria-label="Cargando" /> : esRegistro ? "Crear mi cuenta" : "Entrar"}
                </button>
              </form>

              <p className="login-pie">
                <Icono nombre="candado" tamano={14} />
                Contraseña cifrada con Argon2 · sesión con JWT
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/** Campo con "etiqueta flotante": la etiqueta sube cuando escribes o haces clic. */
function Campo({ etiqueta, tipo = "text", valor, onCambio, extra, orden, ...resto }) {
  return (
    <label className="campo" style={{ "--orden": orden }}>
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder=" " // necesario para el truco CSS :placeholder-shown
        {...resto}
      />
      <span className="campo-etiqueta">{etiqueta}</span>
      {extra}
    </label>
  );
}
