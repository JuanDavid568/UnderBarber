# Deployment Specification (delta)

## ADDED Requirements

### Requirement: Despliegue con Blueprint
El repositorio SHALL poder desplegarse en Render con el `render.yaml`, pidiendo por variables de entorno las credenciales y sin guardarlas en el repositorio.

#### Scenario: Primer despliegue
- **WHEN** se crea el Blueprint y se completan `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `BARBER_DEFAULT_PASSWORD`
- **THEN** el servicio queda en línea y `GET /health` responde 200

#### Scenario: Producción sin cuentas de prueba
- **WHEN** `NODE_ENV=production`
- **THEN** no se crean las cuentas de desarrollo
