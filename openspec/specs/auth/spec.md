# Auth Specification

## Purpose
Registro e inicio de sesión de clientes, barberos y administrador con roles.

## Requirements

### Requirement: Registro de clientes
El sistema SHALL permitir que un visitante cree una cuenta de cliente con nombre, correo, teléfono (opcional) y contraseña.

#### Scenario: Registro exitoso
- **WHEN** el visitante envía nombre, un correo no usado y una contraseña de al menos 8 caracteres
- **THEN** se crea un usuario con rol `client`, la contraseña se guarda con hash bcrypt y se devuelve un token JWT

#### Scenario: Correo repetido
- **WHEN** el correo ya existe
- **THEN** el sistema responde 409 con un mensaje claro y no crea el usuario

#### Scenario: Datos inválidos
- **WHEN** falta el nombre, el correo es inválido o la contraseña tiene menos de 8 caracteres
- **THEN** el sistema responde 400 indicando el problema

### Requirement: Inicio de sesión
El sistema SHALL autenticar con correo y contraseña y devolver un JWT con expiración.

#### Scenario: Credenciales correctas
- **WHEN** el correo y la contraseña coinciden
- **THEN** se devuelve un token y los datos públicos del usuario (sin el hash)

#### Scenario: Credenciales incorrectas
- **WHEN** el correo no existe o la contraseña no coincide
- **THEN** se responde 401 con el mismo mensaje en ambos casos

### Requirement: Control de acceso por rol
El sistema SHALL restringir rutas según el rol (`client`, `barber`, `admin`).

#### Scenario: Ruta protegida sin token
- **WHEN** se llama a una ruta protegida sin token válido
- **THEN** se responde 401

#### Scenario: Rol insuficiente
- **WHEN** un cliente llama a una ruta de barbero o administrador
- **THEN** se responde 403

### Requirement: Cambio de contraseña
El sistema SHALL permitir a cualquier usuario autenticado cambiar su contraseña indicando la actual.

#### Scenario: Cambio correcto
- **WHEN** la contraseña actual es correcta y la nueva tiene al menos 8 caracteres
- **THEN** se actualiza el hash
