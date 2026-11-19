# Design Patterns Specification (delta)

## ADDED Requirements

### Requirement: Marcado y trazabilidad
Cada patrón SHALL estar identificado en el código con un comentario `PATRÓN <nombre>`.

#### Scenario: Buscar un patrón
- **WHEN** se busca `PATRÓN` en `backend/src`
- **THEN** aparecen los patrones, cada uno junto a la clase o función que lo implementa

### Requirement: Patrones creacionales
El sistema SHALL aplicar Builder (`CitaBuilder`), Factory Method (`FabricaNotificador`) y Singleton (`config`, pool, bus).

#### Scenario: Cita inválida
- **WHEN** `build()` recibe un barbero ausente o una fecha inválida
- **THEN** lanza `HttpError` 400 antes de tocar la base de datos

### Requirement: Patrones estructurales
El sistema SHALL aplicar Proxy (`conCache`), Facade (`ReservaFacade`), Decorator (`wrap`, `query`) y Adapter (`publicBarber`, `shapeAppointment`).

#### Scenario: Reservas simultáneas
- **WHEN** dos clientes toman el mismo horario del mismo barbero a la vez
- **THEN** solo una cita se crea y la otra recibe 409

### Requirement: Patrones de comportamiento
El sistema SHALL aplicar State (`EstadoCita`), Chain of Responsibility (`ManejadorReserva`), Template Method (`ActualizarRecurso`), Observer (`bus`) y Strategy (`ESTRATEGIAS_DESEMPATE`).

#### Scenario: Cadena cortada
- **WHEN** un eslabón de la cadena de reserva falla
- **THEN** los siguientes no se ejecutan

### Requirement: Pruebas automatizadas de los patrones
Cada patrón con lógica propia SHALL tener una prueba en `backend/test/` ejecutable con `npm test`.

#### Scenario: Suite
- **WHEN** se ejecuta `npm test` en `backend/`
- **THEN** pasan las pruebas de los patrones sin base de datos ni red
