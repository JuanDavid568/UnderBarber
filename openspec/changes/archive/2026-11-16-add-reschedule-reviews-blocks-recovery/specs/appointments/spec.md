# Appointments Specification (delta)

## ADDED Requirements

### Requirement: Reprogramar cita
El cliente SHALL poder mover su cita `pending` o `confirmed` a otro horario libre; la cita vuelve a `pending`.

#### Scenario: Horario ocupado
- **WHEN** el nuevo horario está ocupado o bloqueado
- **THEN** la API responde 409 y la cita queda como estaba

#### Scenario: Cita ajena o finalizada
- **WHEN** la cita es de otro cliente, o está `completed` o `cancelled`
- **THEN** se rechaza sin cambios
