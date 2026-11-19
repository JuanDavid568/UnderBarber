# Reviews Specification

## Purpose
Que el cliente califique el corte y que la calificación ayude a otros clientes y al dueño.

## Requirements

### Requirement: Calificar una cita completada
Un cliente SHALL poder calificar con 1 a 5 estrellas y un comentario opcional (máx. 300 caracteres) una cita propia en estado `completed`.

#### Scenario: Reseña válida
- **WHEN** el cliente califica su cita completada por primera vez
- **THEN** se guarda la reseña y se publica el evento `resena:creada`

#### Scenario: Reglas
- **WHEN** la cita no está completada, no es suya, ya tiene reseña o la calificación no está entre 1 y 5
- **THEN** se responde 409, 404, 409 o 400 respectivamente

### Requirement: Mostrar calificaciones
El promedio y la cantidad de reseñas SHALL mostrarse en las tarjetas del equipo, en la vitrina de la portada y en el dashboard del administrador.

#### Scenario: Sin reseñas
- **WHEN** un barbero aún no tiene reseñas
- **THEN** no se muestra promedio, sin dividir entre cero
