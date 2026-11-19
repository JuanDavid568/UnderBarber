# Change: Avisos de sesión, autorización de datos y fotos uniformes

## Why
Las páginas reales avisan al entrar y salir; la ley colombiana (1581 de 2012) exige autorización previa para tratar datos; y las fotos del equipo tenían fondos y tamaños distintos.

## What Changes
- **ADDED** aviso no bloqueante «Bienvenido, <nombre>» al iniciar sesión y «Sesión cerrada» al salir.
- **ADDED** casilla obligatoria de autorización de datos en el registro; el servidor la exige y guarda `data_consent_at`.
- **MODIFIED** fotos del equipo: mismo tamaño (4:5) sobre fondo negro.

## Impact
- Specs afectadas: `auth`, `privacy-consent`, `barbers-services`
- Código: `frontend/js/ui.js`, `app.js`, `css/styles.css`, `backend/src/routes/auth.js`, `database/schema.sql`
