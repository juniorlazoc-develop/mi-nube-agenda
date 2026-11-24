/**
 * Punto de entrada del frontend: monta el componente <App /> dentro de <div id="root">.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Tipografía Inter guardada en el proyecto: funciona sin depender de Google.
// Solo el alfabeto latino y los pesos que usamos, para que pese poco.
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";

import App from "./App.jsx";
import "./estilos.css";
import { aplicarTema, temaActual } from "./tema.js";

aplicarTema(temaActual());

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
