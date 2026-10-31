# UnderBarber

Página web completa de una barbería: los clientes conocen al equipo, responden un cuestionario que les recomienda el barbero ideal según el corte que quieren, y agendan su cita. Los barberos manejan su agenda y el dueño administra servicios y barberos. Todo es web y está listo para subirse a un hosting.

Especificado con **OpenSpec** (carpeta [`openspec/`](openspec)).

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | HTML + CSS + JavaScript (módulos ES, sin build) |
| Backend | Node.js 20+ y Express (API REST) |
| Base de datos | PostgreSQL 14+ (`pg`) |
| Seguridad | JWT, bcrypt, helmet (CSP), rate limiting, consultas parametrizadas |
| Despliegue | Docker, `render.yaml` (Render), `docker-compose.yml` (local) |

## Qué hace

- **Portada:** pantalla completa con un solo botón «Reservar»; al pulsarlo se abre la página de la barbería. Se muestra una vez por visita. Para usar tu propia foto de fondo, guárdala como `frontend/img/portada.jpg`.
- **Fotos del equipo:** cada barbero tiene su foto en `frontend/img/barbers/` (`fade.jpg`, `classic.jpg`, `creative.jpg`, vertical 4:5, ~640×800). Para cambiarla, reemplaza el archivo con el mismo nombre y vuelve a construir. Si falta, se muestra un emblema.
- **Público:** inicio, carta de servicios y precios, equipo, horarios.
- **Cuestionario «Encuentra tu barbero»:** 6 preguntas; cada respuesta suma puntos a los barberos. Muestra el barbero recomendado, su % de compatibilidad, los motivos y un botón para reservar con él.
- **Cliente:** registro/login, reservar (servicio → barbero → fecha y hora), ver y cancelar sus citas.
- **Barbero:** agenda por día o 7 días, confirmar/completar/cancelar citas, editar su perfil y horario.
- **Administrador:** estadísticas, todas las citas, crear/editar servicios, editar barberos.
- No se pueden cruzar dos citas del mismo barbero (ni con carreras entre dos clientes a la vez).

### Los 3 barberos (nombres de ejemplo)

| Barbero | Especialidad |
|---|---|
| Santiago «Santi» Rojas | Fades y degradados, estilo urbano |
| Andrés Mejía | Clásico, tijera y barba |
| Camilo Vargas | Rizos, texturas, diseños y color |

Cambia los nombres y textos en `database/seed.sql` **antes del primer arranque**, o después desde el panel de administrador (Administración → Barberos: nombre, título, biografía, especialidades y horario).

## Probarlo en tu computador

**Opción A — Docker (lo más fácil):**

```bash
docker compose up --build
# abre http://localhost:3000
```

**Opción B — Node + PostgreSQL instalados:**

```bash
createdb underbarber
cd backend
cp ../.env.example .env      # ajusta DATABASE_URL si hace falta
npm install
npm start                    # http://localhost:3000
```

La primera vez, la app crea las tablas y carga los datos iniciales sola. En desarrollo (`NODE_ENV` distinto de `production`) se crean estas cuentas de prueba:

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@underbarber.com` | `admin12345` |
| Barberos | `santi@`, `andres@`, `camilo@underbarber.com` | `barbero123` |
| Cliente | `cliente@underbarber.com` | `cliente123` |

> En producción **no** se crean cuentas de prueba ni contraseñas por defecto (ver abajo).

## Subirlo a un hosting

### Render (recomendado, tiene plan gratuito)

1. Sube esta carpeta a un repositorio de **GitHub**.
2. En [render.com](https://render.com): **New → Blueprint** y elige el repositorio. Render lee `render.yaml` y crea la base PostgreSQL y el servicio web.
3. Cuando te lo pida, escribe:
   - `ADMIN_EMAIL` y `ADMIN_PASSWORD` (mínimo 8 caracteres): tu acceso de administrador.
   - `BARBER_DEFAULT_PASSWORD`: contraseña inicial de los 3 barberos (cada uno la cambia desde su panel).
4. Espera el despliegue. Tu página queda en `https://underbarber.onrender.com` (o el nombre que Render asigne). `/health` responde `{"status":"ok"}`.

`JWT_SECRET` lo genera Render automáticamente. Revisa en Render los límites vigentes del plan gratuito (por ejemplo, el servicio puede «dormirse» tras un rato sin visitas y la primera carga tarda más).

