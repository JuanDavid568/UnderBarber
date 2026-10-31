# OpenSpec — cómo se trabaja en UnderBarber

Este proyecto se especificó y construyó con el flujo de **OpenSpec** (spec-driven development).

- `openspec/project.md`: contexto, stack y convenciones.
- `openspec/specs/<capacidad>/spec.md`: la verdad actual del sistema (requisitos y escenarios).
- `openspec/changes/<cambio>/`: propuestas de cambio (`proposal.md`, `design.md`, `tasks.md`, deltas de specs).
- `openspec/changes/archive/`: cambios ya implementados. El primero, `2026-10-24-initial-underbarber`, es la construcción inicial.

Flujo para un cambio nuevo: crear `changes/<nombre>/` con propuesta + tareas + deltas (`## ADDED|MODIFIED|REMOVED Requirements`),
implementar las tareas, y archivar el cambio al terminar. Con la CLI oficial: `npx @fission-ai/openspec init` y `openspec list`.
