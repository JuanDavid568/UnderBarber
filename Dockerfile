# UnderBarber — imagen de producción (Node.js + Express sirve la API y el frontend)
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Dependencias primero (aprovecha la caché de Docker)
COPY backend/package*.json backend/
RUN cd backend && if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY backend backend
COPY frontend frontend
COPY database database

USER node
WORKDIR /app/backend
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" || exit 1

CMD ["node", "src/server.js"]
