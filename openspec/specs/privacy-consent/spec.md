# Privacy and Consent Specification

## Purpose
Cumplir la Ley 1581 de 2012: autorización previa, informada y consultable para tratar datos personales.

## Requirements

### Requirement: Autorización al crear la cuenta
El registro SHALL exigir marcar la casilla de autorización de tratamiento de datos y guardar la fecha y hora en que se aceptó.

#### Scenario: Sin autorización
- **WHEN** se envía el registro sin aceptar
- **THEN** el servidor responde 400 y no crea la cuenta, aunque se intente saltar el formulario

#### Scenario: Con autorización
- **WHEN** el visitante marca la casilla
- **THEN** se crea la cuenta y se guarda `data_consent_at`

### Requirement: Política publicada
El sitio SHALL publicar en `/privacidad` la política de tratamiento de datos, enlazada desde la casilla y desde el pie de página.

#### Scenario: Contenido
- **WHEN** se abre la política
- **THEN** informa responsable, datos recogidos, finalidades, destinatarios, derechos, canal y plazos de respuesta, seguridad, conservación y cambios
