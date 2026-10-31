# Quiz Recommendation Specification

## Purpose
Cuestionario "Encuentra tu barbero" que recomienda al barbero cuya especialidad mejor encaja con lo que el cliente quiere.

## Requirements

### Requirement: Cuestionario
El sistema SHALL ofrecer un cuestionario de 6 preguntas de opción única, definido en la base de datos.

#### Scenario: Obtener preguntas
- **WHEN** se consulta `GET /api/quiz`
- **THEN** se devuelven las preguntas con sus opciones, **sin** exponer los puntajes

### Requirement: Puntaje por barbero
Cada opción SHALL asignar puntos a uno o más barberos. El barbero con más puntos totales es el recomendado.

#### Scenario: Recomendación clara
- **WHEN** el cliente responde todas las preguntas
- **THEN** el sistema suma los puntos por barbero y devuelve el barbero ganador, un porcentaje de compatibilidad y el segundo mejor

#### Scenario: Empate
- **WHEN** dos barberos tienen el mismo puntaje
- **THEN** gana el de mayor posición en la lista (orden estable y determinista)

### Requirement: Explicación de la recomendación
La respuesta SHALL incluir los motivos: las respuestas del cliente que más puntos dieron al barbero recomendado.

#### Scenario: Motivos
- **WHEN** se devuelve la recomendación
- **THEN** incluye hasta 3 respuestas del cliente que justifican la elección

### Requirement: Validación de respuestas
El sistema SHALL rechazar respuestas incompletas, repetidas o con opciones que no pertenecen a la pregunta.

#### Scenario: Faltan respuestas
- **WHEN** se envían menos respuestas que preguntas
- **THEN** se responde 400

### Requirement: Reserva directa desde el resultado
El resultado SHALL permitir iniciar la reserva con el barbero recomendado preseleccionado.

#### Scenario: Botón de reservar
- **WHEN** el cliente pulsa "Reservar con este barbero"
- **THEN** el formulario de reserva se abre con ese barbero seleccionado

### Requirement: Registro de resultados
El sistema SHALL guardar cada resultado (respuestas, puntajes, barbero) para estadísticas del administrador.

#### Scenario: Usuario anónimo
- **WHEN** quien responde no ha iniciado sesión
- **THEN** el resultado se guarda sin `user_id`
