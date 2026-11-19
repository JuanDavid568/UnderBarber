# UnderBarber

Página web completa de una barbería de Bogotá: los clientes conocen al equipo, responden un cuestionario que les recomienda el barbero ideal y agendan su cita; los barberos manejan su agenda y el dueño administra servicios, barberos y estadísticas.

El proyecto se construyó con **desarrollo guiado por especificaciones (SDD) usando OpenSpec**, y su segunda etapa aplica **12 patrones de diseño** sobre el sistema. Los documentos del proceso están en la raíz:

| Documento | Para qué sirve |
|---|---|
| [`PLAN_INGENIERIA.md`](PLAN_INGENIERIA.md) | Decisiones técnicas y su justificación, requisitos verificables y riesgos |
| [`openspec/`](openspec) | Especificaciones, propuestas, tareas y registro de cambios |
| [`INFORME_FINAL.md`](INFORME_FINAL.md) | Resultados, dificultades, decisiones modificadas y conclusiones sobre SDD |

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | HTML + CSS + JavaScript (módulos ES, sin build) |
| Backend | Node.js 20+ y Express 4 (API REST) |
| Base de datos | PostgreSQL 14+ (`pg`) |
| Seguridad | JWT, bcrypt, helmet (CSP), límites de intentos, consultas parametrizadas |
| Correo | `nodemailer` (SMTP) |
| Despliegue | Docker, `docker-compose.yml` (local), `render.yaml` (Render) |

## Los 12 patrones de diseño

Cada patrón está dentro de los archivos existentes y marcado con el comentario `PATRÓN <nombre>`. Para encontrarlos: buscar `PATRÓN` en `backend/src`. La justificación completa está en [`PLAN_INGENIERIA.md`](PLAN_INGENIERIA.md) y los requisitos en [`openspec/specs/design-patterns/spec.md`](openspec/specs/design-patterns/spec.md).

| # | Patrón | Tipo | Problema que resuelve | Dónde |
|---|---|---|---|---|
| 1 | Builder | Creacional | Armar y validar una cita con varios datos sueltos | `CitaBuilder` en `backend/src/util.js` |
| 2 | Factory Method | Creacional | Decidir en un solo lugar el canal de notificación y de correo | `FabricaNotificador`, `crearCorreo` en `util.js` |
| 3 | Singleton | Creacional | Una sola configuración, un solo pool de conexiones y un solo bus de eventos | `config.js`, `db.js`, `bus` en `util.js` |
| 4 | Proxy | Estructural | No consultar la base de datos en cada visita a las listas públicas | `conCache` en `util.js`, usado en `routes/public.js` |
| 5 | Facade | Estructural | Reservar implica bloqueo, validaciones, inserción y manejo de choques: una sola puerta | `ReservaFacade` en `routes/appointments.js` |
| 6 | Decorator | Estructural | Reenviar errores async y avisar de consultas lentas sin tocar el código original | `wrap` en `util.js`, `query` en `db.js` |
| 7 | Adapter | Estructural | Pasar filas `snake_case` al JSON `camelCase` y adaptar `nodemailer` a `enviar()` | `publicBarber`, `shapeAppointment`, `CorreoSmtp` en `util.js` |
| 8 | State | Comportamiento | Qué se puede hacer con una cita según su estado | `EstadoCita` en `util.js` |
| 9 | Chain of Responsibility | Comportamiento | Reglas de reserva en orden, reutilizables al reprogramar | `ManejadorReserva` en `util.js`, cadena en `routes/appointments.js` |
| 10 | Template Method | Comportamiento | Mismo esqueleto (cargar, validar, guardar, responder) para editar servicios y perfiles | `ActualizarRecurso` en `util.js`, subclases en `routes/admin.js` y `routes/barber.js` |
| 11 | Observer | Comportamiento | Reaccionar a eventos de citas sin acoplar las rutas | `bus`, `publicar`, `registrarObservadores` en `util.js` |
| 12 | Strategy | Comportamiento | Criterio de desempate del ranking del cuestionario intercambiable | `ESTRATEGIAS_DESEMPATE` en `backend/src/services/quiz.js` |

## Qué hace el sistema

- **Público:** portada, vitrina de barberos, servicios y precios, equipo con calificaciones, horarios.
- **Cuestionario «Encuentra tu barbero»:** 6 preguntas; cada respuesta suma puntos a los barberos y se recomienda uno con su % de compatibilidad.
- **Cliente:** registro con autorización de datos (Ley 1581 de 2012), inicio de sesión, recuperar contraseña, reservar, reprogramar, cancelar y calificar sus citas.
- **Barbero:** agenda por día o 7 días, confirmar/completar/cancelar, bloquear días u horas, editar su perfil.
- **Administrador:** estadísticas y dashboard, todas las citas, servicios, barberos y bloqueos.
- **Sin cruces de horario:** dos citas del mismo barbero no pueden solaparse, ni siquiera con dos clientes reservando a la vez.
- **Política de datos** publicada en `/privacidad`.

## Instalación y ejecución local

### Opción A — Docker (la más fácil)

```bash
docker compose up --build
# abre http://localhost:3000
```

Si existe `backend/package-lock.json` y agregaste dependencias, bórralo antes de construir.

### Opción B — Node y PostgreSQL instalados

```bash
createdb underbarber
cd backend
cp ../.env.example .env      # ajusta DATABASE_URL si hace falta
npm install
npm start                    # http://localhost:3000
```

La primera vez, la aplicación crea las tablas y carga los datos iniciales sola. En desarrollo (`NODE_ENV` distinto de `production`) también se crean cuentas de prueba para cada rol; están definidas en `backend/src/init.js`. **En producción no se crean cuentas de prueba.**

