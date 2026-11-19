# Registro de cambios (OpenSpec)

Cada fila corresponde a una carpeta en `changes/archive/`. Las fechas son las del día en que se entregó el cambio.

| Fecha | Cambio | Capacidades afectadas | Resumen |
|---|---|---|---|
| 2026-10-24 | `initial-underbarber` | auth, barbers-services, quiz-recommendation, appointments, deployment | Construcción inicial: sitio público, cuestionario, reservas sin cruces, paneles de barbero y admin, Docker y Render |
| 2026-10-28 | `add-barber-photos` | barbers-services | Foto del equipo por barbero |
| 2026-10-28 | `add-cover-page` | landing | Portada con botón «Reservar» y salto al primer día con horarios libres |
| 2026-11-11 | `add-design-patterns` | design-patterns | **12 patrones de diseño** integrados y marcados en el código existente, con pruebas |
| 2026-11-15 | `add-notices-and-consent` | auth, privacy-consent, barbers-services | Avisos de bienvenida y cierre de sesión, autorización de datos obligatoria (Ley 1581), fotos uniformes con fondo negro |
| 2026-11-15 | `add-admin-dashboard` | dashboard | Estadísticas y gráficas para el administrador |
| 2026-11-16 | `add-reschedule-reviews-blocks-recovery` | appointments, reviews, schedule-blocks, password-recovery, design-patterns | Reprogramar citas, calificar el corte, bloquear días u horas y recuperar la contraseña; amplía State, Factory, Observer y Adapter |
| 2026-11-16 | `add-hero-showcase-and-logo` | landing | Logo nuevo y vitrina animada de barberos en la portada |
| 2026-11-16 | `add-privacy-policy-page` | privacy-consent | Página `/privacidad` enlazada desde el registro y el pie de página |
| 2026-11-16 | `deploy-render` | deployment | Despliegue real en Render con Blueprint y variables de entorno |
