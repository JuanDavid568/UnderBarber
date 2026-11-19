# Design

## Criterio de selección
Un patrón se aplica solo si resuelve un problema que ya existía en el código. Se descartaron Abstract Factory, Prototype, Mediator y Command por no tener un caso real.

## Decisiones
| Patrón | Problema que resuelve | Dónde |
|---|---|---|
| Builder | Armar y validar una cita con varios datos sueltos | `CitaBuilder` (`util.js`) |
| State | Reglas de qué se puede hacer según el estado de la cita | `EstadoCita` (`util.js`) |
| Chain of Responsibility | Reglas de reserva en orden y reutilizables | `ManejadorReserva` (`util.js`), cadena en `appointments.js` |
| Template Method | Mismo esqueleto para editar servicios y perfiles | `ActualizarRecurso` (`util.js`) |
| Proxy | Evitar consultar la base en cada visita a las listas públicas | `conCache` (`util.js`), `public.js` |
| Factory Method | Elegir el canal de notificación en un solo lugar | `FabricaNotificador` (`util.js`) |
| Observer | Reaccionar a eventos de citas sin acoplar las rutas | `bus`, `publicar`, `registrarObservadores` |
| Strategy | Criterio de desempate del ranking intercambiable | `ESTRATEGIAS_DESEMPATE` (`quiz.js`) |
| Facade | Una sola puerta para reservar | `ReservaFacade` (`appointments.js`) |
| Singleton | Una sola configuración, un solo pool, un solo bus | `config.js`, `db.js`, `util.js` |
| Decorator | Reenviar errores async y avisar de consultas lentas | `wrap` (`util.js`), `query` (`db.js`) |
| Adapter | Pasar de filas `snake_case` al JSON `camelCase` | `publicBarber`, `shapeAppointment` (`util.js`) |

## Riesgos
- Complejidad innecesaria → cada patrón tiene una justificación y una prueba.
- Romper el comportamiento existente → las pruebas del cuestionario y de horarios se ejecutan antes y después.
