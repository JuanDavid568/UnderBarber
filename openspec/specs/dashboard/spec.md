# Dashboard Specification

## Purpose
Estadísticas para el administrador sobre cortes, ingresos y ocupación.

## Requirements

### Requirement: Panel de estadísticas
El administrador SHALL ver un dashboard con totales, citas por día, por servicio, por barbero, por día de la semana y por hora (en hora de Bogotá).

#### Scenario: Con datos
- **WHEN** el administrador abre «Dashboard»
- **THEN** ve citas, ingresos de citas completadas, ticket promedio, calificación promedio y gráficas dibujadas en SVG

#### Scenario: Sin citas
- **WHEN** no hay citas
- **THEN** todos los valores son cero y no se divide entre cero

#### Scenario: Otros roles
- **WHEN** un cliente o barbero consulta el endpoint
- **THEN** se responde 403
