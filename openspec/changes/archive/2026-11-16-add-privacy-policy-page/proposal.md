# Change: Página de política de tratamiento de datos

## Why
La casilla de autorización debe enlazar a una política que diga qué datos se guardan, para qué, quién los ve y cómo ejercer los derechos (Ley 1581 de 2012).

## What Changes
- **ADDED** `frontend/privacidad.html`, servida en `/privacidad`.
- **MODIFIED** la casilla de autorización y el pie de página enlazan a ella; la casilla la agrega `app.js` si el HTML no la trae.

## Impact
- Specs afectadas: `privacy-consent`
- Código: `frontend/privacidad.html`, `frontend/js/app.js`, `css/styles.css`
