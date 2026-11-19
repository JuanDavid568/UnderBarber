# Reviews Specification (delta)

## ADDED Requirements

### Requirement: Calificar una cita completada
El cliente SHALL poder calificar con 1 a 5 estrellas (y comentario de hasta 300 caracteres) una cita completada propia, una sola vez.

#### Scenario: Duplicada
- **WHEN** se califica dos veces la misma cita
- **THEN** la segunda recibe 409

#### Scenario: Cita no completada
- **WHEN** se intenta calificar una cita pendiente
- **THEN** se rechaza
