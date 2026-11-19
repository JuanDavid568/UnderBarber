# Design

## Decisión
Render con Blueprint: crea base de datos y servicio con un clic y da HTTPS automático.

## Límites del plan gratuito (consultados en la documentación de Render y Neon el 16 de noviembre de 2026)
- El servicio web se duerme tras 15 minutos sin visitas y tarda cerca de 1 minuto en despertar.
- La base PostgreSQL gratuita de Render **vence a los 30 días** (14 días de gracia y luego se elimina).
- Alternativa evaluada: Neon para la base de datos (no vence a los 30 días; se suspende tras 5 minutos de inactividad).
