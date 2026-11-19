# Change: Aplicar 12 patrones de diseño

## Why
El sistema ya funcionaba, pero la lógica de reservas, estados de cita, notificaciones y edición estaba mezclada en las rutas. Se pidió aplicar patrones de diseño reconocidos para que el código sea más claro, ampliable y fácil de probar.

## What Changes
- **ADDED** capability `design-patterns`: 12 patrones (3 creacionales, 4 estructurales, 5 de comportamiento), cada uno con su problema, ubicación y prueba.
- No cambia lo que ve el usuario; cambia la organización interna.
- Restricción del cliente: **sin archivos nuevos por patrón**; todo dentro de los archivos existentes y marcado con `PATRÓN <nombre>`.

## Impact
- Specs afectadas: `design-patterns` (nueva)
- Código: `backend/src/util.js`, `config.js`, `db.js`, `app.js`, `routes/*.js`, `services/quiz.js`
- Pruebas: `backend/test/slots.test.js`, `backend/test/quiz.test.js`
