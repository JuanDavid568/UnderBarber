# Schedule Blocks Specification (delta)

## ADDED Requirements

### Requirement: Bloquear horarios
Un barbero SHALL poder bloquear días completos o rangos de horas propios, y el administrador los de un barbero o de toda la barbería; un bloqueo cuenta como horario ocupado.

#### Scenario: Citas encima
- **WHEN** hay citas activas en el rango a bloquear
- **THEN** se responde 409 y no se crea el bloqueo

#### Scenario: Efecto en la disponibilidad
- **WHEN** existe un bloqueo
- **THEN** esos horarios dejan de ofrecerse para reservar
