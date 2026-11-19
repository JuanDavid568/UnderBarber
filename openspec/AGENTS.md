# OpenSpec — cómo se trabaja en UnderBarber

Este proyecto se especificó y construyó con el flujo de **OpenSpec** (spec-driven development).

- `openspec/project.md`: contexto, stack, convenciones y restricciones.
- `openspec/specs/<capacidad>/spec.md`: la verdad actual del sistema (requisitos y escenarios `WHEN/THEN`).
- `openspec/changes/<cambio>/`: propuestas de cambio (`proposal.md`, `design.md` opcional, `tasks.md`, deltas de specs).
- `openspec/changes/archive/`: cambios ya implementados, con fecha en el nombre.
- `openspec/CHANGELOG.md`: registro cronológico de los cambios realizados.
- Fuera de esta carpeta: `PLAN_INGENIERIA.md` (se escribe **antes** de especificar) e `INFORME_FINAL.md`.

## Orden de trabajo (SDD)

1. **Plan**: la decisión técnica y su justificación van en `PLAN_INGENIERIA.md`.
2. **Propuesta**: crear `changes/<nombre>/` con `proposal.md` (por qué y qué cambia) y `tasks.md`.
3. **Deltas de specs**: `## ADDED | MODIFIED | REMOVED Requirements`, cada requisito con al menos un escenario verificable.
4. **Implementación** de las tareas, una por una, marcándolas `[x]`.
5. **Verificación** (`npm test` y prueba manual) y **archivo** del cambio en `changes/archive/<fecha>-<nombre>/`.
6. Actualizar la spec correspondiente en `specs/` y añadir una línea en `CHANGELOG.md`.

## Reglas para trabajar con la IA

- Pedir una tarea de `tasks.md` a la vez, citando la spec que la gobierna.
- Las restricciones de `project.md` aplican siempre (sin credenciales en el repo, sin archivos nuevos por patrón, etc.).
- Ningún resultado se da por bueno sin una prueba o sin ejecutarlo.
- Los cambios funcionales se gestionan como cambios OpenSpec, no como ediciones sueltas.

Con la CLI oficial: `npx @fission-ai/openspec init` y `openspec list`.
