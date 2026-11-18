/**
 * El vigilante de los recordatorios. Está siempre encendido mientras Mi Nube esté abierta.
 *
 * Cada 30 segundos pide la lista al backend y la compara con la hora actual.
 * Si algo venció, muestra un aviso en pantalla, una notificación del sistema
 * (si le diste permiso) y hace sonar un "fūrin", la campanita de viento japonesa.
 *
 * Importante: esto lo hace el navegador, así que solo funciona con la página abierta.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { recordatorios, RECORDATORIOS_CAMBIARON, avisarCambioRecordatorios } from "../api.js";
import { fechaHoraDe } from "../fechas.js";

const REVISAR_CADA = 30_000;

/** Tres notas suaves creadas con el navegador, sin archivos de audio. */
function sonarCampana() {
  if (localStorage.getItem("mi-nube-sonido") === "no") return;
  try {
    const audio = new AudioContext();
    [1568, 2093, 2637].forEach((frecuencia, i) => {
      const inicio = audio.currentTime + i * 0.16;
      const nota = audio.createOscillator();
      const volumen = audio.createGain();
      nota.frequency.value = frecuencia;
      volumen.gain.setValueAtTime(0.09, inicio);
      volumen.gain.exponentialRampToValueAtTime(0.001, inicio + 1.3);
      nota.connect(volumen).connect(audio.destination);
      nota.start(inicio);
      nota.stop(inicio + 1.3);
    });
  } catch {
    // Sin audio disponible: el aviso visual sigue funcionando.
  }
}

export default function AvisosRecordatorio({ onVencidos, onIr }) {
  const [visibles, setVisibles] = useState([]);
  const yaAvisados = useRef(new Set());

  const revisar = useCallback(async () => {
    let lista;
    try {
      lista = await recordatorios.listar();
    } catch {
      return; // sin conexión: lo intentamos en la próxima vuelta
    }
    const ahora = new Date();
    const vencidos = lista.filter((r) => fechaHoraDe(r) <= ahora);
    onVencidos(vencidos.length);
    setVisibles(vencidos.filter((r) => !yaAvisados.current.has(`cerrado-${clave(r)}`)).slice(0, 3));

    const nuevos = vencidos.filter((r) => !yaAvisados.current.has(clave(r)));
    nuevos.forEach((r) => {
      yaAvisados.current.add(clave(r));
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(r.titulo, { body: r.nota || "Tienes un recordatorio", icon: "/icono-192.png", tag: clave(r) });
      }
    });
    if (nuevos.length) sonarCampana();
  }, [onVencidos]);

  useEffect(() => {
    revisar();
    const reloj = setInterval(revisar, REVISAR_CADA);
    // Los celulares duermen las páginas: al volver a verla, revisamos enseguida.
    const alVolver = () => document.visibilityState === "visible" && revisar();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener(RECORDATORIOS_CAMBIARON, revisar);
    return () => {
      clearInterval(reloj);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener(RECORDATORIOS_CAMBIARON, revisar);
    };
  }, [revisar]);

  async function actuar(promesa) {
    try {
      await promesa;
    } catch {
      // Si falla, el aviso sigue en pantalla y se puede volver a intentar.
    }
    avisarCambioRecordatorios();
  }

  function cerrar(r) {
    yaAvisados.current.add(`cerrado-${clave(r)}`);
    setVisibles((lista) => lista.filter((x) => x.id !== r.id));
  }

  if (visibles.length === 0) return null;

  return (
    <div className="avisos" role="status" aria-live="polite">
      {visibles.map((r) => (
        <article key={r.id} className="aviso">
          <span className="aviso-kanji" lang="ja" aria-hidden="true">
            鈴
          </span>
          <div className="aviso-cuerpo">
            <strong onClick={() => onIr("recordatorios")}>{r.titulo}</strong>
            {r.nota && <p>{r.nota}</p>}
            <div className="aviso-botones">
              <button className="boton-chico primario" onClick={() => actuar(recordatorios.completar(r.id))}>
                Hecho
              </button>
              <button className="boton-chico" onClick={() => actuar(recordatorios.posponer(r.id, 10))}>
                10 min
              </button>
              <button className="boton-chico" onClick={() => actuar(recordatorios.posponer(r.id, 60))}>
                1 hora
              </button>
            </div>
          </div>
          <button className="boton-icono" onClick={() => cerrar(r)} aria-label="Cerrar aviso">
            ✕
          </button>
        </article>
      ))}
    </div>
  );
}

// Si lo pospones, cambia la clave y volverá a avisar en la nueva hora.
const clave = (r) => `${r.id}|${r.fecha}|${r.hora}`;
