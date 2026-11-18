/**
 * Punto de entrada del frontend: monta el componente <App /> dentro de <div id="root">.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Tipografías guardadas en el proyecto: funcionan sin depender de Google.
// Solo el alfabeto latino; los kanji vienen de una fuente recortada (ver estilos.css).
import "@fontsource/shippori-mincho/latin-500.css";
import "@fontsource/shippori-mincho/latin-700.css";
import "@fontsource/zen-kaku-gothic-new/latin-400.css";
import "@fontsource/zen-kaku-gothic-new/latin-500.css";
import "@fontsource/zen-kaku-gothic-new/latin-700.css";

import App from "./App.jsx";
import "./estilos.css";
import { aplicarTema, temaActual } from "./tema.js";

aplicarTema(temaActual());

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
