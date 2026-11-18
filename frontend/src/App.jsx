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
 * El ícono de cada sección es un kanji relacionado con ella.
 */
import { useEffect, useState } from "react";

import { auth, cuandoExpire, sesion } from "./api.js";
import AvisosRecordatorio from "./components/AvisosRecordatorio.jsx";
import { Glicinias, Sello } from "./components/Glicinias.jsx";
import Login from "./components/Login.jsx";
import Agenda from "./vistas/Agenda.jsx";
import Ajustes from "./vistas/Ajustes.jsx";
import Bitacora from "./vistas/Bitacora.jsx";
import Fotos from "./vistas/Fotos.jsx";
import Gastos from "./vistas/Gastos.jsx";
import Inicio from "./vistas/Inicio.jsx";
import Recordatorios from "./vistas/Recordatorios.jsx";

const SECCIONES = [
  { id: "inicio", texto: "Inicio", kanji: "今", Vista: Inicio },
  { id: "agenda", texto: "Agenda", kanji: "暦", Vista: Agenda },
  { id: "recordatorios", texto: "Avisos", kanji: "鈴", Vista: Recordatorios },
  { id: "bitacora", texto: "Bitácora", kanji: "記", Vista: Bitacora },
  { id: "gastos", texto: "Gastos", kanji: "銭", Vista: Gastos },
  { id: "fotos", texto: "Fotos", kanji: "写", Vista: Fotos },
  { id: "ajustes", texto: "Ajustes", kanji: "設", Vista: Ajustes },
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

  if (usuario === undefined) return <div className="pantalla-carga"><Sello /></div>;
  if (usuario === null) return <Login onEntrar={setUsuario} />;

  const actual = SECCIONES.find((s) => s.id === seccion) ?? SECCIONES[0];
  const { Vista } = actual;

  return (
    <div className="marco entrando">
      <nav className="menu" aria-label="Secciones">
        <div className="menu-marca">
          <Sello />
          <div>
            <strong>Mi Nube</strong>
            <span lang="ja">私の雲</span>
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
              <span className="menu-kanji" lang="ja" aria-hidden="true">
                {s.kanji}
              </span>
              <span>{s.texto}</span>
              {s.id === "recordatorios" && vencidos > 0 && <span className="insignia">{vencidos}</span>}
            </button>
          ))}
        </div>
        <button className="menu-salir" onClick={salir}>
          Cerrar sesión
        </button>
      </nav>

      <div className="contenido">
        <Glicinias className="contenido-glicinias" />
        <header className="cabecera">
          <div>
            <p className="cabecera-kanji" lang="ja" aria-hidden="true">
              {actual.kanji}
            </p>
            <h1>{actual.id === "recordatorios" ? "Recordatorios" : actual.texto}</h1>
          </div>
          <span className="subtitulo">{usuario.nombre}</span>
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
