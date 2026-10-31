# Appointments Specification

## Purpose
Agendamiento de citas entre clientes y barberos, con agenda para el barbero.

## Requirements

### Requirement: Disponibilidad
El sistema SHALL calcular horarios libres por barbero, servicio y fecha según el horario laboral y las citas activas.

#### Scenario: Horarios del día
- **WHEN** se consulta `GET /api/availability?barberId&serviceId&date`
- **THEN** se devuelven los inicios posibles cada 30 minutos en los que el servicio cabe completo sin cruzar citas ni la hora de cierre

#### Scenario: Día no laborable o pasado
- **WHEN** la fecha es pasada o el barbero no trabaja ese día
- **THEN** la lista de horarios está vacía

#### Scenario: Hoy
- **WHEN** la fecha es hoy
- **THEN** no se ofrecen horarios que ya pasaron ni los próximos 30 minutos

### Requirement: Crear cita
Un cliente autenticado SHALL poder reservar una cita con un barbero y servicio en un horario libre.

#### Scenario: Reserva exitosa
- **WHEN** el horario está libre
- **THEN** se crea la cita con estado `pending` y la hora de fin calculada con la duración del servicio

#### Scenario: Horario ocupado
- **WHEN** el horario se solapa con otra cita no cancelada del mismo barbero
- **THEN** se responde 409 y no se crea la cita, incluso con dos peticiones simultáneas

### Requirement: Mis citas
Un cliente SHALL poder ver y cancelar sus propias citas futuras.

#### Scenario: Cancelar
- **WHEN** el cliente cancela una cita propia pendiente o confirmada y futura
- **THEN** la cita pasa a `cancelled` y el horario queda libre

#### Scenario: Cita ajena
- **WHEN** el cliente intenta cancelar la cita de otra persona
- **THEN** se responde 404

### Requirement: Agenda del barbero
Un barbero SHALL ver sus citas por fecha y cambiar su estado a `confirmed`, `completed` o `cancelled`.

#### Scenario: Confirmar
- **WHEN** el barbero confirma una cita suya
- **THEN** el estado pasa a `confirmed`

#### Scenario: Cita de otro barbero
- **WHEN** un barbero intenta modificar la cita de otro
- **THEN** se responde 404

### Requirement: Vista del administrador
El administrador SHALL ver todas las citas y estadísticas básicas (citas por estado, recomendaciones del quiz por barbero).

#### Scenario: Estadísticas
- **WHEN** el administrador abre su panel
- **THEN** ve totales de citas, clientes y recomendaciones por barbero
