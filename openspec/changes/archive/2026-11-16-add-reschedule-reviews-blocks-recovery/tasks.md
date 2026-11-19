# Tasks

## 1. Base de datos
- [x] 1.1 Tablas `reviews`, `time_blocks`, `password_resets` y columna `appointments.rescheduled_at` (idempotente)

## 2. Backend
- [x] 2.1 `busyIntervals` y bloqueos en disponibilidad y reserva
- [x] 2.2 `ReservaFacade.reprogramar()` reutilizando la cadena
- [x] 2.3 `POST /appointments/:id/review` con sus validaciones
- [x] 2.4 Rutas de bloqueos para barbero y administrador
- [x] 2.5 `/auth/forgot` y `/auth/reset` con token de un solo uso y límite de intentos
- [x] 2.6 `crearCorreo` (consola o SMTP) y eventos nuevos del Observer

## 3. Frontend
- [x] 3.1 «Reprogramar» y «Calificar» en Mis citas
- [x] 3.2 Sección «Bloquear horarios» (barbero) y pestaña «Bloqueos» (admin)
- [x] 3.3 «¿Olvidaste tu contraseña?» y pantalla para elegir la nueva
- [x] 3.4 Estrellas en el equipo y calificación en el dashboard

## 4. Verificación
- [x] 4.1 Pruebas unitarias (bloqueos, ratings, token, estados)
- [x] 4.2 Pruebas de la API contra PostgreSQL (reprogramar, duplicados, permisos, expiración del token)
- [x] 4.3 Prueba de interfaz en navegador
