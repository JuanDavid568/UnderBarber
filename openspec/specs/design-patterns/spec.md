# Design Patterns Specification

## Purpose
UnderBarber aplica **12 patrones de diseño** dentro del código existente (sin archivos nuevos por patrón): cada uno está marcado con un comentario `PATRÓN <nombre>` para poder encontrarlo con una búsqueda. Esta capacidad define **qué problema resuelve cada patrón, dónde vive y cómo se comprueba**. Los patrones no cambian lo que ve el usuario: cambian cómo está organizado el código para que reservar, validar, notificar y administrar sea más fácil de ampliar y de probar.

## Requirements

### Requirement: Marcado y trazabilidad
Cada patrón SHALL estar identificado en el código con un comentario que incluya la palabra `PATRÓN` y su nombre, y listado en el `README.md` con su problema y su ubicación.

#### Scenario: Buscar un patrón
- **WHEN** se busca `PATRÓN` en `backend/src`
- **THEN** aparecen los 12 patrones, cada uno junto a la clase o función que lo implementa

### Requirement: Builder (creacional) — armar una cita paso a paso
La creación de una cita SHALL pasar por `CitaBuilder`, que recibe barbero, servicio, notas e inicio por separado y valida todo en `build()`.

#### Scenario: Datos correctos
- **WHEN** se llaman `barbero()`, `servicio()`, `notas()` e `inicio()` con valores válidos y luego `build()`
- **THEN** se obtiene el objeto `{ barberId, serviceId, notes, startsAt }` ya normalizado

#### Scenario: Datos inválidos
- **WHEN** falta el barbero o el horario no es una fecha válida
- **THEN** `build()` lanza `HttpError` 400 y la ruta no llega a tocar la base de datos

### Requirement: State (comportamiento) — el estado decide qué se puede hacer
El ciclo de vida de una cita SHALL modelarse con `EstadoCita`; cada estado SHALL declarar a cuáles puede pasar y de ahí se derivan `cancelable` y `reprogramable`.

#### Scenario: Transiciones permitidas
- **WHEN** una cita está `pending` o `confirmed`
- **THEN** puede cancelarse y reprogramarse; `pending` puede pasar a `confirmed` y `confirmed` a `completed`

#### Scenario: Estados finales
- **WHEN** una cita está `completed` o `cancelled`
- **THEN** no admite más transiciones ni reprogramación (409 en la API)

### Requirement: Chain of Responsibility (comportamiento) — reglas de reserva encadenadas
Las reglas de una reserva SHALL ser eslabones independientes (`ManejadorReserva`) que se ejecutan en orden y cortan la cadena en el primero que falla: fecha en rango → horario disponible → sin cruce del cliente → límite de citas activas.

#### Scenario: Orden y corte
- **WHEN** un eslabón lanza un error
- **THEN** los eslabones siguientes no se ejecutan y la API responde con el error de ese eslabón

#### Scenario: Reutilización
- **WHEN** se reprograma una cita
- **THEN** se reutiliza la misma cadena sin el eslabón de límite de citas, ya que no se crea una cita nueva

### Requirement: Template Method (comportamiento) — mismo esqueleto para editar
Editar un servicio o un perfil de barbero SHALL usar `ActualizarRecurso.ejecutar()`, que fija el orden cargar → 404 si no existe → validar → guardar → responder; cada subclase implementa solo esos pasos.

#### Scenario: Recurso inexistente
- **WHEN** se intenta editar un id que no existe
- **THEN** se responde 404 sin llegar a validar ni guardar

#### Scenario: Orden fijo
- **WHEN** se ejecuta el esqueleto
- **THEN** los pasos se llaman siempre en el mismo orden, sin importar la subclase

### Requirement: Proxy (estructural) — caché de las listas públicas
Las listas públicas de barberos y servicios SHALL servirse mediante `conCache()`, un sustituto con la misma interfaz que la consulta original que reutiliza el resultado durante un tiempo limitado.

#### Scenario: Reutilización
- **WHEN** se piden dos veces las listas dentro del tiempo de vida de la caché
- **THEN** la segunda vez no consulta la base de datos

#### Scenario: Invalidación
- **WHEN** el administrador o un barbero edita datos públicos, o se crea una reseña
- **THEN** `limpiarCachesPublicos()` vacía las cachés y la siguiente consulta ve los datos nuevos

