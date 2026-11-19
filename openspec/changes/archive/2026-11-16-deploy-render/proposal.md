# Change: Despliegue en Render

## Why
El sistema debía quedar funcionando en línea y no solo en el computador.

## What Changes
- **ADDED** despliegue real con el `render.yaml` (Blueprint): base PostgreSQL + servicio web Docker.
- **ADDED** guía de variables de entorno y de los límites del plan gratuito en el README.

## Impact
- Specs afectadas: `deployment`
- Código: ninguno (se usó el `render.yaml` y el `Dockerfile` existentes)
