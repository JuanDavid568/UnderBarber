# Informe final — UnderBarber

## 1. Resumen

UnderBarber es una página web para una barbería de Bogotá: el cliente responde un cuestionario que le recomienda un barbero y agenda su cita; el barbero gestiona su agenda; el administrador gestiona servicios, barberos y estadísticas. El sistema está desplegado en Render con PostgreSQL.

Este informe se centra en la **segunda etapa del trabajo: aplicar 12 patrones de diseño** sobre el sistema ya funcional, gestionando los cambios con OpenSpec. Evalúa si los patrones aportaron valor, qué problemas aparecieron, qué decisiones cambiaron frente al plan y qué enseña el proceso sobre el desarrollo guiado por especificaciones (SDD).

Documentos relacionados: [`PLAN_INGENIERIA.md`](PLAN_INGENIERIA.md), [`openspec/`](openspec) y [`README.md`](README.md).

## 2. Resultados

### 2.1 Qué se logró

- **12 patrones de diseño** integrados en el código existente y marcados con `PATRÓN <nombre>`, sin archivos nuevos por patrón (3 creacionales, 4 estructurales, 5 de comportamiento).
- **Sistema funcional** con: cuestionario de recomendación, reservas sin cruces, reprogramación, calificaciones, bloqueos de horario, recuperación de contraseña, dashboard del administrador, autorización de datos con política publicada, logo y vitrina de barberos.
- **Despliegue real** en Render (Blueprint con base de datos PostgreSQL y servicio Docker).
- **OpenSpec** actualizado: 12 especificaciones por capacidad, 10 cambios archivados y un registro cronológico (`openspec/CHANGELOG.md`).

### 2.2 Verificación

| Qué se verificó | Cómo | Resultado |
|---|---|---|
| Lógica pura y patrones | `cd backend && npm test` (`node --test`, sin base de datos ni red) | 33 pruebas pasaron |
| Reservas, reprogramación, calificaciones, bloqueos, recuperación de contraseña y dashboard | Pruebas de la API contra PostgreSQL real, con un arnés temporal que **no forma parte del repositorio** | 49 de 49 comprobaciones pasaron |
| Interfaz (avisos, casilla de datos, dashboard, reprogramar, calificar, bloqueos, vitrina, política) | Pruebas automatizadas en un navegador, con la API simulada | Sin errores de consola |
| Despliegue | Render en estado «Live» y recorrido manual | Funcionando; el recorrido completo de roles queda para la sustentación |

### 2.3 Trazabilidad de los patrones (requisito → verificación)

| Patrón | Qué se comprueba | Prueba |
|---|---|---|
| Builder | Cita válida normalizada; datos malos rechazados con 400 | `slots.test.js` → «Builder» |
| State | Transiciones permitidas y `reprogramable` | «State» (dos pruebas) |
| Chain of Responsibility | Orden de los eslabones y corte en el primer fallo | «Chain of Responsibility» |
| Template Method | Orden fijo de los pasos y 404 si el recurso no existe | «Template Method» |
| Proxy | Reutiliza el resultado hasta que se limpia o vence | «Proxy» |
| Factory Method | Crea según el canal y rechaza canales desconocidos | «Factory Method» y «Factory Method + Adapter» |
| Observer | Los eventos llegan y un observador roto no tumba al publicador | «Observer» |
| Strategy | Estrategia por defecto y alternativa dan órdenes distintos | `quiz.test.js` → «Strategy» (dos pruebas) |
| Singleton | Misma instancia, congelada | «Singleton» |
| Decorator | `wrap` reenvía el error a `next()` sin cambiar el handler | «Decorator» |
| Adapter | Fila de la base de datos → JSON del frontend | «Adapter» |
| Facade | Dos reservas simultáneas: una se crea y la otra recibe 409 | Prueba contra PostgreSQL |

## 3. Análisis de los patrones: ¿ayudaron?

Una conclusión importante del trabajo es que **no todos los patrones aportaron lo mismo**. Es más útil reconocerlo que defender los 12 por igual.

