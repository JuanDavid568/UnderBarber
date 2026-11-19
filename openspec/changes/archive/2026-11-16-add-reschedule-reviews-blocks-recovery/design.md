# Design

## Decisiones
- **Reprogramar reutiliza la Chain of Responsibility** en lugar de duplicar reglas: se arma una cadena sin el eslabón de límite de citas y se excluye la propia cita con `excludeId`. Justificación: una sola fuente de verdad para las reglas de horarios.
- **Token de recuperación**: 32 bytes aleatorios; en la base solo se guarda el hash SHA-256 (`CHAR(64) UNIQUE`). Si la base se filtra, los tokens no sirven.
- **Respuesta idéntica en `/forgot`** exista o no el correo, para no revelar qué correos están registrados.
- **Bloqueos como intervalos ocupados** (`busyIntervals`) en vez de citas falsas: la disponibilidad y la reserva leen la misma función.
- **Reseñas con `UNIQUE (appointment_id)`**: la unicidad la garantiza la base de datos, no solo la interfaz.

## Riesgos / límites conocidos
- Cambiar la contraseña no invalida las sesiones JWT ya emitidas.
- Sin SMTP configurado, el enlace de recuperación sale en los logs del servidor.
