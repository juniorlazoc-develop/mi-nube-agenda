import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuración de Vite (el servidor de desarrollo de React).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // "Proxy": cuando React pide /api/..., Vite se lo reenvía a FastAPI (puerto 8000).
    // Así el frontend puede escribir fetch("/api/tareas") sin poner la dirección completa.
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
});