| Patrón | Valor real | Comentario |
|---|---|---|
| **Chain of Responsibility** | Alto | Al llegar la reprogramación se **reutilizó la misma cadena** quitando un eslabón, en vez de duplicar reglas. Es el caso que más justificó un patrón |
| **State** | Alto | Centralizó qué se puede hacer con una cita; al añadir «reprogramar» bastó con declararlo en los estados |
| **Observer** | Alto | Añadir eventos (`cita:reprogramada`, `resena:creada`) no tocó las rutas que ya existían |
| **Facade** | Alto | Una sola llamada oculta bloqueo, validaciones, inserción y el manejo del choque de horarios; la complejidad de la concurrencia quedó en un solo lugar |
| **Template Method** | Medio | Quitó código repetido entre editar servicios y editar perfiles |
| **Adapter** | Medio | Separa el formato de la base de datos del que usa el frontend; también permitió usar `nodemailer` o consola con la misma interfaz |
| **Proxy (caché)** | Medio | Reduce consultas en las listas públicas; exige acordarse de invalidar la caché al editar datos |
| **Builder** | Medio | Aporta orden y validación, aunque la cita tiene pocos campos |
| **Decorator** | Medio | `wrap` evita repetir `try/catch` en cada handler |
| **Factory Method** | Bajo-medio | Hoy hay pocas variantes (consola, memoria, silencio; consola o SMTP); su valor crece si se añade WhatsApp |
| **Strategy** | Bajo | Hay dos estrategias y una sola en uso; es un buen ejemplo didáctico, pero no resuelve un problema urgente |
| **Singleton** | Bajo | En Node, un módulo ya se carga una sola vez; el patrón casi viene gratis, y el riesgo es abusar del estado global |

Lección: los patrones fueron más valiosos donde **el sistema cambió después** (reprogramar, calificar, bloquear). Aplicados sobre código que no iba a cambiar, solo añaden indirección.

## 4. Dificultades encontradas

| Dificultad | Cómo se resolvió |
|---|---|
| **Doble reserva con dos clientes a la vez**: verificar y luego insertar no basta | Bloqueo transaccional por barbero, recálculo de horarios dentro de la transacción e índice único parcial en la base de datos; se probó con reservas simultáneas |
| **Zona horaria**: las fechas guardadas en UTC se veían corridas | Zona fija `America/Bogota` configurable con `SHOP_UTC_OFFSET`; funciones puras y probadas para los límites del día |
| **CSP estricta** (sin scripts ni estilos incrustados) limitaba los gráficos y los componentes dinámicos | Gráficas dibujadas en SVG con clases CSS y estilos aplicados con `style.setProperty` |
| **Mi `index.html` y el del cliente eran distintos**; la casilla de autorización no aparecía en producción | La casilla y los enlaces de la política los inyecta ahora `app.js` si el HTML no los trae; se evitó sobrescribir el archivo del cliente |
| **Dependencia nueva (`nodemailer`) con un `package-lock.json` antiguo** puede romper el build de Docker | Se documentó borrar el `package-lock.json` y reconstruir |
| **Límites del hosting gratuito**: la web se duerme y la base de datos de Render vence a los 30 días | Se documentó en el README y se evaluó Neon como alternativa |
| **Confusión al probar**: una cita para mañana «no aparecía» al entrar como barbero | La agenda abre en el día actual; basta con marcar «Ver 7 días». Quedó registrado como mejora pendiente (abrir en 7 días por defecto) |
| **Fotos con fondos y tamaños distintos** | Mismo tamaño 4:5 con CSS; fondo negro por tratamiento de imagen. El recorte automático tiene límites de calidad y lo ideal es usar las fotos originales |
| **Credenciales en un repositorio público** | El README no incluye contraseñas; en producción las cuentas de prueba no existen y el servidor no arranca con secretos débiles |

## 5. Decisiones que cambiaron respecto al plan

| Decisión inicial | Decisión final | Motivo |
|---|---|---|
| Un archivo por patrón (organización inicial propuesta) | Patrones **dentro del código existente**, marcados con `PATRÓN <nombre>` | Restricción del cliente: no añadir archivos; además es más fácil seguir el flujo real del código |
| Patrones solo en la lógica de reservas | También en edición (Template Method), correo (Factory y Adapter), recuperación y calificaciones (Observer) | Al llegar nuevas funciones aparecieron nuevos casos reales para reutilizar los patrones |
| Reprogramar con reglas propias | Reutilizar la Chain of Responsibility de la reserva | Evita duplicar reglas y garantiza que ambos caminos validen lo mismo |
| Barras decorativas en la portada | Vitrina animada de barberos y logo propio | Petición del cliente; muestra al equipo y evita una portada genérica |
| Política de privacidad como mejora futura (estaba en el roadmap) | Página `/privacidad` enlazada desde el registro | La casilla de autorización no tenía sentido sin una política publicada |
| Credenciales de prueba visibles en la documentación | Quitadas del README público | El repositorio es público |
| Base de datos de Render como destino definitivo | Documentar su vencimiento a 30 días y la alternativa Neon | Se verificó el límite en la documentación oficial |

## 6. Conclusiones sobre el uso de SDD con OpenSpec

### 6.1 Ventajas observadas

