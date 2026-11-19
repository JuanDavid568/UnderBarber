# Plan de ingeniería — UnderBarber

> **Propósito de este documento:** dejar por escrito, antes de especificar con OpenSpec, qué se va a construir, qué decisiones técnicas se toman y **por qué**. Cada decisión tiene su justificación y cada requisito tiene una forma de verificarse.
>
> **Nota de trazabilidad (honestidad del proceso):** el proyecto nació el 24 de octubre de 2026 con un primer cambio OpenSpec (`2026-10-24-initial-underbarber`, con `proposal.md`, `design.md` y `tasks.md`). Este plan consolida y amplía esas decisiones y fija el criterio para la segunda etapa del trabajo: **aplicar 12 patrones de diseño** sobre el sistema ya funcional. El orden real de los commits puede verificarse con `git log`; este documento no pretende reescribirlo.

## 1. Qué es el sistema (contexto breve)

UnderBarber es una página web para una barbería de Bogotá con tres barberos especialistas. El cliente responde un cuestionario de 6 preguntas que le recomienda un barbero, y agenda su cita en línea. El barbero gestiona su agenda; el administrador gestiona servicios, barberos y ve estadísticas. Todo se despliega como un solo servicio con una base de datos PostgreSQL.

Hallazgos que motivaron el sistema (observación y entrevistas, ver `docs/`): las citas se llevaban en un cuaderno, había cruces de horario, esperas sin información y clientes nuevos que no sabían con qué barbero ir.

## 2. Enfoque de esta etapa: diseño con patrones

El objetivo de ingeniería de esta etapa **no es agregar pantallas**, sino que el código quede organizado con **patrones de diseño** reconocidos, de forma que reservar, validar, notificar y administrar sea fácil de ampliar y de probar.

Reglas que me impuse antes de programar:

1. **Un patrón solo se usa si resuelve un problema concreto del sistema.** No se aplica un patrón "por tenerlo".
2. **Los patrones se integran en el código existente**, no en archivos nuevos por patrón, y cada uno se marca con el comentario `PATRÓN <nombre>` para encontrarlo con una búsqueda (`Ctrl+Shift+F`).
3. **El comportamiento visible para el usuario no cambia** por aplicar un patrón: lo que cambia es la estructura interna.
4. **Cada patrón tiene al menos una forma de verificarse** (prueba automatizada, o prueba contra PostgreSQL cuando depende de la base de datos).

## 3. Decisiones de ingeniería (con justificación)

### 3.1 Decisiones de arquitectura general

| Decisión | Alternativas consideradas | Por qué se eligió |
|---|---|---|
| Node.js + Express para la API | Python/Django, .NET | Mismo lenguaje que el frontend, hosting gratuito abundante, poco código para una API REST |
| PostgreSQL | MySQL, SQLite, MongoDB | Los datos son relacionales (citas ↔ barberos ↔ servicios) y se necesitan transacciones y restricciones de unicidad para evitar dobles reservas; está disponible en planes gratuitos |
| Frontend sin build (HTML + CSS + JS con módulos ES) | React, Vue | Menos piezas que puedan fallar en el hosting; el proyecto es pequeño |
| Un solo servicio que sirve API y frontend | Dos servicios separados | Un único despliegue, sin problemas de CORS, más simple de explicar y de alojar |
| JWT + bcrypt | Sesiones en servidor | Sin estado en el servidor; las contraseñas nunca se guardan en texto plano |
| Reglas del cuestionario en la base de datos | Reglas escritas en el código | El dueño puede ajustar la recomendación sin tocar código |
| Evitar dobles reservas con bloqueo transaccional por barbero + índice único parcial | Solo verificar antes de insertar | La verificación sola falla si dos clientes reservan a la vez; el bloqueo y el índice lo impiden a nivel de base de datos |
| Zona horaria fija `America/Bogota` (UTC-5) | Zona del navegador | La barbería está en un solo lugar y Colombia no tiene horario de verano; evita citas corridas |

### 3.2 Decisiones sobre patrones de diseño (foco de esta etapa)

Para cada patrón: el problema real que había, qué patrón lo resuelve, dónde queda y cómo se verifica.