### Requirement: Factory Method (creacional) — quién notifica se decide en un solo lugar
El canal de notificación SHALL crearse con `FabricaNotificador.para(canal)` (`consola`, `memoria`, `silencio`) y el canal de correo con `crearCorreo()` (consola o SMTP); quien los usa solo conoce `notificar()` o `enviar()`.

#### Scenario: Canal válido
- **WHEN** se pide el canal `memoria`
- **THEN** se obtiene un notificador que guarda los mensajes (útil en pruebas)

#### Scenario: Canal desconocido
- **WHEN** se pide un canal que no existe
- **THEN** se lanza un error claro en el arranque

### Requirement: Observer (comportamiento) — reaccionar a hechos sin acoplarse
Las rutas SHALL publicar eventos (`cita:creada`, `cita:cancelada`, `cita:estado`, `cita:reprogramada`, `resena:creada`) en un bus único, y los observadores registrados SHALL reaccionar sin que las rutas los conozcan.

#### Scenario: Evento entregado
- **WHEN** se crea una cita
- **THEN** el notificador recibe un mensaje con la cita, el servicio, el barbero y la hora

#### Scenario: Observador roto
- **WHEN** un observador lanza una excepción
- **THEN** `publicar()` la registra y la petición del cliente continúa sin fallar

### Requirement: Strategy (comportamiento) — criterio de desempate intercambiable
`scoreQuiz` SHALL recibir como parámetro la estrategia de ordenamiento del ranking (`puntosPrimero` por defecto, `compatibilidadPrimero`).

#### Scenario: Por defecto
- **WHEN** no se indica estrategia
- **THEN** se usa `puntosPrimero`, el comportamiento original

#### Scenario: Cambiar la estrategia
- **WHEN** se pasa `compatibilidadPrimero`
- **THEN** el ranking puede salir en otro orden sin modificar `scoreQuiz`

### Requirement: Facade (estructural) — una sola puerta para reservar
`ReservaFacade.reservar()` y `ReservaFacade.reprogramar()` SHALL ocultar el bloqueo del barbero, la carga de datos, la cadena de validaciones, la inserción y el manejo del choque de horarios.

#### Scenario: Una llamada
- **WHEN** la ruta recibe una reserva
- **THEN** llama una sola vez a la fachada y esta devuelve el id de la cita o lanza un `HttpError`

#### Scenario: Dos reservas simultáneas
- **WHEN** dos clientes toman el mismo horario del mismo barbero a la vez
- **THEN** solo una se crea y la otra recibe 409

### Requirement: Singleton (creacional) — una sola instancia compartida
La configuración (`config`), el pool de conexiones (`db.js`) y el bus de eventos SHALL existir una sola vez por proceso.

#### Scenario: Misma instancia
- **WHEN** dos módulos hacen `require` de `config`
- **THEN** reciben el mismo objeto, que está congelado y no se puede modificar

### Requirement: Decorator (estructural) — añadir comportamiento sin tocar el original
`wrap()` SHALL envolver los handlers async para reenviar errores a Express, y `query()` SHALL envolver la consulta a la base de datos para avisar de las consultas lentas.

#### Scenario: Error en un handler
- **WHEN** un handler async lanza un error
- **THEN** `wrap` lo entrega a `next(err)` y el handler original queda sin cambios

#### Scenario: Consulta lenta
- **WHEN** una consulta supera el umbral configurado
- **THEN** se escribe una advertencia en el log y el resultado se devuelve igual

### Requirement: Adapter (estructural) — adaptar interfaces distintas
`publicBarber`, `publicService` y `shapeAppointment` SHALL adaptar las filas de la base de datos (snake_case) al JSON que consume el frontend (camelCase), y `CorreoSmtp` SHALL adaptar `nodemailer` a la interfaz `enviar()`.

#### Scenario: Fila a JSON
- **WHEN** se adapta un barbero
- **THEN** el resultado usa `name`, `specialtyKey`, `workStart` y no expone columnas internas

### Requirement: Pruebas automatizadas de los patrones
Cada patrón con lógica propia SHALL tener una prueba en `backend/test/` que se ejecute con `npm test`, sin base de datos ni red.

#### Scenario: Ejecutar la suite
- **WHEN** se ejecuta `npm test` en `backend/`
- **THEN** se ejecutan las pruebas de Builder, State, Chain, Template Method, Proxy, Factory, Observer, Strategy, Singleton, Decorator y Adapter; el Facade se comprueba con una reserva real contra PostgreSQL
