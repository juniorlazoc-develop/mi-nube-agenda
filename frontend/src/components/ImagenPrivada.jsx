/**
 * Muestra una foto protegida.
 *
 * Una etiqueta <img src="..."> normal no puede enviar el token del login, y sin token
 * el backend responde 401. Por eso bajamos la imagen con fetch y creamos una dirección
 * temporal (blob:) que solo existe dentro de esta pestaña.
 *
 * La imagen se pide recién cuando está por aparecer en pantalla (IntersectionObserver):
 * con 500 fotos, no se descargan las 500 de golpe.
 */
import { useEffect, useRef, useState } from "react";

import { fotos } from "../api.js";

export default function ImagenPrivada({ foto, tipo = "miniatura", alt = "", className = "" }) {
  const caja = useRef(null);
  const [visible, setVisible] = useState(tipo === "imagen");
  const [direccion, setDireccion] = useState(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    if (visible) return;
    const observador = new IntersectionObserver(
      ([entrada]) => entrada.isIntersecting && setVisible(true),
      { rootMargin: "300px" } // empieza a cargar 300 px antes de que llegue a la pantalla
    );
    observador.observe(caja.current);
    return () => observador.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelado = false;
    let url = null;
    setDireccion(null);
    setFallo(false);
    fotos
      .archivo(foto.id, tipo)
      .then((blob) => {
        if (cancelado) return;
        url = URL.createObjectURL(blob);
        setDireccion(url);
      })
      .catch(() => !cancelado && setFallo(true));
    return () => {
      cancelado = true;
      if (url) URL.revokeObjectURL(url); // libera la memoria al salir de la pantalla
    };
  }, [visible, foto.id, tipo]);

  return (
    <div ref={caja} className={`imagen-privada ${direccion ? "lista" : ""} ${className}`}>
      {direccion && <img src={direccion} alt={alt} />}
      {fallo && <span className="imagen-fallo">No se pudo cargar</span>}
    </div>
  );
}
