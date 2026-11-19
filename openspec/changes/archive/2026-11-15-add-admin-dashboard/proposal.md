# Change: Dashboard para el administrador

## Why
En las entrevistas el dueño pidió saber qué días y horas se llena la barbería y qué servicios se piden más.

## What Changes
- **ADDED** capability `dashboard`: totales, citas por día, servicio, barbero, día de la semana y hora, ingresos y ticket promedio, con gráficas SVG.
- **ADDED** endpoint `GET /api/admin/dashboard` (solo administrador).

## Impact
- Specs afectadas: `dashboard`
- Código: `backend/src/routes/admin.js`, `services/slots.js` (`buildDashboard`), `frontend/js/panels.js`, `css/styles.css`
