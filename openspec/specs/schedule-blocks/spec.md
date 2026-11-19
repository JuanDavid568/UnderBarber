# Schedule Blocks Specification

## Purpose
Bloquear días u horas (vacaciones, festivos, citas médicas) para que no se puedan reservar.

## Requirements

### Requirement: Crear bloqueos
Un barbero SHALL poder bloquear días completos, varios días u horas de un día en su agenda; el administrador SHALL poder hacerlo para un barbero o para toda la barbería.

#### Scenario: Bloqueo propio
- **WHEN** un barbero bloquea un día completo o un rango de horas
- **THEN** el bloqueo se guarda para su agenda y ese tiempo deja de ofrecerse

#### Scenario: Bloqueo global
- **WHEN** el administrador elige «toda la barbería»
- **THEN** el bloqueo aplica a todos los barberos

#### Scenario: Datos inválidos
- **WHEN** la fecha es pasada, el rango supera 60 días o la hora final no es posterior a la inicial
- **THEN** se responde 400

### Requirement: No pisar citas existentes
El sistema SHALL rechazar un bloqueo que se cruce con citas activas.

#### Scenario: Cita en ese horario
- **WHEN** hay citas pendientes o confirmadas dentro del bloqueo
- **THEN** se responde 409 indicando cuántas citas hay y no se crea el bloqueo

### Requirement: Listar y quitar
Un barbero SHALL ver sus bloqueos y los globales, y quitar solo los suyos.

#### Scenario: Quitar un bloqueo global
- **WHEN** un barbero intenta quitar un bloqueo global
- **THEN** se responde 404; solo el administrador puede quitarlo