- **Las restricciones quedan por escrito.** «Sin archivos nuevos por patrón» y «sin credenciales en el repositorio» viven en `project.md` y se aplican a todo cambio; con instrucciones sueltas habría que repetirlas.
- **Cada cambio tiene alcance.** El `tasks.md` acota qué se pide a la IA, lo que reduce que implemente funciones no pedidas.
- **Los requisitos son verificables.** Los escenarios `WHEN/THEN` se tradujeron directamente en pruebas (por ejemplo, el corte de la cadena o la reserva simultánea).
- **Hay memoria del proyecto.** El registro de cambios y las especificaciones permitieron retomar el trabajo después de pausas largas sin reconstruir el contexto.

### 6.2 Limitaciones observadas

- **Más trabajo inicial** para cambios pequeños: escribir propuesta, tareas y deltas cuesta tiempo cuando el cambio es una línea.
- **Las especificaciones pueden quedar desfasadas** si no se actualizan con el código; hubo que revisar `specs/` al final.
- **El orden ideal (plan → especificación → código) no siempre se cumplió con rigor**: en varios cambios de noviembre la especificación se documentó durante o después de la implementación. Para cumplirlo de verdad, hay que escribir la propuesta antes de pedir el código. El historial de Git muestra el orden real.
- **La especificación no reemplaza la verificación.** La IA produjo código que parecía correcto y fallaba al ejecutarlo (por ejemplo, detalles de la CSP); solo las pruebas y la ejecución real lo mostraron.
- **La estructura de OpenSpec se siguió manualmente**: no se ejecutó una validación automática con la CLI oficial.

### 6.3 SDD frente a instrucciones directas a una IA

| Aspecto | Solo instrucciones directas | SDD con OpenSpec |
|---|---|---|
| Velocidad en cambios pequeños | Mayor | Menor |
| Consistencia entre cambios | Depende de repetir el contexto | Alta: el contexto vive en `project.md` y `specs/` |
| Control del alcance | Bajo: la IA puede añadir de más | Alto: las tareas lo limitan |
| Trazabilidad (qué cambió y por qué) | Se pierde en el chat | Queda en `changes/archive/` y `CHANGELOG.md` |
| Verificación | Informal | Escenarios que se convierten en pruebas |
| Riesgo | Código sin justificación | Burocracia si se exagera |

**Conclusión personal:** SDD vale la pena cuando el proyecto va a crecer o a retomarse, como este. Para un ajuste mínimo es excesivo. Lo más valioso no fue la herramienta sino la disciplina: justificar cada decisión, escribir requisitos comprobables y exigir una prueba antes de dar algo por terminado.

## 7. Limitaciones y trabajo futuro

- Cambiar la contraseña no cierra las sesiones ya abiertas.
- Agenda del barbero: abrirla en 7 días por defecto.
- Botón para que el cliente elimine su cuenta (hoy se pide por el canal de contacto de la política).
- Pasar la base de datos a un proveedor que no venza.
- Configurar SMTP real (hoy, sin SMTP, el enlace de recuperación sale en los logs).
- Fotos originales de mayor resolución para la vitrina.
- La política de datos es una base para un proyecto académico; para uso real conviene revisión legal.

## 8. Guía para la sustentación

Respuestas base apoyadas en este repositorio; conviene explicarlas con tus propias palabras.

1. **¿Qué decisiones de ingeniería tomó antes de programar?** Stack (Node, Express, PostgreSQL, frontend sin build) con alternativas descartadas, reglas del cuestionario en la base de datos, control de dobles reservas con bloqueo transaccional e índice único, zona horaria fija, y para los patrones: usarlos solo si resuelven un problema real. Está en `PLAN_INGENIERIA.md`, secciones 3 y 4.
2. **¿Qué problemas identificó al pasar de la propuesta a las especificaciones?** Los requisitos debían ser verificables, lo que obligó a redactar escenarios `WHEN/THEN`; la concurrencia de reservas; dónde marcar los patrones sin crear archivos; y que la casilla de autorización exigía una política publicada.
3. **¿Cómo evitó que la IA implementara funcionalidades incorrectas?** Acotando cada petición a una tarea, dejando las restricciones por escrito en `project.md`, exigiendo pruebas y ejecución real, y revisando los resultados (por ejemplo, la casilla que no aparecía en producción se detectó probando la página desplegada).
4. **¿Qué diferencias encontró entre la planificación inicial y la implementación final?** Ver la sección 5: patrones dentro del código existente, más usos de los patrones al crecer el sistema, reprogramar reutilizando la cadena, política de privacidad publicada y límites del hosting gratuito.
5. **¿Ventajas y limitaciones de SDD con OpenSpec frente a instrucciones directas?** Ver la sección 6.
