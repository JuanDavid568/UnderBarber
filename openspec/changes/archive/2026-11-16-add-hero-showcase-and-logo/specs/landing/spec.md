# Landing Specification (delta)

## ADDED Requirements

### Requirement: Vitrina de barberos
La página de inicio SHALL mostrar una vitrina que rota entre los barberos con su nombre y especialidad.

#### Scenario: Rotación automática
- **WHEN** pasan 5 segundos sin interacción
- **THEN** se muestra el siguiente barbero

#### Scenario: Pausa y control manual
- **WHEN** el visitante pasa el mouse por la vitrina o pulsa uno de los puntos
- **THEN** la rotación se pausa o salta al barbero elegido, y el botón «Reservar con…» corresponde a ese barbero

#### Scenario: Movimiento reducido
- **WHEN** el sistema pide `prefers-reduced-motion`
- **THEN** no hay transiciones y el cambio es solo manual

### Requirement: Logo
El sitio SHALL mostrar el logo en el encabezado, la portada y el ícono de la pestaña.

#### Scenario: Encabezado
- **WHEN** se abre la página
- **THEN** el logo aparece junto al nombre de la barbería
