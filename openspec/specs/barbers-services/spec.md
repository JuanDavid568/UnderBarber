# Barbers & Services Specification

## Purpose
Catálogo público de barberos (con sus especialidades) y servicios, administrable por el dueño.

## Requirements

### Requirement: Equipo de barberos
El sistema SHALL mostrar públicamente a los 3 barberos con nombre, título, biografía y lista de especialidades.

#### Scenario: Listado público
- **WHEN** cualquier visitante consulta `GET /api/barbers`
- **THEN** recibe los barberos activos con sus especialidades, sin datos privados (correo, hash)

### Requirement: Especialidades diferenciadas
Cada barbero SHALL tener una especialidad principal distinta:
1. Fades y degradados (estilo urbano y moderno)
2. Clásico y barba (tijera, navaja, perfilado)
3. Creativo (rizos, texturas, diseños y color)

#### Scenario: Especialidades visibles
- **WHEN** se muestra el perfil de un barbero
- **THEN** se ve su especialidad principal y las etiquetas de cortes que domina

### Requirement: Fotos de los barberos
Cada barbero SHALL mostrarse con una foto vertical (4:5) tomada de `frontend/img/barbers/<especialidad>.jpg` (`fade`, `classic`, `creative`), en la sección Equipo y en el resultado del cuestionario.

#### Scenario: Foto disponible
- **WHEN** existe el archivo de la foto del barbero
- **THEN** se muestra recortada y centrada en la cara, con texto alternativo con su nombre

#### Scenario: Foto ausente
- **WHEN** el archivo no existe o no carga
- **THEN** se muestra el emblema de su especialidad en su lugar

### Requirement: Catálogo de servicios
El sistema SHALL ofrecer servicios con nombre, descripción, precio en COP y duración en minutos.

#### Scenario: Listado público
- **WHEN** se consulta `GET /api/services`
- **THEN** se devuelven solo los servicios activos ordenados por posición

### Requirement: Administración de servicios
El administrador SHALL poder crear, editar y desactivar servicios.

#### Scenario: Desactivar servicio
- **WHEN** el administrador desactiva un servicio con citas históricas
- **THEN** deja de mostrarse al público pero las citas existentes conservan su referencia

### Requirement: Perfil editable por el barbero
Un barbero SHALL poder editar su biografía, etiquetas de especialidad y horario laboral.

#### Scenario: Edición propia
- **WHEN** un barbero actualiza su perfil
- **THEN** solo se modifica su propio registro
