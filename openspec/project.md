# Project Context

## Purpose
**UnderBarber** es una página web completa para una barbería: los clientes conocen al equipo, hacen un cuestionario
que les recomienda el barbero ideal según el corte que quieren, y agendan su cita. Los barberos gestionan su agenda
y el dueño (admin) administra servicios y barberos. Todo es web y está listo para subirse a un hosting.

## Tech Stack
- **Frontend:** HTML5 + CSS3 + JavaScript (ES modules, sin build), responsive, mobile first.
- **Backend:** Node.js 20+ con Express (API REST, JSON).
- **Base de datos:** PostgreSQL 14+ (driver `pg`).
- **Autenticación:** JWT firmado (HS256) + contraseñas con bcrypt (`bcryptjs`); recuperación de contraseña con token de un solo uso (solo se guarda su hash SHA-256).
- **Correo:** `nodemailer` por SMTP; sin SMTP configurado, el enlace se imprime en los logs (modo desarrollo).
- **Seguridad:** helmet, CORS, rate limiting, consultas parametrizadas, validación de entrada.
- **Despliegue:** Dockerfile + `render.yaml` (Render), variables de entorno (`.env`).

## Project Conventions

### Code Style
- JavaScript moderno (CommonJS en backend, ES modules en frontend), 2 espacios, comillas dobles en backend.
- Nombres de tablas y columnas en inglés `snake_case`; textos visibles al usuario en español (Colombia).
- Errores de la API: `{ "error": "mensaje legible" }` con el código HTTP correcto.

### Architecture Patterns
- **12 patrones de diseño** integrados en el código existente y marcados con el comentario `PATRÓN <nombre>`: Builder, Factory Method y Singleton (creacionales); Proxy, Facade, Decorator y Adapter (estructurales); State, Chain of Responsibility, Template Method, Observer y Strategy (de comportamiento). Detalle, justificación y verificación en `specs/design-patterns/spec.md` y en `PLAN_INGENIERIA.md`.
- Regla: un patrón solo se aplica si resuelve un problema real del sistema, no cambia lo que ve el usuario y tiene una prueba.
- Backend por capas simples: `routes/` (HTTP) → `services/` (reglas de negocio puras y testeables) → `db.js` (SQL).
- El backend también sirve el frontend estático, así que se despliega como **un solo servicio** + base de datos.
- Las reglas del cuestionario (puntos por opción y barbero) viven **en la base de datos**, no en el código.

### Testing Strategy
- Lógica pura (puntajes del quiz, horarios, dashboard, bloqueos, tokens y los patrones) con `node --test` sin dependencias externas: `cd backend && npm test`.
- El esquema y los datos semilla se prueban contra PostgreSQL real.

### Git Workflow
- Rama `main` desplegable (Render redespliega con cada push); cambios propuestos mediante OpenSpec (`openspec/changes/`) y archivados al terminar (`changes/archive/`), con registro en `openspec/CHANGELOG.md`.
- Documentos de proceso en la raíz: `PLAN_INGENIERIA.md` (decisiones y justificación) e `INFORME_FINAL.md` (resultados y conclusiones sobre SDD).

## Domain Context
- Moneda: pesos colombianos (COP), valores enteros. Zona horaria de la barbería: `America/Bogota` (UTC-05:00).
- Tres barberos con especialidades distintas: **fades/degradados**, **clásico y barba**, **creativo/rizos/color**.
- Roles: `client`, `barber`, `admin`.

## Important Constraints
- Nunca guardar contraseñas en texto plano ni secretos en el repositorio (el repositorio es público: el README no lleva credenciales).
- Los patrones de diseño van **dentro de los archivos existentes**, sin crear archivos nuevos por patrón.
- Tratamiento de datos personales conforme a la Ley 1581 de 2012 (autorización obligatoria y política publicada en `/privacidad`).
- Una cita no puede solaparse con otra cita activa del mismo barbero.
- Debe poder iniciarse en un hosting solo con variables de entorno (`DATABASE_URL`, `JWT_SECRET`, …).

## External Dependencies
- Servidor PostgreSQL (administrado por el hosting).
- Google Fonts (tipografías) — opcional, la página funciona con fuentes del sistema si no carga.
