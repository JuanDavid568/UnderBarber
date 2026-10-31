# Change: Portada con botón «Reservar»

## Why
El cliente quiere que la primera pantalla sea una portada limpia, con una sola acción, y que después cargue la página de la barbería.

## What Changes
- **ADDED** capability `landing`: portada a pantalla completa con un único botón «Reservar».
- **ADDED** requisito de reserva: saltar al primer día con horarios libres cuando hoy ya no hay.

## Impact
- Specs afectadas: `landing`
- Código: `frontend/index.html`, `frontend/css/styles.css`, `frontend/js/app.js`, `frontend/js/cover-init.js`, `frontend/js/booking.js`
