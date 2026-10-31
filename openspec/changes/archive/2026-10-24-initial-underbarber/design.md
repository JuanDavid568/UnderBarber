# Design

## Context
Proyecto académico/real de una barbería con tres barberos. Debe ser desplegable en un hosting gratuito o barato.

## Goals / Non-Goals
- Goals: stack muy usado (Node + Express + PostgreSQL + JS vanilla), un solo servicio desplegable, reglas del quiz editables en BD.
- Non-Goals: pagos en línea, notificaciones por correo/WhatsApp, app móvil nativa.

## Decisions
- **Node.js + Express**: mismo lenguaje en frontend y backend, hosting abundante.
- **PostgreSQL**: estándar en producción y disponible en planes gratuitos de Render/Railway.
- **Frontend sin build**: HTML/CSS/JS con módulos ES; menos piezas que fallen en el hosting.
- **JWT en `Authorization: Bearer`**: sin estado en servidor; el token vive en `localStorage`.
- **Quiz con puntos en BD** (`quiz_option_points`): el dueño puede ajustar la recomendación sin tocar código.
- **Sin dobles reservas**: transacción con `pg_advisory_xact_lock(barber_id)` + verificación de solape; portátil (no exige extensiones como `btree_gist`).
- **Zona horaria fija** `America/Bogota` (UTC-05:00, sin horario de verano) mediante `SHOP_UTC_OFFSET`.
- **Semilla desde la app**: las cuentas iniciales se crean en JS (necesitan bcrypt) y solo si la BD está vacía.

## Risks / Trade-offs
- Token en `localStorage` es vulnerable a XSS → CSP estricta con helmet y escape de todo texto dinámico en el frontend.
- Hosting gratuito duerme el servicio → primera carga lenta; aceptable para el caso de uso.

## Migration Plan
`database/schema.sql` es idempotente (`CREATE ... IF NOT EXISTS`); cambios futuros irán como nuevos archivos de migración.
