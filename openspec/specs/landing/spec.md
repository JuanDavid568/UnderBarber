# Landing Specification

## Purpose
Primera impresión del sitio: una portada a pantalla completa con una sola acción, antes de la página de la barbería.

## Requirements

### Requirement: Portada de entrada
El sitio SHALL mostrar al entrar una portada a pantalla completa con el nombre de la barbería y un único botón «Reservar».

#### Scenario: Primera visita
- **WHEN** una persona abre el sitio sin una sección en la dirección (sin `#...`) y sin haber visto la portada en esta visita
- **THEN** ve solo la portada, con un único control interactivo (el botón «Reservar»), y el resto de la página no es accesible ni se puede desplazar

#### Scenario: Pulsar Reservar
- **WHEN** la persona pulsa «Reservar»
- **THEN** la portada se desvanece, se muestra la página de la barbería y el navegador se sitúa en la sección de reserva

#### Scenario: No repetir la portada
- **WHEN** la persona recarga la página o navega dentro del sitio en la misma visita
- **THEN** la portada no vuelve a mostrarse

#### Scenario: Enlaces directos
- **WHEN** la persona entra con una dirección que incluye una sección (por ejemplo `#reservar` o `#/cuenta`)
- **THEN** la portada se omite y se muestra directamente esa sección

### Requirement: Imagen de portada opcional
La portada SHALL poder usar una foto propia colocada en `frontend/img/portada.jpg`, sin cambiar código.

#### Scenario: Sin foto
- **WHEN** no existe `portada.jpg`
- **THEN** la portada usa el fondo oscuro con la escala de degradado

### Requirement: Primer día con horarios libres
El formulario de reserva SHALL saltar al primer día con horarios libres cuando hoy ya no hay cupo y la persona no ha elegido fecha.

#### Scenario: Entrar de noche
- **WHEN** ya pasó la hora de cierre
- **THEN** la fecha propuesta es el siguiente día con horarios disponibles (hasta 7 días adelante)

### Requirement: Vitrina de barberos
La página de inicio SHALL mostrar una vitrina que rota entre los barberos con su nombre, especialidad y calificación (si la tiene), y un botón «Reservar con…» del barbero visible.

#### Scenario: Rotación automática
- **WHEN** pasan 5 segundos sin interacción
- **THEN** se muestra el siguiente barbero con una transición de cortina

#### Scenario: Pausa y control manual
- **WHEN** el visitante pasa el mouse por la vitrina o pulsa uno de los puntos
- **THEN** la rotación se pausa o salta al barbero elegido, y el botón corresponde a ese barbero

#### Scenario: Movimiento reducido
- **WHEN** el sistema pide `prefers-reduced-motion`
- **THEN** no hay transiciones automáticas y el cambio es solo manual

### Requirement: Logo
El sitio SHALL mostrar el logo en el encabezado, la portada y el ícono de la pestaña.

#### Scenario: Encabezado
- **WHEN** se abre la página
- **THEN** el logo aparece junto al nombre de la barbería
