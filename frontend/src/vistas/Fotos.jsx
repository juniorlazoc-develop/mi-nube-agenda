/**
 * Vista "Fotos": tu galería privada.
 *
 * Puedes subir varias a la vez (con el botón o arrastrándolas), ordenarlas en álbumes,
 * marcar favoritas y verlas en grande. En la vista grande funcionan las flechas del
 * teclado y Esc, y el componente Visor se encarga de todo eso.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fotos } from "../api.js";
import AvisoError from "../components/AvisoError.jsx";
import ImagenPrivada from "../components/ImagenPrivada.jsx";
import { fechaCorta, mesBonito, mesDe, tamanoLegible } from "../fechas.js";

const TIPOS = "image/jpeg,image/png,image/webp,image/gif";

export default function Fotos() {
  const [lista, setLista] = useState([]);
  const [albumes, setAlbumes] = useState([]);
  const [filtro, setFiltro] = useState(""); // "" = todas · "*" = favoritas · texto = álbum
  const [albumSubida, setAlbumSubida] = useState("");
  const [progreso, setProgreso] = useState(null); // { hecho, total }
  const [arrastrando, setArrastrando] = useState(false);
  const [abierta, setAbierta] = useState(null); // posición de la foto en la lista
  const [fallos, setFallos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const selector = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const filtros = filtro === "*" ? { favoritas: true } : filtro ? { album: filtro } : {};
      const [fotosLista, albumesLista] = await Promise.all([fotos.listar(filtros), fotos.albumes()]);
      setLista(fotosLista);
      setAlbumes(albumesLista);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [filtro]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Agrupa por mes: { "2026-11": [...], "2026-10": [...] }. El orden ya viene del backend.
  const porMes = useMemo(() => {
    const grupos = new Map();
    lista.forEach((foto, posicion) => {
      const mes = mesDe(foto.fecha);
      grupos.set(mes, [...(grupos.get(mes) ?? []), { foto, posicion }]);
    });
    return [...grupos];
  }, [lista]);

  async function subirArchivos(archivos) {
    const elegidos = [...archivos].filter((a) => a.type.startsWith("image/"));
    if (elegidos.length === 0) return;
    setFallos([]);
    const errores = [];
    // Una por una: si una falla, las demás siguen y podemos mostrar el avance.
    for (const [i, archivo] of elegidos.entries()) {
      setProgreso({ hecho: i, total: elegidos.length });
      try {
        await fotos.subir(archivo, albumSubida.trim() || (filtro !== "*" ? filtro : ""));
      } catch (e) {
        errores.push(`${archivo.name}: ${e.message}`);
      }
    }
    setProgreso(null);
    setFallos(errores);
    cargar();
  }

  function soltar(evento) {
    evento.preventDefault();
    setArrastrando(false);
    subirArchivos(evento.dataTransfer.files);
  }

  async function cambiarFoto(foto, cambios) {
    try {
      await fotos.actualizar(foto.id, cambios);
    } catch (e) {
      setError(e.message);
    }
    cargar();
  }

  async function eliminarFoto(foto) {
    if (!confirm("¿Eliminar esta foto para siempre?")) return;
    try {
      await fotos.eliminar(foto.id);
      setAbierta(null);
    } catch (e) {
      setError(e.message);
    }
    cargar();
  }

  const pesoTotal = lista.reduce((suma, f) => suma + f.bytes, 0);

  return (
    <>
      {error && <AvisoError mensaje={error} onReintentar={cargar} />}

      <section
        className={`tarjeta zona-subida ${arrastrando ? "encima" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={soltar}
      >
        <div>
          <strong>Sube tus fotos</strong>
          <span>Arrástralas aquí o elígelas. Hasta 15 MB cada una.</span>
        </div>
        <input
          list="lista-albumes"
          placeholder="Álbum (opcional)"
          value={albumSubida}
          onChange={(e) => setAlbumSubida(e.target.value)}
          maxLength={60}
          aria-label="Álbum para las fotos nuevas"
        />
        <datalist id="lista-albumes">
          {albumes.map((a) => (
            <option key={a.nombre} value={a.nombre} />
          ))}
        </datalist>
        <button className="boton-principal" onClick={() => selector.current.click()} disabled={progreso !== null}>
          {progreso ? `Subiendo ${progreso.hecho + 1} de ${progreso.total}...` : "Elegir fotos"}
        </button>
        <input
          ref={selector}
          type="file"
          accept={TIPOS}
          multiple
          hidden
          onChange={(e) => {
            subirArchivos(e.target.files);
            e.target.value = ""; // permite volver a elegir el mismo archivo
          }}
        />
        {progreso && (
          <div className="barra subida">
            <div className="barra-relleno" style={{ width: `${(progreso.hecho / progreso.total) * 100}%` }} />
          </div>
        )}
      </section>

      {fallos.length > 0 && (
        <div className="aviso-error" role="alert">
          <strong>No se pudieron subir:</strong>
          <ul>
            {fallos.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="chips-filtro">
        <button className={`chip-filtro ${filtro === "" ? "activo" : ""}`} onClick={() => setFiltro("")}>
          Todas
        </button>
        <button className={`chip-filtro ${filtro === "*" ? "activo" : ""}`} onClick={() => setFiltro("*")}>
          ★ Favoritas
        </button>
        {albumes.map((a) => (
          <button
            key={a.nombre}
            className={`chip-filtro ${filtro === a.nombre ? "activo" : ""}`}
            onClick={() => setFiltro(a.nombre)}
          >
            {a.nombre} <small>{a.cantidad}</small>
          </button>
        ))}
      </div>

      {cargando ? (
        <p className="vacio">Cargando...</p>
      ) : lista.length === 0 ? (
        <section className="tarjeta">
          <p className="vacio">{filtro ? "No hay fotos aquí." : "Tu galería está vacía. Sube tu primera foto."}</p>
        </section>
      ) : (
        <>
          <p className="pista izquierda">
            {lista.length} {lista.length === 1 ? "foto" : "fotos"} · {tamanoLegible(pesoTotal)}
          </p>
          {porMes.map(([mes, items]) => (
            <section key={mes} className="galeria-mes">
              <h2 className="titulo-seccion">{mesBonito(mes)}</h2>
              <div className="galeria">
                {items.map(({ foto, posicion }) => (
                  <button
                    key={foto.id}
                    className="galeria-foto"
                    onClick={() => setAbierta(posicion)}
                    aria-label={`Ver ${foto.descripcion || foto.nombre_original}`}
                  >
                    <ImagenPrivada foto={foto} />
                    {foto.favorita && <span className="galeria-estrella">★</span>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      {abierta !== null && lista[abierta] && (
        <Visor
          foto={lista[abierta]}
          albumes={albumes}
          posicion={abierta}
          total={lista.length}
          onCerrar={() => setAbierta(null)}
          onMover={(paso) => setAbierta((abierta + paso + lista.length) % lista.length)}
          onCambiar={(cambios) => cambiarFoto(lista[abierta], cambios)}
          onEliminar={() => eliminarFoto(lista[abierta])}
        />
      )}
    </>
  );
}

/** La foto en grande, a pantalla completa. */
function Visor({ foto, albumes, posicion, total, onCerrar, onMover, onCambiar, onEliminar }) {
  const [descripcion, setDescripcion] = useState(foto.descripcion ?? "");
  const [album, setAlbum] = useState(foto.album ?? "");

  // Al pasar a otra foto, los campos muestran los datos de esa foto.
  useEffect(() => {
    setDescripcion(foto.descripcion ?? "");
    setAlbum(foto.album ?? "");
  }, [foto]);

  useEffect(() => {
    const teclas = (e) => {
      if (e.target.tagName === "INPUT") return; // no interferir mientras escribes
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowLeft") onMover(-1);
      if (e.key === "ArrowRight") onMover(1);
    };
    document.addEventListener("keydown", teclas);
    document.body.style.overflow = "hidden"; // la página de atrás no se mueve
    return () => {
      document.removeEventListener("keydown", teclas);
      document.body.style.overflow = "";
    };
  }, [onCerrar, onMover]);

  async function descargar() {
    const blob = await fotos.archivo(foto.id, "imagen");
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = foto.nombre_original;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  }

  return (
    <div className="visor" role="dialog" aria-modal="true" aria-label="Foto en grande">
      <div className="visor-barra">
        <span>
          {posicion + 1} / {total}
        </span>
        <div className="visor-acciones">
          <button onClick={() => onCambiar({ favorita: !foto.favorita })} aria-pressed={foto.favorita}>
            {foto.favorita ? "★ Favorita" : "☆ Favorita"}
          </button>
          <button onClick={descargar}>Descargar</button>
          <button onClick={onEliminar}>Eliminar</button>
          <button onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
      </div>

      <div className="visor-imagen">
        {total > 1 && (
          <button className="visor-flecha" onClick={() => onMover(-1)} aria-label="Foto anterior">
            ‹
          </button>
        )}
        <ImagenPrivada key={foto.id} foto={foto} tipo="imagen" alt={foto.descripcion || foto.nombre_original} />
        {total > 1 && (
          <button className="visor-flecha derecha" onClick={() => onMover(1)} aria-label="Foto siguiente">
            ›
          </button>
        )}
      </div>

      <form
        className="visor-datos"
        onSubmit={(e) => {
          e.preventDefault();
          onCambiar({ descripcion: descripcion.trim() || null, album: album.trim() });
        }}
      >
        <input
          placeholder="Escribe una descripción"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          maxLength={500}
          aria-label="Descripción"
        />
        <input
          list="albumes-visor"
          placeholder="Álbum"
          value={album}
          onChange={(e) => setAlbum(e.target.value)}
          maxLength={60}
          aria-label="Álbum"
        />
        <datalist id="albumes-visor">
          {albumes.map((a) => (
            <option key={a.nombre} value={a.nombre} />
          ))}
        </datalist>
        <button className="boton-chico primario">Guardar</button>
        <small>
          {fechaCorta(foto.fecha)} · {foto.ancho} × {foto.alto} · {tamanoLegible(foto.bytes)}
        </small>
      </form>
    </div>
  );
}
