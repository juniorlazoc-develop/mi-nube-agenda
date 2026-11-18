/**
 * Tema de colores: "noche" o "dia".
 * Se guarda en localStorage y se aplica con el atributo data-tema de <html>,
 * que es lo que mira estilos.css para elegir la paleta.
 */
const CLAVE = "mi-nube-tema";

export function temaActual() {
  return localStorage.getItem(CLAVE) === "dia" ? "dia" : "noche";
}

export function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
}

export function guardarTema(tema) {
  localStorage.setItem(CLAVE, tema);
  aplicarTema(tema);
}
