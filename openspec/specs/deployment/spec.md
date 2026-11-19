# Deployment Specification

## Purpose
El proyecto debe poder publicarse en un hosting real y no quedarse solo en local.

## Requirements

### Requirement: Configuración por entorno
La aplicación SHALL configurarse únicamente con variables de entorno (`DATABASE_URL`, `JWT_SECRET`, `PORT`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, …).

#### Scenario: Producción sin secreto
- **WHEN** `NODE_ENV=production` y falta `JWT_SECRET` o es débil
- **THEN** la aplicación se niega a iniciar con un mensaje claro

### Requirement: Inicialización automática de la base de datos
Al iniciar, la aplicación SHALL crear las tablas si no existen y cargar los datos semilla solo si la base está vacía.

#### Scenario: Primer arranque
- **WHEN** la base de datos está vacía
- **THEN** se crean tablas, servicios, barberos, preguntas del quiz y las cuentas iniciales

#### Scenario: Reinicios
- **WHEN** la aplicación se reinicia
- **THEN** no se duplican ni se sobrescriben datos existentes

### Requirement: Un solo servicio desplegable
El backend SHALL servir el frontend estático, de modo que un único servicio web más una base PostgreSQL basta.

#### Scenario: Health check
- **WHEN** el hosting consulta `GET /health`
- **THEN** responde 200 si la base de datos es alcanzable

### Requirement: Contenedor
El repositorio SHALL incluir un `Dockerfile` y un `render.yaml` para publicar con un clic.

#### Scenario: Build
- **WHEN** se construye la imagen
- **THEN** instala solo dependencias de producción y arranca con `node src/server.js` como usuario sin privilegios

### Requirement: Despliegue con Blueprint
El repositorio SHALL poder desplegarse en Render con el `render.yaml`, pidiendo por variables de entorno las credenciales y sin guardarlas en el repositorio.

#### Scenario: Primer despliegue
- **WHEN** se crea el Blueprint y se completan `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `BARBER_DEFAULT_PASSWORD`
- **THEN** el servicio queda en línea y `GET /health` responde 200

#### Scenario: Producción sin cuentas de prueba
- **WHEN** `NODE_ENV=production`
- **THEN** no se crean las cuentas de desarrollo