| # | Patrón (tipo) | Problema real del sistema | Dónde queda | Cómo se verifica |
|---|---|---|---|---|
| 1 | **Builder** (creacional) | Crear una cita exigía validar y normalizar varios datos sueltos (barbero, servicio, notas, hora) repetidos en las rutas | `CitaBuilder` en `backend/src/util.js` | Prueba `Builder`: arma una cita válida y rechaza datos malos |
| 2 | **State** (comportamiento) | Las reglas "qué se puede hacer con una cita según su estado" estaban dispersas en `if` | `EstadoCita` en `util.js`; usado en `routes/barber.js` y `routes/appointments.js` | Pruebas `State`: transiciones y `reprogramable` |
| 3 | **Chain of Responsibility** (comportamiento) | Una reserva debe pasar varias reglas en orden (fecha, horario libre, cruce del cliente, límite) y se querían reutilizar al reprogramar | `ManejadorReserva` en `util.js`; cadena en `routes/appointments.js` | Prueba `Chain`: orden y corte en el primer fallo |
| 4 | **Template Method** (comportamiento) | Editar un servicio y editar el perfil de un barbero seguían el mismo orden (cargar → 404 → validar → guardar → responder) con código repetido | `ActualizarRecurso` en `util.js`; subclases en `routes/admin.js` y `routes/barber.js` | Prueba `Template Method`: orden fijo y 404 |
| 5 | **Proxy** (estructural) | Las listas públicas de barberos y servicios se consultaban a la base de datos en cada visita | `conCache` en `util.js`; usado en `routes/public.js` | Prueba `Proxy`: reutiliza el resultado hasta que se limpia o vence |
| 6 | **Factory Method** (creacional) | Decidir cómo se notifica (consola, memoria, silencio) y cómo se envía el correo no debía estar repartido por el código | `FabricaNotificador` y `crearCorreo` en `util.js` | Pruebas `Factory Method`: crea según el canal y rechaza canales desconocidos |
| 7 | **Observer** (comportamiento) | Al crear, cancelar o reprogramar una cita hay que reaccionar (notificar) sin que la ruta conozca a quien reacciona | `bus`, `publicar`, `registrarObservadores` en `util.js`; registrado en `app.js` | Prueba `Observer`: los eventos llegan y un observador roto no tumba al publicador |
| 8 | **Strategy** (comportamiento) | El criterio de desempate del ranking del cuestionario podía cambiar | `ESTRATEGIAS_DESEMPATE` en `services/quiz.js` | Pruebas `Strategy`: por defecto y alternativa dan órdenes distintos |
| 9 | **Facade** (estructural) | Reservar implica bloquear al barbero, cargar datos, validar, insertar y manejar choques de horario | `ReservaFacade` en `routes/appointments.js` | Reserva real contra PostgreSQL (dos reservas simultáneas → una sola se crea) |
| 10 | **Singleton** (creacional) | La configuración, el pool de conexiones y el bus de eventos deben existir una sola vez | `config.js`, `db.js`, `bus` en `util.js` | Prueba `Singleton`: misma instancia, congelada |
| 11 | **Decorator** (estructural) | Había que reenviar errores de handlers async y avisar de consultas lentas sin tocar el código original | `wrap` en `util.js`; `query` decorada en `db.js` | Prueba `Decorator`: `wrap` reenvía el error a `next()` |
| 12 | **Adapter** (estructural) | La base de datos usa `snake_case` y el frontend `camelCase`; el correo debe poder usar `nodemailer` o consola con la misma interfaz | `publicBarber`, `publicService`, `shapeAppointment`, `CorreoSmtp` en `util.js` | Prueba `Adapter`: fila de la base de datos → JSON del frontend |

**Distribución:** 3 creacionales (Builder, Factory Method, Singleton), 4 estructurales (Proxy, Facade, Decorator, Adapter) y 5 de comportamiento (State, Chain of Responsibility, Template Method, Observer, Strategy). Se buscó variedad de las tres familias para poder explicar cada una con un caso real.

