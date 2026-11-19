# Password Recovery Specification (delta)

## ADDED Requirements

### Requirement: Recuperar contraseña
El sistema SHALL enviar un enlace de un solo uso que vence en 60 minutos y solo guardar el hash del token.

#### Scenario: Correo inexistente
- **WHEN** se pide recuperar con un correo no registrado
- **THEN** la respuesta es idéntica a la de un correo registrado

#### Scenario: Token reutilizado o vencido
- **WHEN** se usa un token ya empleado o vencido
- **THEN** se rechaza y la contraseña no cambia
