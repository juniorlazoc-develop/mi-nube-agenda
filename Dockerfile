# Receta para construir la "caja" (imagen) con Mi Nube lista para el servidor.
# Tiene dos pasos para que la imagen final no cargue con Node ni node_modules.

# Paso 1: compilar React. Sale la carpeta dist con HTML, CSS y JS listos.
FROM node:22-alpine AS web
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Paso 2: el backend de Python, que además entrega la página compilada.
FROM python:3.13-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY --from=web /frontend/dist ./web

ENV MI_NUBE_PRODUCCION=1 MI_NUBE_DATOS=/datos MI_NUBE_WEB=/app/web

# El programa corre con un usuario sin privilegios: si alguien lograra entrar
# por un fallo de la app, no sería administrador dentro de la caja.
RUN useradd --system minube && mkdir /datos && chown minube /datos
USER minube

# Un solo proceso: el limitador del login guarda sus intentos en memoria.
# proxy-headers: la IP real del visitante la informa Caddy, el único que llega aquí.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