**Patrones que se descartaron** y por qué: *Abstract Factory* y *Prototype* (no había familias de objetos ni clonación que justificaran su complejidad), *Mediator* (el bus de eventos ya cubre la comunicación) y *Command* (no hay deshacer ni colas de acciones).

## 4. Requisitos verificables

Cada requisito se redactará en OpenSpec con escenarios `WHEN/THEN` (ver `openspec/specs/`). Resumen:

| ID | Requisito | Cómo se verifica |
|---|---|---|
| RF-01 | El cliente puede recibir una recomendación de barbero con 6 respuestas | Pruebas de `quiz.test.js` |
| RF-02 | Un cliente puede reservar una cita en un horario libre | Prueba de horarios + reserva real |
| RF-03 | No pueden existir dos citas activas del mismo barbero en el mismo horario, ni con dos clientes a la vez | Prueba de solapes + prueba de concurrencia contra PostgreSQL |
| RF-04 | El cliente puede cancelar y reprogramar según el estado de su cita | Pruebas `State` |
| RF-05 | El barbero confirma, completa y cancela citas; el admin gestiona servicios y barberos | Prueba de transiciones + prueba manual del panel |
| RF-06 | Solo clientes que completaron una cita pueden calificarla, una vez por cita | Prueba contra PostgreSQL (duplicado → 409) |
| RF-07 | Barberos y admin pueden bloquear horarios; un bloqueo funciona como horario ocupado | Pruebas `blockRange` y `generateSlots` |
| RF-08 | El usuario puede recuperar su contraseña con un enlace de un solo uso | Prueba del token + prueba contra PostgreSQL (hash, expiración, reutilización) |
| RF-09 | El registro exige autorización de tratamiento de datos y existe una política publicada | Prueba manual + prueba de la API (`consent`) |
| RF-10 | El admin ve estadísticas (citas por día, servicio, barbero, ingresos, calificación) | Pruebas `buildDashboard` |
| RNF-01 | Contraseñas con bcrypt, JWT con expiración, consultas parametrizadas, CSP estricta | Revisión de código y de cabeceras |
| RNF-02 | En producción el servidor no arranca sin `JWT_SECRET` (≥ 32) ni `ADMIN_PASSWORD` (≥ 8) | Prueba manual de arranque |
| RNF-03 | Cada uno de los 12 patrones está marcado con `PATRÓN` y tiene verificación | Búsqueda en el código + `npm test` |
| RNF-04 | El sistema se puede desplegar con variables de entorno en un hosting con Docker | Despliegue real en Render |

## 5. Flujo de trabajo (SDD con OpenSpec)

1. **Plan de ingeniería** (este documento) → decisiones y justificación.
2. **Especificación** en `openspec/`: `project.md`, una `spec.md` por capacidad y propuestas de cambio en `openspec/changes/`.
3. **Implementación** guiada por las tareas de cada cambio (`tasks.md`), marcadas al completarse.
4. **Verificación**: `npm test` y pruebas manuales contra el sistema desplegado.
5. **Archivo del cambio** en `openspec/changes/archive/` y registro en `openspec/CHANGELOG.md`.

Control de la IA: las instrucciones a la IA se acotan a una tarea de `tasks.md`; las especificaciones fijan lo que **no** debe hacerse (por ejemplo, "sin archivos nuevos por patrón", "sin credenciales en el repositorio público"); y todo resultado se comprueba con las pruebas o ejecutando el sistema, no solo leyendo el código.

## 6. Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Aplicar patrones sin necesidad y complicar el código | Regla 1 de la sección 2; descartar los que no se justifican |
| Doble reserva por concurrencia | Bloqueo transaccional + índice único parcial + prueba concurrente |
| Filtrar secretos en un repositorio público | `.env` en `.gitignore`; el servidor se niega a arrancar con secretos débiles en producción; el README no incluye credenciales |
| Hosting gratuito con límites (web que se duerme, base de datos que vence) | Documentarlo en el README y elegir un proveedor de base de datos más duradero si se necesita continuidad |
| Datos personales de clientes (Ley 1581 de 2012) | Autorización obligatoria al registrarse y política de tratamiento publicada |