### Railway, Fly.io, un VPS u otro hosting con Docker o Node

Solo necesitas una base PostgreSQL y estas variables de entorno:

| Variable | Obligatoria en producción | Descripción |
|---|---|---|
| `NODE_ENV` | sí | `production` |
| `DATABASE_URL` | sí | Cadena de conexión de PostgreSQL |
| `DATABASE_SSL` | si tu proveedor lo exige | `true` |
| `JWT_SECRET` | sí | Mínimo 32 caracteres aleatorios |
| `ADMIN_PASSWORD` | sí | Contraseña del administrador (≥ 8) |
| `ADMIN_EMAIL` | no | Por defecto `admin@underbarber.com` |
| `BARBER_DEFAULT_PASSWORD` | recomendada | Si falta, se genera una y se imprime **una vez** en los logs |
| `PORT` | la suele poner el hosting | Por defecto 3000 |

Con Docker: el `Dockerfile` ya está listo. Sin Docker: deja el directorio raíz del servicio en la raíz del repositorio (el backend lee `frontend/` y `database/` desde ahí), con comando de build `cd backend && npm install` y comando de inicio `cd backend && npm start`.

### Dominio propio y HTTPS

Render y Railway dan HTTPS automático; para dominio propio agrégalo en su panel y crea el registro DNS que te indiquen.

### Antes de publicar, personaliza

- `frontend/index.html`: dirección real de la barbería y número de WhatsApp (busca «Visítanos»).
- `database/seed.sql`: nombres de barberos, biografías, servicios y precios.
- Zona horaria: por defecto Colombia (`SHOP_UTC_OFFSET=-05:00`).

## Estructura

```
UnderBarber/
├── openspec/            especificaciones (OpenSpec): project.md, specs/ y changes/
├── frontend/            index.html, css/, js/ (api, ui, quiz, booking, panels, app)
├── backend/
│   ├── src/             server, app, config, db, init y routes/ (auth, public, appointments, barber, admin)
│   │   └── services/    quiz.js y slots.js (lógica pura, con pruebas)
│   └── test/            pruebas con node --test
├── database/            schema.sql y seed.sql
├── Dockerfile · docker-compose.yml · render.yaml · .env.example
```

## Cómo funciona la recomendación

Cada opción de cada pregunta asigna puntos a uno o más barberos (tabla `quiz_option_points`). Se suman los puntos de las 6 respuestas; gana el barbero con más puntos (si empatan, el de mayor compatibilidad y luego el primero de la lista). El porcentaje es los puntos obtenidos sobre el máximo que ese barbero podría lograr. Los puntajes **no** se envían al navegador y se pueden ajustar editando la base de datos sin tocar el código.

## API (resumen)

| Ruta | Quién |
|---|---|
| `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` · `PATCH /api/auth/password` | público / sesión |
| `GET /api/barbers` · `GET /api/services` · `GET /api/availability` | público |
| `GET /api/quiz` · `POST /api/quiz/submit` | público |
| `POST /api/appointments` · `GET /api/appointments/mine` · `PATCH /api/appointments/:id/cancel` | sesión |
| `GET /api/barber/appointments` · `PATCH /api/barber/appointments/:id/status` · `GET/PATCH /api/barber/profile` | barbero |
| `GET /api/admin/stats` · `GET /api/admin/appointments` · `/api/admin/services` · `/api/admin/barbers` | administrador |
| `GET /health` | hosting |

## Pruebas

```bash
cd backend
npm test        # lógica del cuestionario y de horarios (no necesita base de datos)
```

## OpenSpec

La carpeta `openspec/` sigue la estructura de OpenSpec: `project.md`, una spec por capacidad (`auth`, `barbers-services`, `quiz-recommendation`, `appointments`, `landing`, `deployment`) y los cambios archivados en `changes/archive/` (construcción inicial y portada). Para trabajar con la CLI oficial: `npx @fission-ai/openspec init` y `openspec list`. Cualquier cambio futuro (por ejemplo, recordatorios por WhatsApp) se propone primero en `openspec/changes/`.

## Seguridad (resumen)

Contraseñas con bcrypt; sesiones JWT con expiración; límites de intentos en login, registro, cuestionario y reservas; cabeceras con helmet y CSP estricta; consultas parametrizadas; texto dinámico escapado en el frontend; secretos solo por variables de entorno; contenedor sin privilegios de root.