## Configuración (variables de entorno)

Copia `.env.example` a `backend/.env` (nunca lo subas al repositorio).

| Variable | Obligatoria en producción | Descripción |
|---|---|---|
| `NODE_ENV` | sí | `production` |
| `DATABASE_URL` | sí | Cadena de conexión de PostgreSQL |
| `DATABASE_SSL` | si tu proveedor lo exige | `true` |
| `JWT_SECRET` | sí | Mínimo 32 caracteres aleatorios. El servidor no arranca sin él en producción |
| `ADMIN_EMAIL` | no | Por defecto `admin@underbarber.com` |
| `ADMIN_PASSWORD` | sí | Mínimo 8 caracteres |
| `BARBER_DEFAULT_PASSWORD` | recomendada | Clave inicial de los 3 barberos; si falta, se genera una y se imprime una vez en los logs |
| `PUBLIC_URL` | sí, para recuperar contraseña | Dirección pública del sitio, sin barra final |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | para enviar correos | Sin `SMTP_HOST`, el enlace de recuperación se imprime en los logs |
| `NOTIFY_CHANNEL` | no | `consola` (por defecto), `memoria` o `silencio` |
| `PORT` | la suele poner el hosting | Por defecto 3000 |
| `SHOP_UTC_OFFSET` | no | Zona de la barbería; por defecto `-05:00` (Colombia) |

Genera un `JWT_SECRET` con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Pruebas automatizadas

```bash
cd backend
npm test
```

Ejecutan con `node --test`, sin base de datos ni red: cuestionario y estrategias de desempate, generación de horarios, dashboard, bloqueos, calificaciones, tokens de recuperación y los patrones de diseño (Builder, State, Chain of Responsibility, Template Method, Proxy, Factory Method, Observer, Strategy, Singleton, Decorator y Adapter). El Facade se comprueba reservando contra PostgreSQL real.

## Despliegue en Render

1. Sube el repositorio a GitHub.
2. En [render.com](https://render.com): **New → Blueprint** y elige el repositorio. Render lee `render.yaml` y crea la base de datos y el servicio web.
3. Cuando lo pida, escribe `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `BARBER_DEFAULT_PASSWORD`. `JWT_SECRET` se genera solo.
4. Cuando el servicio esté en «Live», agrega la variable `PUBLIC_URL` con la dirección del sitio.
5. `/health` responde `{"status":"ok"}` si todo funciona.

**Límites del plan gratuito** (consultados en la documentación de Render y Neon; revísalos antes de depender de ellos): el servicio web se duerme tras 15 minutos sin visitas y tarda cerca de un minuto en despertar; la base de datos gratuita de Render vence a los 30 días. Para conservar los datos, usa una base de datos de otro proveedor (por ejemplo Neon, con `DATABASE_SSL=true`).

Con otro hosting (Railway, Fly.io, un VPS): solo necesitas PostgreSQL y las variables de la tabla anterior; el `Dockerfile` está listo.

## Estructura

```
UnderBarber/
├── PLAN_INGENIERIA.md · INFORME_FINAL.md · README.md
├── openspec/            project.md, specs/, changes/ (archive/), CHANGELOG.md
├── frontend/            index.html, privacidad.html, css/, js/, img/
├── backend/
│   ├── src/             server, app, config, db, init, util y routes/ (auth, public, appointments, barber, admin)
│   │   └── services/    quiz.js y slots.js (lógica pura, con pruebas)
│   └── test/            pruebas con node --test
├── database/            schema.sql y seed.sql
├── docs/                ROADMAP.md
└── Dockerfile · docker-compose.yml · render.yaml · .env.example
```

## API (resumen)

| Ruta | Quién |
|---|---|
| `POST /api/auth/register` · `login` · `forgot` · `reset` · `GET /api/auth/me` · `PATCH /api/auth/password` | público / sesión |
| `GET /api/barbers` · `/api/services` · `/api/availability` | público |
| `GET /api/quiz` · `POST /api/quiz/submit` | público |
| `POST /api/appointments` · `GET /mine` · `PATCH /:id/cancel` · `PATCH /:id/reschedule` · `POST /:id/review` | sesión |
| `GET /api/barber/appointments` · `PATCH /status` · `GET/PATCH /profile` · `GET/POST/DELETE /blocks` | barbero |
| `GET /api/admin/stats` · `/dashboard` · `/appointments` · `/services` · `/barbers` | administrador |
| `GET /health` | hosting |

## Seguridad (resumen)

Contraseñas con bcrypt; sesiones JWT con expiración; límites de intentos en login, registro, recuperación, cuestionario y reservas; cabeceras con helmet y CSP estricta; consultas parametrizadas; texto dinámico escapado en el frontend; secretos solo por variables de entorno; en producción el servidor se niega a arrancar con secretos débiles; contenedor sin privilegios de root.

## Trabajo con OpenSpec

La carpeta `openspec/` tiene el contexto (`project.md`), una especificación por capacidad en `specs/`, los cambios ya implementados en `changes/archive/` y el registro cronológico en `openspec/CHANGELOG.md`. Todo cambio funcional se propone primero en `openspec/changes/` (ver `openspec/AGENTS.md`). Con la CLI oficial: `npx @fission-ai/openspec init` y `openspec list`.

## Antes de publicar, personaliza

- `frontend/index.html`: dirección real y número de WhatsApp (busca «Visítanos»).
- `database/seed.sql`: nombres de barberos, biografías, servicios y precios.
- `frontend/privacidad.html`: datos del responsable del tratamiento.
