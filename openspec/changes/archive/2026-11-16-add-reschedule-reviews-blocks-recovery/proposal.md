# Change: Reprogramar citas, calificaciones, bloqueos de horario y recuperar contraseña

## Why
Cuatro mejoras aprobadas por el cliente: mover una cita sin cancelarla, saber qué tal fue el corte, que barberos y dueño puedan bloquear días u horas, y recuperar la contraseña.

## What Changes
- **ADDED** `PATCH /api/appointments/:id/reschedule`: la cita vuelve a `pending` y reutiliza la cadena de validaciones (sin el límite de citas).
- **ADDED** `reviews`: una calificación 1–5 por cita completada y por cliente; promedio visible en el equipo y en el dashboard.
- **ADDED** `schedule-blocks`: bloqueos por barbero o de toda la barbería; cuentan como horario ocupado y no se permiten si hay citas encima.
- **ADDED** `password-recovery`: token aleatorio de un solo uso, vence en 60 minutos, solo se guarda su hash; respuesta idéntica exista o no el correo.
- **MODIFIED** `design-patterns`: State gana `reprogramable`; Observer gana `cita:reprogramada` y `resena:creada`; Factory Method gana `crearCorreo`; Adapter gana `CorreoSmtp`.

## Impact
- Specs afectadas: `appointments`, `reviews`, `schedule-blocks`, `password-recovery`, `design-patterns`
- Código: `routes/appointments.js`, `barber.js`, `auth.js`, `admin.js`, `public.js`, `util.js`, `db.js`, `services/slots.js`, `database/schema.sql`, `frontend/js/panels.js`, `app.js`
- Dependencia nueva: `nodemailer`
