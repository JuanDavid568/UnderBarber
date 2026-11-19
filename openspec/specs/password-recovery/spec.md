# Password Recovery Specification

## Purpose
Recuperar el acceso a la cuenta sin exponer si un correo existe.

## Requirements

### Requirement: Solicitar enlace
Cualquier visitante SHALL poder pedir un enlace de recuperación con su correo.

#### Scenario: Respuesta uniforme
- **WHEN** se solicita el enlace con un correo existente o inexistente
- **THEN** la respuesta es idéntica, para no revelar qué correos tienen cuenta

#### Scenario: Token seguro
- **WHEN** se genera el enlace
- **THEN** el token es aleatorio (32 bytes), solo se guarda su hash SHA-256, vence a los 60 minutos y reemplaza los tokens anteriores sin usar

### Requirement: Restablecer contraseña
Quien tenga un token válido SHALL poder fijar una contraseña nueva (mínimo 8 caracteres).

#### Scenario: Token válido
- **WHEN** el token es vigente y no se ha usado
- **THEN** se actualiza el hash de la contraseña y el token queda inutilizable

#### Scenario: Token vencido, usado o inventado
- **WHEN** el token no es válido
- **THEN** se responde 400 y la contraseña no cambia

### Requirement: Envío por correo
El enlace SHALL enviarse por SMTP cuando `SMTP_HOST` está configurado; si no, se imprime en el log del servidor.

#### Scenario: Sin SMTP
- **WHEN** no hay `SMTP_HOST`
- **THEN** el enlace aparece en los logs (solo para desarrollo o demostración)
