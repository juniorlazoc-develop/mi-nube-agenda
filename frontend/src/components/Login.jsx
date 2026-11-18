/**
 * Pantalla de acceso.
 *
 * Tiene dos modos según lo que diga el backend (/api/auth/estado):
 *   - "registro": todavía no hay cuenta -> la creas (solo pasa UNA vez).
 *   - "entrar":   ya hay cuenta -> usuario + contraseña.
 *
 * Tema "Noche de glicinias": luna llena, montañas, un torii entre la niebla y flores
 * lilas que caen. Al entrar, un corte de luz cruza la pantalla, como una katana.
 * Es un diseño propio: usa símbolos tradicionales de Japón, sin personajes de ninguna serie.
 * Las animaciones están en login.css.
 */
import { useEffect, useRef, useState } from "react";

import { auth, sesion } from "../api.js";
import { Glicinias, Sello } from "./Glicinias.jsx";
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

/** Luna, montañas por capas y torii. Una sola imagen vectorial que llena el fondo. */
function Paisaje() {
  return (
    <svg className="paisaje" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#090a1a" />
          <stop offset="0.55" stopColor="#1c1740" />
          <stop offset="1" stopColor="#3f2a6b" />
        </linearGradient>
        <radialGradient id="halo">
          <stop offset="0.3" stopColor="#efe6ff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#efe6ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="luna" cx="0.42" cy="0.4">
          <stop offset="0" stopColor="#fffdf5" />
          <stop offset="0.75" stopColor="#f3e7c9" />
          <stop offset="1" stopColor="#d9c6a0" />
        </radialGradient>
        <linearGradient id="niebla" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9b6ec" stopOpacity="0" />
          <stop offset="1" stopColor="#c9b6ec" stopOpacity="0.28" />
        </linearGradient>
      </defs>

      <rect width="1600" height="900" fill="url(#cielo)" />
      <g className="capa capa-luna">
        <circle cx="1130" cy="300" r="340" fill="url(#halo)" />
        <circle cx="1130" cy="300" r="165" fill="url(#luna)" />
        <path
          d="M1040 240 q30 -22 60 -6 q-24 4 -36 22 z M1160 360 q40 -12 62 10 q-34 -6 -52 8 z M1190 210 q22 -10 36 4 q-20 0 -28 10 z"
          fill="#cdb98f"
          opacity="0.35"
        />
      </g>

      <path
        className="capa capa-lejos"
        d="M0 640 L170 520 L300 600 L470 440 L620 590 L790 500 L930 620 L1120 470 L1290 610 L1440 530 L1600 640 V900 H0 Z"
        fill="#2c2358"
      />
      <rect y="470" width="1600" height="260" fill="url(#niebla)" />
      <path
        className="capa capa-media"
        d="M0 720 C160 650 280 690 430 640 S 720 690 880 640 S 1210 700 1360 660 S 1540 680 1600 660 V900 H0 Z"
        fill="#1b1740"
      />

      {/* El torii, sobre la colina. Marca la entrada a un lugar sagrado: aquí, a tu nube. */}
      <g className="capa capa-media" fill="#a3303c">
        <path d="M1208 548 Q1294 562 1380 548 L1386 532 Q1294 546 1202 532 Z" />
        <rect x="1214" y="564" width="160" height="10" />
        <rect x="1238" y="552" width="12" height="118" />
        <rect x="1338" y="552" width="12" height="118" />
        <rect x="1288" y="550" width="12" height="16" />
      </g>

      <rect y="600" width="1600" height="180" fill="url(#niebla)" />
      <path
        className="capa capa-cerca"
        d="M0 800 C200 740 420 790 640 750 S 1060 800 1260 760 S 1520 780 1600 750 V900 H0 Z"
        fill="#0c0c20"
      />
    </svg>
  );
}

// Pétalos que caen. Cada uno tiene su lugar, tamaño y velocidad.
const PETALOS = Array.from({ length: 26 }, (_, i) => ({
  izquierda: (i * 37) % 100,
  tamano: 7 + (i * 5) % 9,
  duracion: 11 + (i * 7) % 12,
  retraso: -((i * 3.3) % 20),
  giro: 180 + (i * 53) % 360,
}));

function Ojo({ tachado }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2 12 C5 6.5 8.5 4.5 12 4.5 S19 6.5 22 12 C19 17.5 15.5 19.5 12 19.5 S5 17.5 2 12 Z" />
      <circle cx="12" cy="12" r="3.2" />
      {tachado && <path d="M4 20 L20 4" />}
    </svg>
  );
}

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
  const escena = useRef(null);

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

  // Efecto "parallax": lo lejano se mueve poco y lo cercano más, y eso da profundidad.
  function moverMouse(e) {
    const x = (e.clientX / window.innerWidth - 0.5) * 2;
    const y = (e.clientY / window.innerHeight - 0.5) * 2;
    escena.current?.style.setProperty("--mx", x.toFixed(3));
    escena.current?.style.setProperty("--my", y.toFixed(3));
  }

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
      // Esperamos a que termine el corte de luz antes de entrar.
      setTimeout(() => onEntrar(r.usuario), 1500);
    } catch (e) {
      setError(e.message);
      setTemblor((n) => n + 1);
      setEnviando(false);
    }
  }

  return (
    <div className={`login-escena ${exito ? "con-exito" : ""}`} ref={escena} onMouseMove={moverMouse}>
      <div className="login-fondo" aria-hidden="true">
        <Paisaje />
        <Glicinias className="login-glicinias" />
        {PETALOS.map((p, i) => (
          <span
            key={i}
            className="petalo"
            style={{
              "--izquierda": `${p.izquierda}%`,
              "--tamano": `${p.tamano}px`,
              "--duracion": `${p.duracion}s`,
              "--retraso": `${p.retraso}s`,
              "--giro": `${p.giro}deg`,
            }}
          />
        ))}
      </div>

      <div className="login-contenido">
        <aside className="login-lema">
          <h2 className="vertical" lang="ja">
            私の雲
          </h2>
          <Sello className="login-sello" />
          <p>
            Tu rincón privado,
            <br />
            a la luz de la luna.
          </p>
        </aside>

        <main className={`login-tarjeta ${exito ? "saliendo" : ""}`} key={temblor} data-temblor={temblor > 0}>
          <div className="ichimatsu" aria-hidden="true" />
          {exito ? (
            <div className="login-exito">
              <Sello className="sello-exito" />
              <h2>Bienvenido, {exito.nombre}</h2>
              <p>Abriendo tu nube...</p>
            </div>
          ) : (
            <>
              <p className="login-kanji" lang="ja" aria-hidden="true">
                いらっしゃいませ
              </p>
              <h1 className="login-titulo">Mi Nube</h1>
              <p className="login-sub">
                {modo === null
                  ? "Conectando..."
                  : esRegistro
                  ? "Crea tu cuenta para comenzar"
                  : "Qué bueno verte de vuelta"}
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
                      <Ojo tachado={verClave} />
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

              <p className="login-pie">Solo tú tienes la llave de esta puerta</p>
            </>
          )}
        </main>
      </div>

      {exito && <div className="corte" aria-hidden="true" />}
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
