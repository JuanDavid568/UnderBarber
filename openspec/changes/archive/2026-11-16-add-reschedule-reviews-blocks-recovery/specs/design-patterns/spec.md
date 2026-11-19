# Design Patterns Specification (delta)

## MODIFIED Requirements

### Requirement: State (comportamiento) — el estado decide qué se puede hacer
Cada estado SHALL declarar a cuáles puede pasar, y de ahí se derivan `cancelable` y `reprogramable`.

#### Scenario: Reprogramación
- **WHEN** una cita está `pending` o `confirmed`
- **THEN** es reprogramable; `completed` y `cancelled` no

### Requirement: Observer (comportamiento) — reaccionar a hechos sin acoplarse
Las rutas SHALL publicar también `cita:reprogramada` y `resena:creada`.

#### Scenario: Evento nuevo
- **WHEN** se reprograma una cita
- **THEN** los observadores reciben `cita:reprogramada`

### Requirement: Factory Method (creacional) — quién notifica se decide en un solo lugar
`crearCorreo()` SHALL elegir entre correo por consola y SMTP.

#### Scenario: Sin SMTP
- **WHEN** no hay `SMTP_HOST`
- **THEN** se usa el correo de consola
