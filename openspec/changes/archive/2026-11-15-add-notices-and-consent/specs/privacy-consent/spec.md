# Privacy and Consent Specification (delta)

## ADDED Requirements

### Requirement: Autorización al crear la cuenta
El registro SHALL exigir marcar la casilla de autorización y guardar la fecha y hora de aceptación.

#### Scenario: Sin autorización
- **WHEN** se envía el registro sin aceptar, incluso saltándose el formulario
- **THEN** el servidor responde 400 y no crea la cuenta
