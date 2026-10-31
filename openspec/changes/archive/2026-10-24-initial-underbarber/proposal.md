# Change: Construir la plataforma web UnderBarber

## Why
La barbería necesita presencia web real: que los clientes la conozcan, reciban una recomendación del barbero
ideal para el corte que quieren, y agenden sin llamar; y que los barberos y el dueño gestionen todo desde el navegador.

## What Changes
- **ADDED** capability `auth` — registro, login, roles y cambio de contraseña.
- **ADDED** capability `barbers-services` — equipo de 3 barberos con especialidades y catálogo de servicios.
- **ADDED** capability `quiz-recommendation` — cuestionario de 6 preguntas con puntaje por barbero.
- **ADDED** capability `appointments` — disponibilidad, reservas sin solapes y agenda del barbero.
- **ADDED** capability `deployment` — Docker, Render, variables de entorno e inicialización automática de BD.

## Impact
- Specs afectadas: `auth`, `barbers-services`, `quiz-recommendation`, `appointments`, `deployment`
- Código nuevo: `backend/`, `frontend/`, `database/`, `Dockerfile`, `render.yaml`
