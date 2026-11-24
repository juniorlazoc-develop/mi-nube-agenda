/**
 * Componente raíz.
 *
 * Decide qué se ve:
 *   - sin sesión -> <Login />
 *   - con sesión -> menú + la sección elegida
 *
 * En computadora el menú va a la izquierda; en el celular baja al pie de la pantalla,
 * donde llega el pulgar. Es el mismo HTML: solo cambia el CSS.
 * Cada sección es una "vista" (carpeta vistas/) que maneja sus propios datos.
 * Cada sección tiene un ícono de línea (components/Iconos.jsx).
 */
import { useEffect, useState } from "react";

import { auth, cuandoExpire, sesion } from "./api.js";
import AvisosRecordatorio from "./components/AvisosRecordatorio.jsx";
import { Icono, Logo } from "./components/Iconos.jsx";
import Login from "./components/Login.jsx";
import Agenda from "./vistas/Agenda.jsx";
import Ajustes from "./vistas/Ajustes.jsx";
import Bitacora from "./vistas/Bitacora.jsx";
import Fotos from "./vistas/Fotos.jsx";
import Gastos from "./vistas/Gastos.jsx";
import Inicio from "./vistas/Inicio.jsx";
import Recordatorios from "./vistas/Recordatorios.jsx";

const SECCIONES = [
  { id: "inicio", texto: "Inicio", Vista: Inicio },
  { id: "agenda", texto: "Agenda", Vista: Agenda },
  { id: "recordatorios", texto: "Avisos", Vista: Recordatorios },
  { id: "bitacora", texto: "Bitácora", Vista: Bitacora },
  { id: "gastos", texto: "Gastos", Vista: Gastos },
  { id: "fotos", texto: "Fotos", Vista: Fotos },
  { id: "ajustes", texto: "Ajustes", Vista: Ajustes },
];

export default function App() {
  // undefined = aún revisando el token guardado · null = sin sesión · {..} = usuario
  const [usuario, setUsuario] = useState(sesion.token() ? undefined : null);
  const [seccion, setSeccion] = useState(() => localStorage.getItem("mi-nube-seccion") ?? "inicio");
  const [vencidos, setVencidos] = useState(0);

  // Al abrir: si hay un token guardado, preguntamos al backend si sigue sirviendo.
  useEffect(() => {
    cuandoExpire(() => setUsuario(null));
    if (sesion.token()) {
      auth
        .yo()
        .then(setUsuario)
        .catch(() => {
          sesion.cerrar();
          setUsuario(null);
        });
    }
  }, []);

  function elegir(id) {
    setSeccion(id);
    localStorage.setItem("mi-nube-seccion", id); // recordar la sección al recargar
    window.scrollTo({ top: 0 });
  }

  function salir() {
    sesion.cerrar();
    setUsuario(null);
  }

  if (usuario === undefined) return <div className="pantalla-carga"><Logo /></div>;
  if (usuario === null) return <Login onEntrar={setUsuario} />;

  const actual = SECCIONES.find((s) => s.id === seccion) ?? SECCIONES[0];
  const { Vista } = actual;

  return (
    <div className="marco entrando">
      <nav className="menu" aria-label="Secciones">
        <div className="menu-marca">
          <Logo />
          <div>
            <strong>Mi Nube</strong>
            <span>Agenda personal</span>
          </div>
        </div>
        <div className="menu-lista">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              className={`menu-item ${s.id === actual.id ? "activo" : ""}`}
              aria-current={s.id === actual.id ? "page" : undefined}
              onClick={() => elegir(s.id)}
            >
              <Icono nombre={s.id === "recordatorios" ? "avisos" : s.id} />
              <span>{s.texto}</span>
              {s.id === "recordatorios" && vencidos > 0 && <span className="insignia">{vencidos}</span>}
            </button>
          ))}
        </div>
        <button className="menu-salir" onClick={salir}>
          <Icono nombre="salir" tamano={18} />
          Cerrar sesión
        </button>
      </nav>

      <div className="contenido">
        <header className="cabecera">
          <h1>{actual.id === "recordatorios" ? "Recordatorios" : actual.texto}</h1>
          <span className="usuario-chip">
            <span className="avatar" aria-hidden="true">
              {usuario.nombre.trim().charAt(0).toUpperCase()}
            </span>
            {usuario.nombre}
          </span>
        </header>

        {/* key = la vista se "re-monta" (y anima) al cambiar de sección */}
        <main className="vista" key={actual.id}>
          <Vista usuario={usuario} onIr={elegir} onUsuario={setUsuario} onSalir={salir} />
        </main>
      </div>

      <AvisosRecordatorio onVencidos={setVencidos} onIr={elegir} />
    </div>
  );
}
