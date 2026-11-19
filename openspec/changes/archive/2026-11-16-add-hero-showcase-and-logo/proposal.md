# Change: Logo nuevo y vitrina de barberos en la portada

## Why
El cliente quiso un logo propio y que la portada mostrara a los barberos con movimiento en lugar de unas barras decorativas; además, las fotos debían verse más grandes y del mismo tamaño.

## What Changes
- **ADDED** logo en encabezado, portada y pestaña del navegador (`frontend/img/logo.png`, `logo-icon.png`).
- **ADDED** vitrina que rota los barberos cada 5 s, con pausa al pasar el mouse y puntos para elegir.
- **MODIFIED** fotos del equipo más grandes y de igual tamaño.
- Restricción: **no se edita el `index.html` del cliente**; los cambios los aplica `app.js`.

## Impact
- Specs afectadas: `landing`
- Código: `frontend/js/app.js`, `css/styles.css`, `img/`
